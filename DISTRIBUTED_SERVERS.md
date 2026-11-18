# Distributed Servers: add-on game servers on another Machines 

Run the same TypeScript server across multiple machines, all connected to a single PostgreSQL database, and then direct clients to a specific game server instance hosted on one of these machines. The entry machine continues to perform its existing functions—requiring no changes to its single-node configuration—while the additional machines run the same process (i.e., `node src/main.ts`), with the inclusion of a few additional environment variables.

```
       ┌─────────────────────────── one Postgres ───────────────────────────┐
       │  system_servers (id, host, port, gateway, ...)  system_channels (11) │
       └──────────────▲───────────────────────────────────────▲──────────────┘
                      │ read                                  │ read
┌───────────┐         │                                       │
│  Browser  │ ──(login)───────────────────────────────────────┼───────────────────┐
└─────┬─────┘         │                                       │                   │
      │               ▼                                       │                   │
      ├─► /api/nodes ─────────────────────────────────────────┤                   │
      │                                                       │                   │
      ├─► /tcp?target=game1 ──► [Machines A (entry)]          │                   │
      │                         :8090 (auth + game 1–3)       │                   │
      │                                                       │                   │
      ├─► /signal (room on A) ─► :8090                        │                   │
      │                                                       │                   │
      │                                                       │                   │
      │─► /tcp?target=game4 ──────────────────────────────────┼─► [Machines-B]    │
      │                                                       │   :8090           │
      └─► /signal (room on B) ────────────────────────────────┼─► (game 4)        │
                                                              │                   │
                                                              └───────────────────┘
```

## What used to pin everything to one process

| # | Blocker | Now |
| :--- | :--- | :--- |
| 1 | `signalTicket.ts` randomised the ticket MAC per process, so an Auth on Machines-A minted a login ticket Machines-B refused | `PB_TICKET_SECRET` pins the secret on every node (`config.ticketSecret`) |
| 2 | The client only ever opened one gateway (`defaultServerUrl()`); the row's `host` was sent in 2400 but never used | new `system_servers.gateway`, served by `GET /api/nodes` and resolved by `src/net/gateway.ts` |
| 3 | `TcpTarget` was the union `auth \| game1 \| game2 \| game3` — three servers, hard cap | `` `game${number}` ``; `gameTargetForServer()` derives the id from `port - 39190`, so `game4`, `game5`, … work |
| 4 | `main.ts` built acceptors from the **array index**, so ids had to be contiguous `1..N` | acceptors are keyed by the real `system_servers.id` |
| 5 | Every process listened on **every** row (`rows.filter(x => x.id >= 1)`) — two machines would race for one port | `hostedRowIds()` picks the rows this node owns (see below) |

Also fixed along the way: `/signal` and the match link now follow the room's own Game socket
(`roomScreen.ts` → `r.game.conn.serverUrl`) instead of the entry gateway, and a duplicate login on another Machines is
forwarded with `POST /api/kick`.

## Centralized config

Everything lives in the shared Postgres, so there is one place to edit it:

```
# Inspection
node scripts/servers-config.mjs list      # all rows + which machine is running them
node scripts/servers-config.mjs nodes     # grouped by gateway: what each machine carries
node scripts/servers-config.mjs show 4    # details for one row (if already available)

# Create a row
node scripts/servers-config.mjs add 4 203.0.113.7 39194 Public ws://203.0.113.7:8090

# Appearance
node scripts/servers-config.mjs name 4 "Server New"     # card contents
node scripts/servers-config.mjs category 4 "Asian"      # the card slot tab

# Capacity & channels
node scripts/servers-config.mjs capacity 4 2000 180           # max_players / channel_players
node scripts/servers-config.mjs channels 4 Public,Public,...   # exactly 11 types, IDs 0–10

# Enable in the client list
node scripts/servers-config.mjs state 4 on

# Move the row to another machine
node scripts/servers-config.mjs gateway 4 ws://203.0.113.7:8090   # "-" clearing (returning to entry)

# Run the engine (outside the script)
cd server && npm install        # just once
PB_TICKET_SECRET=<sama dgn entry> PB_GAME_SERVER_IDS=4 PB_NODE_ID=vps-b \
PB_WEB_PORT=8090 node src/main.ts

# Verification
node scripts/servers-config.mjs list
node scripts/servers-config.mjs nodes
curl http://<entry>:8090/api/nodes        # must display name, category, and gateway in row 4

# Dismantle (if not in use)
node scripts/servers-config.mjs remove 4   # row + 11 channels (cascade)
```

The script runs `ALTER TABLE system_servers ADD COLUMN IF NOT EXISTS gateway` on start, so it works on a database
created before this feature (`db/init/002_server_gateway.sql` covers fresh volumes). It also warns when a row breaks
the two protocol rules below.

The client reads that config from `GET /api/nodes` on the entry gateway (one fetch, cached 60 s):

```json
{
  "ok": true,
  "node": "machines-a",
  "nodes": [
    {
      "serverId": 4,
      "host": "203.0.113.7",
      "port": 39194,
      "gateway": "ws://203.0.113.7:8090",
      "name": "Server New",
      "category": "Asian",
      "state": true,
      "maxPlayers": 2000,
      "channelPlayers": 180,
      "players": 12,
      "channels": [
        {
          "id": 0,
          "type": "Public",
          "maxRooms": 20,
          "players": 3
        }
      ]
    }
  ]
}
```

## Display: category, custom name, no restart

`system_servers` carries two more free-text columns (`db/init/003_server_name_category.sql`, also applied at startup
by `db.ensureServerNodeSchema`, so a database from before this feature picks them up on the next boot):

| column | left empty (the default) | set to a value |
| :--- | :--- | :--- |
| `name` | the classic card label `"<kind name> <zero-padded index>"` (e.g. `Normal Server 004`) | exactly that text |
| `category` | the card sits in the tab of its `type` (Public -> Normal, Clan -> Clan, ...) | a tab of its own, named after it |

A non-empty `category` is how the servers hosted on another machines are kept apart from the entry ones: they stop being
grouped under their kind's tab and land in one tab that gathers every row sharing the category. Tabs are built at
runtime — `all`, then the categories, then the kinds that still have a server, at most 6 (the GUI only has
`ssServer_Tab0..5`).

```bash
node scripts/servers-config.mjs name 4 "Server New"       # what the card says
node scripts/servers-config.mjs category 4 "Asian"        # the tab it sits under
node scripts/servers-config.mjs name 4 -                  # "-" clears it, back to the classic label
```

Both are read from the shared database by `GET /api/nodes`, and **neither needs a restart**:

* the client merges them in `controller.applyNodeInfo()` right after the 2400 list arrives — that packet has a fixed
  layout and cannot carry a label — and drops its 60 s node cache first, so the next refresh is never stale;
* the Auth reloads the rows behind opcode `2399` (throttled to one query per second by
  `reloadServerDataThrottled`), so a server **added** on another machines shows up as well, not only a renamed one.

The refresh button of the select-server screen (`ssServer_ListRefresh`) re-runs `start()`: a fresh login, a fresh
2399 list and a fresh `/api/nodes`. So the whole loop is *edit on any node that can reach the database -> press
refresh in the game page -> done*, with both processes left running.

```json
{ "serverId": 4, "host": "127.0.0.1", "port": 39194, "gateway": "ws://127.0.0.1:8095",
  "name": "Server New", "category": "Asian", "state": true, "maxPlayers": 2000, "channelPlayers": 180 }
```

## Environment per node

| Variable | Entry Machines | Add-on Machines | Meaning |
| :--- | :--- | :--- | :--- |
| `PB_TICKET_SECRET` | **required** | **required** | same value on every node; HMAC of the enter + `/signal` tickets, and the header of `POST /api/kick`. Without it the secret is random per process and cross-Machines logins fail |
| `PB_GAME_SERVER_IDS` | optional | `4` | explicit ids this process hosts; wins over everything else |
| `PB_NODE_GATEWAY` | optional | `ws://<its own public front>` | alternative to the ids: host the rows whose `gateway` says this address |
| `PB_NODE_ID` | optional | optional | label in the logs and in `GET /api/nodes` |
| `PB_WEB_PORT` | `8090` | its own | web front (`/tcp`, `/signal`, `/api`) |
| `PB_TS_AUTH_PORT` | `39290` | another port if both run on one machine | Auth listener |
| `PB_WEB_ORIGINS` | the page origin | **same value** | WS/CORS origin allow-list — the page origin must be allowed on every node |

With neither `PB_GAME_SERVER_IDS` nor `PB_NODE_GATEWAY`, a node hosts the rows whose `gateway` is empty — that is the
entry node, and it is exactly the old behaviour for a database whose rows all have no gateway. An add-on row always
carries a gateway, so the entry node never grabs it.

**Do not set `PB_ADVERTISE_HOST` in a multi-Machines setup.** It overwrites `system_servers.host` for *every* row, which
would point all servers at one IP. Set each row's `host` instead (the `add` command does).

## Package and Upload to Another Machine

```bash
$src = "Path\To\Folder|PBLabs"
$dst = "$env:TEMP\pblabs-machine"
robocopy $src $dst /E /XD node_modules public .git dist .vite /NFL /NDL /NJH /NJS
Compress-Archive -Path "$dst\*" -DestinationPath "$PWD\pblabs-machine.zip" -Force
```

## Adding a Machines

```bash
# 1. on any machine with access to the database
node scripts/servers-config.mjs add 4 <Machines-B public IPv4> 39194 Public ws://<Machines-B public IPv4>:8090
node scripts/servers-config.mjs state 4 on

# 2. on Machines-B: the same checkout, same Postgres
PB_TICKET_SECRET=<same value as Machines-A> \
PB_GAME_SERVER_IDS=4 \
PB_NODE_ID=machines-b \
PB_WEB_PORT=8090 \
node src/main.ts
```

Restart **both** nodes: `system_servers` / `system_channels` are read at startup (`gateway` itself is read live by
`GET /api/nodes`). The client needs no rebuild and no change — it discovers the new gateway at the next server pick.

## Rules the config must satisfy

1. **`port` = `39190 + id`** — the client derives `game<id>` from the advertised port. The `add` command enforces it.
2. **Exactly 11 channels per row** — the protocol reads a fixed 11-byte channel-type list; 10 or 12 and the whole
   server list is dropped. Every row needs `id` 0..10.
3. **`host` must be an IPv4 address** — 2400 writes it as four bytes (`IPAddress.Parse` throws otherwise).
4. `name`, `category` and `gateway` are read **live** — no restart at all. The rest of a row (`state`, `host`, `port`,
   `type`, `max_players`) also shows up without one, because the Auth reloads `system_servers` behind opcode `2399`.
   What still needs a restart: **a new row** (its hosting node has to start to open the listener) and anything the
   **Game** node reads at startup (`system_channels`, the room/lobby data).