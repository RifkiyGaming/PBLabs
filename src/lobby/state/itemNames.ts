// Item names. Protocol 1039 carries no names, so names come from data:
//   1. a provider set with setItemNameProvider()  <- hook to swap/override the source
//   2. the client's PT-BR names: public/assets/ui/strings/items.pt-BR.json (PBCross .pef + String.i3Pack Brazil
//      table, tools ui-export/ui-strings.mjs; weapons and sets). Only `name` is used.
//   2b. names set by the 2017 item audit (public/assets/ui/complete-items-2017.json `names`, charaSupport.ts): coupon
//      days ("EXP Up 110% 7 dias" from system_shop_effects) and the 2017 client's own part names (String.i3Pack) for
//      items whose server name is a raw key (A_H_Skull)
//   3. server snapshot data/itemNames.json (system_shop.item_name, system_shop_effects.coupon_name,
//      ItemStatistics.xml; regenerate with `node src/lobby/state/data/export-item-names.mjs`)
//   4. the Cross icon index name (public/assets/ui/cross/icons/index.json, .pef key), when loadIconIndex() ran
//   5. "#<itemId>"  (no name known: shown as is, never invented)
// Hangul names are skipped at every level.
export type NameSource = "provider" | "client-pt-BR" | "audit-2017" | "system_shop" | "system_shop_effects" | "ItemStatistics.xml" | "icon-pef" | "none";
export interface ItemName { name: string; source: NameSource }

export type ItemNameProvider = (itemId: number) => string | null | undefined;

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;
let provider: ItemNameProvider | null = null;
let client: Record<string, string> = {};
/** items.pt-BR.json `key` (the .pef path, e.g. "Weapon\\Gun\\K-2"): ties an item to its STBL_IDX_WD_* description */
let clientKeys: Record<string, string> = {};
let table: Record<string, [string, string]> = {};
let iconNames: Record<string, string> = {};
let auditNames: Record<string, string> = {};

/**
 * Server itemId -> the id items.pt-BR.json uses. That file follows the 2017 pack numbering, which differs from the
 * server's for throwables (server 407004 K-413 = pack 407008, while pack 407004 is the C-5; weapons/throwables.ts
 * pack2017Id): looked up as is, the K-413 family showed C-5 / C-5 PBWC names. 0 = no client entry for that item.
 */
let clientId: (itemId: number) => number = (id) => id;
export function setClientIdMap(fn: ((itemId: number) => number) | null): void { clientId = fn ?? ((id) => id); }

/** Hook: replaces (or with null, removes) the first name source. */
export function setItemNameProvider(p: ItemNameProvider | null): void { provider = p; }

/** Server snapshot (tests/Node pass the parsed JSON; the browser uses loadItemNames()). */
export function setItemNameTable(json: { names: Record<string, [string, string]> }): void { table = json.names ?? {}; }

/** items.pt-BR.json: `{ "<itemId>": { name, desc, key } }` -> names only. */
export function setClientItemNames(json: Record<string, { name?: string; key?: string }>): void {
  client = {};
  clientKeys = {};
  for (const [id, v] of Object.entries(json)) {
    if (v && typeof v.name === "string" && v.name.trim()) client[id] = v.name.trim();
    if (v && typeof v.key === "string") clientKeys[id] = v.key;
  }
}

/** complete-items-2017.json `names` (charaSupport.ts). */
export function setAuditItemNames(names: Record<string, string>): void { auditNames = names; }

/** Names from icon index (`icons[id].name`). */
export function setIconNames(names: Record<string, string>): void { iconNames = names; }

let loading: Promise<void> | null = null;
/** Browser: client names (fetch) + server snapshot (lazy chunk, ~400 KB) when a meta screen opens. */
export function loadItemNames(uiBase = "/assets/ui"): Promise<void> {
  return (loading ??= Promise.all([
    fetch(`${uiBase}/strings/items.pt-BR.json`).then((r) => (r.ok ? r.json() : {})).then(setClientItemNames).catch(() => {}),
    import("./data/itemNames.json").then((m) => setItemNameTable(((m as { default?: unknown }).default ?? m) as { names: Record<string, [string, string]> })),
    import("../../weapons/throwables.ts").then((t) => setClientIdMap((id) => (t.isServerThrowable(id) ? t.pack2017Id(id) : id))),
  ]).then(() => {}).catch((e) => { loading = null; console.warn("[lobby] item names not loaded", e); }));
}

const ok = (s: string | null | undefined): s is string => !!s && !HANGUL.test(s);

/** Sources 2..4 of one id (no provider, no coupon expansion): [name, source] or null. */
function lookup(id: number): [string, NameSource] | null {
  const key = String(id);
  const cid = String(clientId(id));
  if (ok(client[cid])) return [client[cid], "client-pt-BR"];
  if (ok(auditNames[key])) return [auditNames[key], "audit-2017"];
  const t = table[key];
  if (t && ok(t[0])) return [t[0], t[1] as NameSource];
  if (ok(iconNames[key])) return [iconNames[key], "icon-pef"];
  return null;
}

/**
 * Coupon 17 DD GGG (DD = days): ShopManager writes every system_shop_effects coupon as `17 DD GGG`, while the
 * coupon_name lives under the base id 17 00 GGG in the DB (1700027 "Quick Reload Weapon" -> 1701027 / 1703027 / ...).
 * Name = base name + " N dia(s)" (the 2017 audit's format), null when the base itself has no name.
 */
function couponName(itemId: number): [string, NameSource] | null {
  if (Math.floor(itemId / 100000) !== 17) return null;
  const days = Math.floor((itemId % 100000) / 1000);
  if (days < 1) return null;
  const base = lookup(itemId - days * 1000);
  return base ? [`${base[0]} ${days} dia${days > 1 ? "s" : ""}`, "system_shop_effects"] : null;
}

export function itemName(itemId: number): ItemName {
  const p = provider?.(itemId);
  if (ok(p)) return { name: p, source: "provider" };
  const own = lookup(itemId) ?? couponName(itemId);
  if (own) return { name: own[0], source: own[1] };
  return { name: `#${itemId}`, source: "none" };
}
