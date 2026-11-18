// Where a system_servers row actually lives (multi-VPS add-on nodes), plus how its card reads.
//
// 2400 (GAME_SERVER_STATE) has a fixed layout and cannot carry a URL, a name or a category, so that display config
// lives in the shared Postgres (system_servers.gateway / name / category) and is served by GET /api/nodes on the
// entry gateway. One fetch answers every server pick and the whole select-server screen: `gateway` is the WebSocket
// base of the VPS that hosts the row, used for /tcp, /signal and the match link, `name` and `category` are what the
// card says and which tab it sits under.
//
// Everything degrades to the old behaviour: empty field, missing field, unreachable /api/nodes -> the entry gateway
// (defaultServerUrl()), the classic "<kind> <index>" label and the tab of the row's type, which is the only thing a
// single-node deployment has ever had.
import { defaultServerUrl } from "./connection.ts";

/** One row of GET /api/nodes as the select-server screen needs it. */
export interface NodeInfo {
  /** WebSocket base of the node hosting the row ("" = the entry gateway). */
  gateway: string;
  /** Card label ("" = the classic "<kind name> <zero-padded index>"). */
  name: string;
  /** Category/tab the card is grouped under ("" = the tab of the row's type). */
  category: string;
}

interface NodesDoc {
  ok?: boolean;
  nodes?: { serverId?: number; gateway?: string; name?: string; category?: string }[];
}

const TTL_MS = 60_000;
let cache: { entry: string; at: number; byId: Map<number, NodeInfo> } | null = null;

/** Forget the cached /api/nodes answer (the client's refresh button calls this so a config change shows at once). */
export function resetNodeCache(): void {
  cache = null;
}

/** `ws://host:8090` -> `http://host:8090`: the gateway URL doubles as the base of the HTTP config fetch. */
const httpBase = (ws: string) => ws.replace(/^wss:/i, "https:").replace(/^ws:/i, "http:");

const row = (n: NonNullable<NodesDoc["nodes"]>[number]): NodeInfo => ({
  gateway: typeof n.gateway === "string" ? n.gateway.trim() : "",
  name: typeof n.name === "string" ? n.name : "",
  category: typeof n.category === "string" ? n.category : "",
});

async function load(entry: string): Promise<Map<number, NodeInfo>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(`${httpBase(entry.replace(/\/+$/, ""))}/api/nodes`, {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const doc = (await res.json()) as NodesDoc;
    const byId = new Map<number, NodeInfo>();
    for (const n of doc.nodes ?? []) if (typeof n.serverId === "number") byId.set(n.serverId, row(n));
    return byId;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The whole /api/nodes table, one fetch for the whole screen (60 s cache). Never rejects: a missing or failing
 * answer returns an empty map, which is exactly the old single-node behaviour. Callers that need several rows must
 * prefer this over calling `gatewayForServer` in a loop, so a dead entry gateway costs one timeout and not one per row.
 */
export async function allNodeInfo(entry = defaultServerUrl()): Promise<Map<number, NodeInfo>> {
  try {
    if (!cache || cache.entry !== entry || Date.now() - cache.at > TTL_MS) cache = { entry, at: Date.now(), byId: await load(entry) };
    return cache.byId;
  } catch (e) {
    console.warn(`[net] /api/nodes failed (${String(e)}); single-node defaults for every server`);
    return new Map();
  }
}

/** The display config of one row: its card label and tab. Empty strings mean "the classic label / the tab of type". */
export async function nodeInfoFor(serverId: number, entry = defaultServerUrl()): Promise<NodeInfo> {
  return (await allNodeInfo(entry)).get(serverId) ?? { gateway: "", name: "", category: "" };
}

/**
 * The WebSocket base URL to open `serverId` on: that row's own VPS when the central config names one, otherwise
 * `entry` (the page's gateway). Never rejects — a missing or failing /api/nodes keeps the previous behaviour.
 */
export async function gatewayForServer(serverId: number, entry = defaultServerUrl()): Promise<string> {
  return (await allNodeInfo(entry)).get(serverId)?.gateway || entry;
}
