// Which system_servers rows a process listens on (multi-VPS add-on). The rule is what keeps two VPSes from racing
// for one port: the entry node must never grab a row that has a gateway of its own.
import test from "node:test";
import assert from "node:assert/strict";
import { hostedRowIds } from "../src/game/gameServer.ts";

const rows = [
  { id: 0, gateway: "" }, // the Auth/"login" entry row, never a game listener
  { id: 1, gateway: "" },
  { id: 2, gateway: "" },
  { id: 3, gateway: "" },
  { id: 4, gateway: "ws://203.0.113.7:8090" }, // add-on VPS
];

test("single node: every row without a gateway is hosted (the behaviour before multi-VPS)", () => {
  assert.deepEqual(hostedRowIds(rows, [], ""), [1, 2, 3]);
});

test("the entry node never grabs an add-on row that names another VPS", () => {
  // what the entry process saw before this rule: rows.filter(id >= 1) -> it also bound 39194 and collided with the add-on
  assert.equal(hostedRowIds(rows, [], "").includes(4), false);
});

test("PB_GAME_SERVER_IDS wins and hosts exactly those rows", () => {
  assert.deepEqual(hostedRowIds(rows, [4], ""), [4]);
  assert.deepEqual(hostedRowIds(rows, [1, 2], "ws://203.0.113.7:8090"), [1, 2]);
  assert.deepEqual(hostedRowIds(rows, [9], ""), []); // an id the config does not have -> nothing, no listener
});

test("PB_NODE_GATEWAY hosts the rows pointing at this node and leaves the entry rows alone", () => {
  assert.deepEqual(hostedRowIds(rows, [], "ws://203.0.113.7:8090"), [4]);
  assert.deepEqual(hostedRowIds(rows, [], "ws://198.51.100.4:8090"), []); // a node with no rows of its own
});

test("row 0 (the Auth entry) is never a game listener", () => {
  assert.equal(hostedRowIds([{ id: 0, gateway: "" }], [], "").includes(0), false);
  assert.equal(hostedRowIds([{ id: 0, gateway: "" }], [0], "").length, 0);
});

test("a trailing slash on PB_NODE_GATEWAY does not split a row from its node", () => {
  assert.deepEqual(hostedRowIds(rows, [], "ws://203.0.113.7:8090/"), []); // config.nodeGateway trims it before this
  assert.deepEqual(hostedRowIds(rows, [], "ws://203.0.113.7:8090"), [4]);
});
