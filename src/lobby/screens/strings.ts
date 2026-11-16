// PT-BR labels of the meta screens, by STBL/STR key of String_Brazil, resolved through src/lobby/ui/i18n.ts
// (public/assets/ui/cross/strings.json). The second value is the same text copied verbatim from the string table, used
// before loadStrings() resolves and in Node. Keys without a known control binding were chosen by hand [INFERIDO] from the
// original design-time caption (e.g. "장비하기" = equip). Colour tags are stripped; `line: true` keeps line breaks.
import { tOr } from "../ui/i18n.ts";

type Entry = readonly [key: string | null, fallback: string, multiline?: boolean];
const K = {
  shop: ["STBL_IDX_SHOP_CAPTION", "Shop"],
  inventory: ["STR_INVEN_INVENTORY", "Inventory"],
  buy: ["STR_SHOP_BUY", "Buy"],
  equip: ["STR_INVEN_DO_EQUIP", "Equip"],
  equipped: ["STR_INVEN_EQUIPPED", "Equipped"],
  // no STBL id recovered for this caption (cosmetic-slot clear was never dumped) [RECRIADO]
  unequip: [null, "Unequip"],
  use: ["STR_INVEN_DO_USE", "Use"],
  leave: ["STR_POPUP_LEAVE", "Leave"],
  confirm: ["STR_POPUP_OK", "Confirm"],
  cancel: ["STR_POPUP_CANCEL", "Cancel"],
  gold: ["STR_SHOP_INFO_POINT", "Gold"],
  cash: ["STR_SHOP_INFO_CASH", "Cash"],
  tag: [null, "TAG"], // design-time caption of StaticText_Money_Title2 (Latin; no BR key found)
  viewAll: ["STR_SHOP_MENU_ALLITEM", "View All"],
  tabWeapon: ["STR_SHOP_MENU_NEWHOT_WEAPON", "Weapon"],
  tabChara: ["STR_SHOP_MENU_NEWHOT_CHARACTER", "Character"],
  tabItem: ["STR_SHOP_MENU_NEWHOT_ITEM", "Item"],
  primary: ["STR_INVEN_PRIMARY_WEAPON", "Primary Weapon"],
  secondary: ["STR_INVEN_SECONDARY_WEAPON", "Secondary Weapon"],
  melee: ["STR_INVEN_MELEE_WEAPON", "Melee Weapon"],
  throwing: ["STR_INVEN_THROWING_WEAPON", "Throwing"],
  special: ["STR_INVEN_SPECIAL_WEAPON", "Special Weapon"],
  chara: ["STR_INVEN_CHRACTER", "Character"],
  head: ["STR_INVEN_HEAD", "Head"],
  mask: ["STR_SHOP_MENU_CHARACTER_MASK", "Mask"],
  beret: ["STR_INVEN_BERET", "Beret"],
  redChara: ["STR_INVEN_RED_CHARA", "Rebel Character"],
  blueChara: ["STR_INVEN_BLUE_CHARA", "CT-Force Character"],
  usedEquip: ["STR_INVEN_USED_EQUIP", "Used Equipment"],
  notUsed: ["STR_INVEN_NOTUSED", "Not Used"],
  unlimited: ["STBL_IDX_ITEM_UNLIMITED", "unlimited"],
  days: ["STBL_IDX_ITEM_TERM_UNIT", "days"],
  units: ["STBL_IDX_ITEM_COUNT_UNIT", "units"],
  pcRoom: ["STR_INVEN_ONLY_PC_ROOM", "PC Cafe Only"],
  startingAuth: ["STR_INVEN_STARTING_AUTH", "Item usage has not started yet.\nIt can be used for a limited time \nstarting from the moment of use.\nDo you want to equip?", true],
  buySuccess: ["STBL_IDX_EP_SHOP_BUY_SUCCESS", "The item was purchased successfully."],
  confirmBuy: ["STR_POPUP_CAPTION_CONFIRM_BUY", "Purchase Confirmation"],
  cannotEquip: ["STR_INVEN_CANNOT_EQUIP", "Cannot equip "],
  unknownItem: ["STR_SHOP_UNKNOWNITEM", "Unknown item"],
  createRoom: ["STR_TBL_GUI_LOBBY_CREATE_ROOM_TEXT", "Create Room"],
  quickStart: ["STR_TBL_GUI_LOBBY_QUICK_START_TEXT", "Quick Start"],
  enterRoom: ["STR_TBL_GUI_LOBBY_ENTER_ROOM_TEXT", "Enter"],
  refresh: ["STR_TBL_GUI_LOBBY_REFRESH_TEXT", "Refresh"],
  userList: ["STR_TBL_GUI_LOBBY_USER_LIST", "Waiting List"],
  loadingRooms: ["STR_TBL_GUI_LOBBY_NOTICE_LOADING_ROOM_LIST", "Loading room list"],
  // room list header: keys of PointBlankRe_Lobby_RoomList's Lua SetHeader
  colNumber: ["STR_TBL_GUI_SERVER_NUMBER", "Number"],
  colRoomName: ["STR_TBL_GUI_LOBBY_ROOMNAME_TEXT2", "Room Name"],
  colMode: ["STR_TBL_GUI_READY_GAME_MODE", "Mode"],
  colStage: ["STR_TBL_PROFILE_STAGE_TEXT", "Stage"],
  colMember: ["STR_TBL_GUI_LOBBY_PEOPLE_COUNT_TEXT", "Users"],
  colState: ["STR_TBL_GUI_LOBBY_STATE_TEXT", "Status"],
  colPing: ["STR_TBL_GUI_LOBBY_PING_TEXT", "Ping"],
  stateWait: ["STBL_IDX_ROOM_STATE_WAIT", "Waiting"],
  statePlay: ["STBL_IDX_ROOM_STATE_PLAY", "Playing"],
  modeDeathmatch: ["STR_HEADER_MODE_TEAM_DEATH_MATCH", "Deathmatch"],
  notExistRoom: ["STBL_IDX_EP_LOBBY_NOT_EXIST_ROOM", "Room does not exist."],
  waitState: ["STR_TBL_GUI_LOBBY_WAIT_STATE_TEXT", "Please wait..."],
  noPoint: ["STBL_IDX_CLAN_NO_POINT", "Insufficient Gold."],
  noCash: ["STBL_IDX_COUPON_USE_FAIL_REASON_LIMIT_MONEY", "Insufficient Cash."],
  cannotBuyItem: ["STR_SHOP_CANNOT_ITEM_BUYING", "Cannot buy this item "],
  buyFail: ["STBL_IDX_EP_SHOP_BUY_FAIL_CAPTION_E", "Purchase Failed"],
} as const satisfies Record<string, Entry>;

/** Removes the client's {col:...}{/col} markup; single-line labels also fold line breaks. */
export function cleanLabel(s: string, multiline = false): string {
  const t = s.replace(/\{col:[^}]*\}|\{\/col\}/g, "");
  return multiline ? t.replace(/\\n/g, "\n") : t.replace(/\\n|\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
}

/** Hangul never reaches the screen (design-time captions / unresolved bindings). */
export const hasHangul = (s: string): boolean => /[ᄀ-ᇿ㄰-㆏가-힯]/.test(s);

type Labels = { readonly [k in keyof typeof K]: string };
export const S = {} as Labels;
for (const [name, e] of Object.entries(K) as [keyof typeof K, Entry][]) {
  Object.defineProperty(S, name, { enumerable: true, get: () => cleanLabel(e[0] ? tOr(e[0], e[1]) : e[1], e[2] === true) });
}
