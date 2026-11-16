// Smoke: itens do menu de contexto do Cross (contextMenu.ts) para lista do lobby, slot da sala e regra do Convite do Clã.
// node --experimental-transform-types src/lobby/screensCross/contextMenu.smoke.node.ts
import { CMC, NO_CLAN_LOGO, canClanInvite, lobbyMenuItems, roomMenuItems } from "./contextMenu.ts";

let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${JSON.stringify(got)}`);
};

// lobby (0x835170): me = Information only; other = Info, PM, Add; Clan Invite only with canClanInvite
eq("lobby: me = Information", lobbyMenuItems(true, true), [CMC.DETAIL_INFO]);
eq("lobby: other without clan", lobbyMenuItems(false, false), [CMC.DETAIL_INFO, CMC.WHISPER, CMC.ADD_FRIEND]);
eq("lobby: other with Clan Invite", lobbyMenuItems(false, true), [CMC.DETAIL_INFO, CMC.WHISPER, CMC.ADD_FRIEND, CMC.CLAN_INVITE]);

// room slot (0x7d5cf0): my slot nothing; leader gets Master + Kick Out
eq("room: my slot = empty", roomMenuItems(true, true, true), []);
eq("room: leader in other slot", roomMenuItems(false, true, false), [CMC.GIVE_MASTER, CMC.FORCE_GET_AWAY, CMC.WHISPER, CMC.ADD_FRIEND]);
eq("room: member with Clan Invite", roomMenuItems(false, false, true), [CMC.WHISPER, CMC.ADD_FRIEND, CMC.CLAN_INVITE]);

// Clan Invite: master/staff (access 1/2) and target without clan
eq("clan: master invites clanless", canClanInvite(1, NO_CLAN_LOGO), true);
eq("clan: staff invites clanless", canClanInvite(2, NO_CLAN_LOGO), true);
eq("clan: member cannot invite", canClanInvite(0, NO_CLAN_LOGO), false);
eq("clan: target already has clan", canClanInvite(1, 5), false);
eq("clan: target without clan data (undefined) cannot invite", canClanInvite(1, undefined), false);

if (fail) { console.log(`${fail} FAIL`); process.exit(1); }
console.log("contextMenu smoke ok");
