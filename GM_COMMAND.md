## How to Execute Commands

Type commands in the **lobby chat or room chat** using the `:` prefix:

```text
:help
:endbattle
:player kick "Player Name"
```

Important notes:

- The GM prefix is `:`. Regular player commands use `/`.
- Server responses are sent as chat messages from **Server**.
- Player names containing spaces must be enclosed in quotation marks:

```text
:reports "Name With Spaces"
:mute "Name With Spaces" 30
```

- For the `:player` command, an unquoted number is interpreted as a **UID**. A number inside quotation marks is interpreted as a **nickname**:

```text
:player kick 1001          -> UID 1001
:player kick "1001"        -> nickname "1001"
:player kick "Evil Player" -> nickname "Evil Player"
```

- If an account does not have permission to execute a command, the `:` text will be sent as a regular chat message and will be visible to other players.
- Some commands can only be used in the lobby, in a room, or while a match is running.
- Avoid using nickname prefixes as targets. GM commands search for exact nicknames, not prefixes.

---

## Roles and Permissions

Access levels are stored in `accounts.access_level`.

| Level | Role | Available Permissions |
|---:|---|---|
| `0` | NORMAL | `helpcommand`, `hostcommand` |
| `50` | MODERATOR | `observer_enabled`, `helpcommand`, `hostcommand`, `testcommand`, `moderatorcommand` |
| `100` | GAMEMASTER | All permissions, including `gamemastercommand` and `developercommand` |

### Command Permissions

| Permission | Commands |
|---|---|
| `helpcommand` | `:help` |
| `hostcommand` | `:host` |
| `moderatorcommand` | `:endbattle`, `:sendmsg`, `:roominfo`, `:reports`, `:mute`, `:bugs` |
| `gamemastercommand` | `:teamcash`, `:title`, `:refreshshop`, `:player` |
| `developercommand` | `:sys` |

Therefore:

- **NORMAL** can only use `:help` and `:host`. The `:host` command still requires the user to be the room leader.
- **MODERATOR** has access to all moderator commands.
- **GAMEMASTER** has access to all commands documented here.

The `testcommand` permission exists in the database, but no active command currently uses it.

---

## Enabling the GM Role

To grant GM permissions to an account:

```sql
UPDATE accounts
SET access_level = 100
WHERE nickname = 'PLAYER_NAME';
```

Or by username:

```sql
UPDATE accounts
SET access_level = 100
WHERE username = 'USERNAME';
```

The server reloads `access_level` every time a command is executed, so permission changes usually take effect immediately without requiring a restart.

To ensure the GM panel and GM indicators appear again, log out and log back in or re-enter the lobby.

If you modify the `system_access_rights` permission table, the server must be reloaded because the permission map is loaded when the server starts.

> Rank 53/58 can be recognized as GM on the game side, but `:` command permissions are still determined by `accounts.access_level`.

---

## Command Summary

| Command | Permission | Context |
|---|---|---|
| `:help` | `helpcommand` | Lobby/room |
| `:host` | `hostcommand` | Room, leader only |
| `:endbattle` | `moderatorcommand` | While a match is running |
| `:sendmsg` | `moderatorcommand` | Room/channel/online |
| `:roominfo` | `moderatorcommand` | Inside a room |
| `:reports` | `moderatorcommand` | Lobby/room |
| `:mute` | `moderatorcommand` | Lobby/room |
| `:bugs` | `moderatorcommand` | Lobby/room |
| `:sys` | `developercommand` | Lobby/room |
| `:teamcash` | `gamemastercommand` | Inside a room |
| `:title` | `gamemastercommand` | Self only |
| `:refreshshop` | `gamemastercommand` | Lobby/room |
| `:player` | `gamemastercommand` | Lobby/room |

---

## 1. `:help`

### Command List

```text
:help
```

Displays the commands that the current account is allowed to execute, with five commands per page.

### Specific Page

```text
:help 2
```

### Command Details

```text
:help player
:help :player
:help host
```

`:help <command>` displays the command syntax, examples, and description.

On the last page, the server also displays help for regular player commands such as `/w`, `/r`, `/ping`, `/denunciar`, `/votekick`, and `/bug`.

---

## 2. `:host`

Changes room settings. You must be inside a room and be the **room leader**.

### Weapon Restrictions

```text
:host wpn all
:host wpn ar
:host wpn smg
:host wpn sr
:host wpn sg
:host wpn mg
:host wpn rpg
```

Available weapon options:

- `all` — All weapons
- `ar` — Assault Rifle
- `smg` — Submachine Gun
- `sr` — Sniper Rifle
- `sg` — Shotgun
- `mg` — Machine Gun
- `rpg` — RPG-7

Server flag values:

| Value | Weapon |
|---:|---|
| `511` | All Weapons |
| `31` | Assault Rifle |
| `47` | Submachine Gun |
| `79` | Sniper Rifle |
| `143` | Shotgun |
| `271` | Machine Gun |

> In the current implementation, `:host wpn rpg` also writes the value `511`, which is the same value used by `all`.

Unknown weapon values automatically reset the setting to `all`.

### Game Duration

```text
:host time 3
:host time 5
:host time 7
:host time 10
:host time 15
:host time 20
:host time 25
:host time 30
```

Accepted values:

```text
3, 5, 7, 10, 15, 20, 25, 30
```

### Competitive Mode

```text
:host compe on
:host compe off
```

When enabled:

- The number of slots must be `6`, `8`, or `10`, corresponding to `3v3`, `4v4`, or `5v5`.
- The room name changes to `Competitive!!!`.
- Competitive mode is enabled.

When disabled:

- Competitive mode is turned off.
- The room name is randomized from several default names.

---

## 3. `:endbattle`

```text
:endbattle
```

Ends the currently running match.

Requirements:

- You must be inside a room.
- The match must have already started.
- The player must be at least in the `READY` state.

This command does not require room leader status, but it requires the `moderatorcommand` permission.

---

## 4. `:sendmsg`

Sends server messages to different targets.

### Send to an Entire Room

```text
:sendmsg room Message for everyone in the room
```

### Send to the Current Lobby/Channel

```text
:sendmsg channel Message for the lobby channel
```

### Send to All Online Players

```text
:sendmsg player Server will restart in 5 minutes
```

Available targets:

- `room` — All players in the current room.
- `channel` — All players in the current lobby channel.
- `player` — All online players recorded by the game server.

---

## 5. `:roominfo`

Changes internal room information.

```text
:roominfo time <value>
:roominfo flags <value>
:roominfo killcam <0-255>
```

### Room Time

```text
:roominfo time 7
```

This command can only be used before the match starts.

The `time` value is converted into the internal `killTime` format, so it does not necessarily correspond to the number of minutes.

To configure game duration in minutes, use:

```text
:host time 7
```

### Weapons Flag

```text
:roominfo flags 511
```

Changes the weapons flag numerically.

Common values:

```text
511 = All Weapons
31  = Assault Rifle
47  = Submachine Gun
79  = Sniper Rifle
143 = Shotgun
271 = Machine Gun
```

### Kill Camera

```text
:roominfo killcam 10
```

The value must be between `0` and `255`.

---

## 6. `:reports`

Views player reports.

### Latest Reports

```text
:reports
```

Displays the 10 most recent reports.

### Reports by Nickname

```text
:reports PlayerName
:reports "Name With Spaces"
```

Displays reports associated with the specified nickname.

The results may also include a summary of the most active reporters over the last 24 hours.

---

## 7. `:mute`

Mutes a player in chat.

```text
:mute PlayerName 30
:mute "Name With Spaces" 30
```

### Unmute a Player

```text
:mute PlayerName 0
```

Rules:

- Duration is measured in minutes.
- Minimum value: `0`.
- Maximum value: `43200`, equivalent to 30 days.
- `0` restores the player's chat access.
- You cannot mute yourself.
- You cannot mute an account with a higher access level.
- Targets can be searched through online player data or the database.

---

## 8. `:bugs`

Views the latest bug reports.

```text
:bugs
:bugs 10
```

- Default: 5 reports.
- Minimum: 1.
- Maximum: 20.
- Displays bug reports with the most recent IDs.

---

## 9. `:sys`

Developer/GM command requiring the `developercommand` permission.

### UDP Mode

```text
:sys udp 1
:sys udp 2
:sys udp 3
:sys udp 4
```

Available values:

| Value | Mode |
|---:|---|
| `1` | RELAY |
| `2` | RELAY_P2P |
| `3` | RELAY, default value |
| `4` | CLIENT |

### Debug Toggle

```text
:sys debug 1
:sys debug 0
```

### Test Toggle

```text
:sys test 1
:sys test 0
```

### Ping Toggle

```text
:sys ping 1
:sys ping 0
```

> Currently, UDP/debug/test/ping values are stored in the server's runtime state, but they do not all affect the TypeScript server's behavior yet.

### Reload Battle Pass

```text
:sys reload pase
```

Reloads battle pass data and resends season challenge information to the player executing the command.

### Reload Classic Mode

```text
:sys reload classic_mode
```

In the current implementation, this command only returns a refresh message and does not perform an actual reload.

### Unlock All Titles for Yourself

```text
:sys title all
```

Has the same effect as `:title`.

---

## 10. `:teamcash`

Gives cash to all players on a specific team in the room.

```text
:teamcash red 1000
:teamcash blue 1000
```

Syntax:

```text
:teamcash <red|blue> <amount>
```

Rules:

- You must be inside a room.
- The team must be either `red` or `blue`.
- The amount must be numeric.
- Negative values can reduce cash, but the balance cannot go below zero.
- Cash is distributed to all accounts occupying slots on the specified team.

---

## 11. `:title`

```text
:title
```

Unlocks all titles for the account executing the command.

To unlock titles for another player:

```text
:player title PlayerName
:player title 1001
:player title "1001"
```

---

## 12. `:refreshshop`

```text
:refreshshop
```

Performs the following actions:

1. Reloads the shop catalog.
2. Resends the shop catalog to the player executing the command.
3. Resends the saillist data.

---

## 13. `:player`

The main command for managing other players.

### Target Format

```text
:player ... 1001         -> UID 1001
:player ... "1001"       -> nickname "1001"
:player ... PlayerName   -> nickname PlayerName
:player ... "Name With Spaces" -> nickname containing spaces
```

Targets are searched by exact match, not by prefix.

---

### 13.1 Granting Currency

#### Gold

```text
:player gift gold 5000 PlayerName
:player gift gold 5000 1001
:player gift gold 5000 "Name With Spaces"
```

#### Cash

```text
:player gift cash 1000 PlayerName
```

#### Tags

```text
:player gift tags 100 PlayerName
```

Syntax:

```text
:player gift <gold|cash|tags> <amount> <uid|nick>
```

Rules:

- The amount must be numeric.
- Positive values increase the currency balance.
- Negative values decrease the balance, but cannot make it negative.
- Targets can be online or offline.
- Online players receive balance updates.

---

### 13.2 Granting Items Using Goods ID

```text
:player gift item 103004 PlayerName
:player gift item 103004 1001
:player gift item 103004 "Name With Spaces"
```

Syntax:

```text
:player gift item <goodsId> <uid|nick>
```

This format requires a **Goods ID**, not a regular Item ID.

To experiment with Goods ID, Item ID, or raw items, use `:player xtx`.

---

### 13.3 Kicking Players

```text
:player kick PlayerName
:player kick 1001
:player kick "1001"
:player kick "Name With Spaces"
:player kick PlayerName 5
```

Syntax:

```text
:player kick <nick|uid> [seconds]
```

Rules:

- The target must currently be online.
- The duration in seconds is optional. The default value is `0`.
- You cannot kick yourself.
- You cannot kick an account with a higher access level.
- An unquoted numeric target is interpreted as a UID.
- A numeric target inside quotation marks is interpreted as a nickname.

---

### 13.4 Temporary Ban

```text
:player ban normal 7 PlayerName
:player ban normal 7 1001
:player ban normal 7 "Name With Spaces"
```

Syntax:

```text
:player ban normal <days> <uid|nick>
```

Example:

```text
:player ban normal 3 1001
```

Rules:

- `days` must be a numeric value.
- Online players are immediately disconnected.
- The account cannot log in while the ban is active.
- You cannot ban yourself.
- You cannot ban an account with a higher access level.

---

### 13.5 Permanent Ban

```text
:player ban permanent 999 PlayerName
:player ban permanent 0 1
```
