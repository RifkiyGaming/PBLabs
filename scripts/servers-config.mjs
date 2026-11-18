// Centralized server/channel config for a multi-VPS deployment: one Postgres, every VPS reads the same rows, this
// script is the single place to edit them. The server picks the changes up on restart (system_servers and
// system_channels are read at startup), except `gateway`, which GET /api/nodes serves live.
//
//   node scripts/servers-config.mjs list                 all rows + their gateway (which VPS runs them)
//   node scripts/servers-config.mjs nodes                grouped by gateway: what each VPS carries
//   node scripts/servers-config.mjs show 4               one row with its 11 channels
//   node scripts/servers-config.mjs gateway 4 ws://203.0.113.7:8090    where row 4 lives ("-" clears it)
//   node scripts/servers-config.mjs state 4 on           online/offline in the client's server list
//   node scripts/servers-config.mjs capacity 4 2000 180  max_players / channel_players
//   node scripts/servers-config.mjs channels 4 Public,Public,...       exactly 11 types, ids 0..10
//   node scripts/servers-config.mjs add 4 203.0.113.7 39194 Public ws://203.0.113.7:8090
//
// A row's port must be 39190 + id (the client derives the /tcp target game<id> from it) and every row needs exactly
// 11 channels (the protocol reads a fixed 11-byte list). This script enforces both.
import { pool, systemServers, systemChannels, ensureServerNodeSchema } from "../server/src/db.ts";

const GAME_PORT_BASE = 39190;
const CHANNELS_PER_SERVER = 11;

const usage = () => {
  console.log("usage: node scripts/servers-config.mjs <list|nodes|show|gateway|state|capacity|channels|name|category|add|remove> [args...]\n" +
    "  list\n  nodes\n  show <serverId>\n  gateway <serverId> <url|->\n  state <serverId> <on|off>\n" +
    `  capacity <serverId> <maxPlayers> <channelPlayers>\n  channels <serverId> <${CHANNELS_PER_SERVER} types, comma separated>\n` +
    "  name <serverId> <text|->       card label in the select-server screen (\"-\" = the classic \"<kind> <index>\")\n" +
    "  category <serverId> <text|->   tab the card is grouped under (\"-\" = the tab of its type)\n" +
    `  add <serverId> <hostIPv4> <port> <type> <gateway|->   (port must be ${GAME_PORT_BASE} + serverId)\n` +
    "  remove <serverId>            (row + its channels)");
};

const die = (msg) => { console.error(`error: ${msg}`); process.exitCode = 1; };

const int = (v) => {
  const n = Number.parseInt(String(v), 10);
  if (!Number.isInteger(n)) die(`not an integer: ${v}`);
  return n;
};

const isIPv4 = (s) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s) && s.split(".").every((x) => Number(x) <= 255);

async function main() {
  await ensureServerNodeSchema(); // idempotent: databases from before 002_server_gateway.sql
  const [cmd, ...args] = process.argv.slice(2);
  const servers = await systemServers();
  const channels = await systemChannels();

  if (cmd === "list" || !cmd) {
    console.log(`system_servers + system_channels (${servers.length} rows, ${channels.length} channels)`);
    console.table(servers.map((s) => ({
      id: s.id,
      state: s.state ? "on" : "off",
      host: s.host,
      port: s.port,
      type: s.type,
      gateway: s.gateway || "(entry node)",
      name: s.name || "-",
      category: s.category || "-",
      max_players: s.maxPlayers,
      channel_players: s.channelPlayers,
      channels: channels.filter((c) => c.serverId === s.id).length,
    })));
    const bad = servers.filter((s) => s.id >= 1 && s.port !== GAME_PORT_BASE + s.id);
    if (bad.length) console.warn(`warning: port must be ${GAME_PORT_BASE} + id for the client to reach them: ${bad.map((s) => `${s.id}->${s.port}`).join(", ")}`);
    const short = servers.filter((s) => s.id >= 1 && channels.filter((c) => c.serverId === s.id).length !== CHANNELS_PER_SERVER);
    if (short.length) console.warn(`warning: every row needs exactly ${CHANNELS_PER_SERVER} channels: ${short.map((s) => s.id).join(", ")}`);
    return;
  }

  if (cmd === "nodes") {
    const groups = new Map();
    for (const s of servers) {
      const key = s.gateway || "(entry node / defaultServerUrl)";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    }
    for (const [gateway, rows] of groups) {
      console.log(`\n${gateway}`);
      console.table(rows.map((s) => ({
        id: s.id, state: s.state ? "on" : "off", port: s.port, type: s.type,
        channels: channels.filter((c) => c.serverId === s.id).length,
      })));
    }
    return;
  }

  const id = int(args[0]);
  const row = servers.find((s) => s.id === id);

  if (cmd === "show") {
    if (!row) return die(`no system_servers row ${id}`);
    console.table([row]);
    console.table(channels.filter((c) => c.serverId === id).map((c) => ({ id: c.id, type: c.type, max_rooms: c.maxRooms })));
    return;
  }

  if (cmd === "gateway") {
    const url = args[1];
    if (url === undefined) return die("gateway <serverId> <url|->");
    const value = url === "-" ? "" : url;
    if (value && !/^wss?:\/\/[^/\s]+$/.test(value)) return die(`gateway must look like ws://host:port or wss://host:port, got ${value}`);
    await pool.query("UPDATE system_servers SET gateway = $1 WHERE id = $2", [value, id]);
    console.log(`system_servers ${id} gateway = ${value || "(entry node)"}`);
    return;
  }

  if (cmd === "state") {
    const on = args[1];
    if (on !== "on" && on !== "off") return die("state <serverId> <on|off>");
    await pool.query("UPDATE system_servers SET state = $1 WHERE id = $2", [on === "on", id]);
    console.log(`system_servers ${id} state = ${on} (restart the nodes for the server list to pick it up)`);
    return;
  }

  if (cmd === "capacity") {
    const maxPlayers = int(args[1]), channelPlayers = int(args[2]);
    await pool.query("UPDATE system_servers SET max_players = $1, channel_players = $2 WHERE id = $3", [maxPlayers, channelPlayers, id]);
    console.log(`system_servers ${id}: max_players = ${maxPlayers}, channel_players = ${channelPlayers} (restart the nodes)`);
    return;
  }

  if (cmd === "channels") {
    const types = (args[1] ?? "").split(",").map((t) => t.trim()).filter(Boolean);
    if (types.length !== CHANNELS_PER_SERVER) return die(`need exactly ${CHANNELS_PER_SERVER} channel types, got ${types.length}`);
    const have = channels.filter((c) => c.serverId === id);
    if (have.length !== CHANNELS_PER_SERVER) return die(`row ${id} has ${have.length} channels; create it with 'add' first`);
    for (let i = 0; i < CHANNELS_PER_SERVER; i++) {
      await pool.query("UPDATE system_channels SET type = $1 WHERE server_id = $2 AND id = $3", [types[i], id, i]);
    }
    console.log(`system_channels server ${id}: ${types.join(",")} (restart the nodes)`);
    return;
  }

  if (cmd === "name" || cmd === "category") {
    // Both are free text read live by GET /api/nodes, so this is the one config change that needs no restart at all:
    // the client shows it on the next press of its refresh button.
    if (!row) return die(`no system_servers row ${id}`);
    const value = args[1];
    if (value === undefined) return die(`${cmd} <serverId> <text|->   (\"-\" clears it)`);
    const text = value === "-" ? "" : value;
    if (text.length > 64) return die(`${cmd} must be at most 64 characters, got ${text.length}`);
    if (/[\r\n\t]/.test(text)) return die(`${cmd} must be a single line`);
    const column = cmd === "name" ? "name" : "category";
    await pool.query(`UPDATE system_servers SET ${column} = $1 WHERE id = $2`, [text, id]);
    console.log(`system_servers ${id} ${column} = ${text || "(default)"} -- live, press refresh in the game page`);
    return;
  }

  if (cmd === "remove") {
    if (!row) return die(`no system_servers row ${id}`);
    await pool.query("DELETE FROM system_servers WHERE id = $1", [id]); // system_channels cascades (FK ON DELETE CASCADE)
    console.log(`removed system_servers ${id} and its ${channels.filter((c) => c.serverId === id).length} channels (restart the nodes)`);
    return;
  }

  if (cmd === "add") {
    const [host, portRaw, type, gatewayRaw] = args.slice(1);
    const port = int(portRaw);
    if (!isIPv4(host ?? "")) return die(`host must be the IPv4 of the VPS running this row (2400 writes it as 4 bytes), got ${host}`);
    if (port !== GAME_PORT_BASE + id) return die(`port must be ${GAME_PORT_BASE} + id = ${GAME_PORT_BASE + id} (the client derives game${id} from it), got ${port}`);
    if (row) return die(`system_servers ${id} already exists; use gateway/state/capacity/channels`);
    const gateway = !gatewayRaw || gatewayRaw === "-" ? "" : gatewayRaw;
    if (gateway && !/^wss?:\/\/[^/\s]+$/.test(gateway)) return die(`gateway must look like ws://host:port, got ${gateway}`);
    await pool.query(
      "INSERT INTO system_servers (id, state, host, port, type, is_mobile, max_players, channel_players, gateway) VALUES ($1,false,$2,$3,$4,false,2000,180,$5)",
      [id, host, port, type ?? "Public", gateway],
    );
    // 11 channels, types cloned from row 1 (or a Public default) so the fixed 11-byte list is complete from the start
    const template = (await pool.query("SELECT type FROM system_channels WHERE server_id = 1 ORDER BY id ASC")).rows;
    for (let i = 0; i < CHANNELS_PER_SERVER; i++) {
      await pool.query("INSERT INTO system_channels (server_id, id, type, max_rooms) VALUES ($1,$2,$3,20)",
        [id, i, template[i]?.type ?? "Public"]);
    }
    console.log(`added system_servers ${id} (${host}:${port}, ${type ?? "Public"}, gateway ${gateway || "(entry)"}) + ${CHANNELS_PER_SERVER} channels`);
    console.log(`next: node scripts/servers-config.mjs state ${id} on   then start that VPS with PB_GAME_SERVER_IDS=${id} (or PB_NODE_GATEWAY=${gateway || "ws://<its public front>"})`);
    if (!gateway) console.log(`note: an empty gateway keeps this row on the entry node (rows without a gateway are hosted by whichever process runs without PB_GAME_SERVER_IDS / PB_NODE_GATEWAY)`);
    return;
  }

  usage();
  process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());
