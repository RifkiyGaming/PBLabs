// English texts the lobby controller (controller.ts) says or hands to the Cross shell: STBL/STR key of String resolved
// by src/lobby/ui/i18n.ts, fallback copied verbatim from the table; key null = literal English chosen here [INFERIDO].
// Same scheme as src/lobby/screens/strings.ts.
import { tOr } from "../ui/i18n.ts";
import { cleanLabel } from "../screens/strings.ts";

type Entry = readonly [key: string | null, fallback: string, multiline?: boolean];
const K = {
  // servers / channels
  full: ["STR_TBL_GUI_SERVER_STATE_FULL", "FULL"],
  server: [null, "Server"],
  channel: [null, "Channel"],
  // lobby
  colMode: ["STR_TBL_GUI_READY_GAME_MODE", "Mode"],
  loadingRooms: ["STR_TBL_GUI_LOBBY_NOTICE_LOADING_ROOM_LIST", "Loading room list"],
  notExistRoom: ["STBL_IDX_EP_LOBBY_NOT_EXIST_ROOM", "Room does not exist."],
  // 2017 exe 0x8f54e0 (room phase, game event 1001 from SERVER_MESSAGE_KICK_PLAYER_ACK)
  roomKicked: ["STBL_IDX_EP_ROOM_KICKED", "You were kicked by the room host."],
  wait: ["STR_TBL_GUI_LOBBY_WAIT_STATE_TEXT", "Please wait..."],
  // login / loading captions (the exe's own wait messages)
  loginNoServer: ["STBL_IDX_EP_LOGIN_WAIT_DISCONNECT", "Could not connect to server.\nPlease try connecting later.", true],
  loadConnect: ["STBL_IDX_EP_LOGIN_WAIT_CONNECT_W", "Connecting...\nPlease wait a moment.", true],
  loadServer: ["STBL_IDX_EP_SERVER_WAIT_REFRESH_W", "Fetching server information.\nPlease wait a moment.", true],
  loadMyInfo: ["STBL_IDX_EP_SERVER_WAIT_GET_MYINFO", "Receiving user information.\nPlease wait a moment.", true],
  welcome: [null, "Welcome to"],
  // room modes (roomModes.ts ROOM_MODES[].text): Deathmatch variants of Rules.xml (Mode 19/20/21: StageOptions 96/128/224)
  deathmatch: ["STR_HEADER_MODE_TEAM_DEATH_MATCH", "Deathmatch"],
  modeSniper: ["STR_TBL_GUI_LOBBY_SNIPERMODE_TITLE", "Sniper Mode"],
  modeShotgun: ["STR_TBL_GUI_LOBBY_SHOTGUNMODE_TITLE", "Shotgun Mode"],
  // renamed on purpose: the original title ("Partida Clube", STR_TBL_GUI_LOBBY_KNUCKLEMODE_TITLE) is not shown
  modeKnife: [null, "Knife Mode"],
  // AI room: server Rules.xml Mode 16 "DEATHMATCH_AIC" = Rule 0, StageOptions 2 (AI), Conditions 4
  modeBots: ["STR_TBL_GUI_LOBBY_TRANING_TEXT", "Challenge"],
  modeHeadHunter: ["STR_TBL_GUI_LOBBY_HEADHUNTERMODE_TITLE", "HeadHunter"],
  modeChaos: ["STR_TBL_GUI_LOBBY_CHAOS_TITLE", "Chaos"],
  modeBomb: ["STR_HEADER_MODE_EXPLOSION", "Destruction"],
  // Bomb Mission with a special weapon: no Cross string for the variant (STBL_IDX_GAMEMODE_BOMB_SR / _SG / _KCL) [RECRIADO]
  modeBombSniper: [null, "Destruction Sniper"],
  modeBombShotgun: [null, "Destruction Shotgun"],
  modeBombKnife: [null, "Destruction Knife"],
  // Destroy (Sabotagem, STR_HEADER_MODE_DESTROY); its variants [RECRIADO] like the Bomb ones
  modeDestroy: ["STR_HEADER_MODE_DESTROY", "Sabotage"],
  modeDefence: ["STR_HEADER_MODE_DEFENCE", "Defense"],
  modeDestroySniper: [null, "Sabotage Sniper"],
  modeDestroyShotgun: [null, "Sabotage Shotgun"],
  modeDestroyKnife: [null, "Sabotage Knife"],
  // Annihilation = Rules.xml Mode 4 (Rule 0, StageOptions 1, Conditions 16); the Cross create window names it "Guerra de extermínio"
  modeAnnihilation: ["STR_TBL_GUI_LOBBY_ROUND_BATTLE_TEXT", "Annihilation"],
  // Ace = Rules.xml Mode 55 (Rule 128, Conditions 32). No Cross string for the mode name: "Ace Attacker" (tutorial text) [INFERIDO]
  modeAce: ["STR_HEADER_DO_TCH_DN_ACE_ATTACKER", "Ace Attacker"],
  minutes: [null, "minutes"],
  noTrainingTeam: ["STBL_IDX_EP_ROOM_NO_TRAINIG_TEAM_S", "All players must choose the same team."],
  // ready room
  noChangeSlot: ["STBL_IDX_EP_ROOM_NO_CHANGE_SLOT_S", "To change teams, unready first."],
  startNeedsReady: [null, "At least 1 player must be READY on the opposing team."],
  noPlayerInfo: [null, "Could not retrieve player information."],
  // chat feedback [RECRIADO]: the exe's texts for these were not traced
  chatBlocked: [null, "Blocked player:"],
  chatUnblocked: [null, "Unblocked player:"],
  chatBlockList: [null, "Blocked list:"],
  chatBlockNone: [null, "No blocked players."],
  chatBlockUsage: [null, "Use /block <nickname> or /unblock <nickname>."],
  chatNoWhisper: [null, "Select a player from the list (PM) or use /w <nickname> <text>."],
  chatNoTeam: [null, "Team chat is only available inside the room."],
  chatOffline: [null, "Disconnected from the chat server."],
} as const satisfies Record<string, Entry>;

type Labels = { readonly [k in keyof typeof K]: string };
export const T = {} as Labels;
for (const [name, e] of Object.entries(K) as [keyof typeof K, Entry][]) {
  Object.defineProperty(T, name, { enumerable: true, get: () => cleanLabel(e[0] ? tOr(e[0], e[1]) : e[1], e[2] === true) });
}