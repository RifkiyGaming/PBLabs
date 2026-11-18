# Events

How to add, edit, and run in-game events in PBLabs. Every event is plain data — a row in PostgreSQL or an entry in a JSON file — so adding one never requires code changes, only a server restart.

---

## Event Types

| Type | Storage | Effect in game | Read by |
| :--- | :--- | :--- | :--- |
| Login event | `system_event_login` + `system_event_login_rewards` | Free gift once per day on login (announce packet 3079) | `shared/data.ts` → `shared/playerUtils.ts` (`checkGameEvents`) |
| Visit / attendance | `system_event_visit` + `system_event_visit_boxes` | Daily check-in calendar with per-day rewards | `shared/data.ts` → `auth/metaPackets.ts` (attendance block of `GET_USER_INFO_ACK`) |
| Quest event | `system_event_quest` | Grants the event mission card set 13 (EventCard) | `shared/data.ts` → `game/gameServer.ts` |
| Rank-up event | `system_event_rankup` + `system_event_rankup_bonuses` | Bonus EXP/Point on every rank up | `game/roomHandlers.ts` (`loadRewardData`) |
| Boost event | `system_event_boost` | Bonus EXP/gold after each battle (+ percent) | `game/roomHandlers.ts` (`loadRewardData`) |
| Xmas event | `system_event_xmas` | Christmas gift reset window | `shared/data.ts` → `shared/playerUtils.ts` |
| Playtime event | `server/runtime/Data/Events/Play.json` | Playtime reward window; sets feature bit `0x100` in `LOGIN_ACK` | `config.ts` (`loadPlaytimeEvents`, `runningPlaytimeEvent`) |

Schema source of truth: `db/init/001_init.sql` (search `system_event_`). Existing example rows ship as `COPY public.system_event_... FROM stdin;` blocks in the same file.

---

## Date Format

All `begin_date` / `ended_date` columns are `bigint` holding **`yyMMddHHmm`** as a number:

```
2611180000  =  2026-11-18 00:00
2612012359  =  2026-12-01 23:59
```

An event runs while `begin_date <= now < ended_date` (end exclusive).

> **Timezone:** the server clock is UTC by default (`PB_TZ` in `server/src/config.ts`, same as the original C# servers in Docker). Convert local time to UTC before writing a window — e.g. 2026-11-18 00:00 WIB = `2611171700`.

---

## Adding an Event

Run these against the game database (Docker Postgres, port `5433` by default — see `Settings.ini` `[Database]` or `PB_DB_*`).

### 1. Login event (daily gift)

```sql
INSERT INTO system_event_login (id, begin_date, ended_date, name, description, period, priority, subtitle, image)
VALUES (2, 2611180000, 2612012359, 'Login Event', 'Daily login gift', false, false, '', 1);

-- one row per reward day; ordinal starts at 0; good_id must exist in system_shop
INSERT INTO system_event_login_rewards (event_id, ordinal, good_id)
VALUES (2, 0, 10310201);
```

- `period` = repeating window, `priority` = wins over other running events.
- `image` is the banner id shown in the client.
- If a `good_id` is not in the shop catalog, the gift is **withheld** and the server logs `[EventLogin] Good ... is not in the shop`.

### 2. Visit / attendance event

```sql
INSERT INTO system_event_visit (id, begin_date, ended_date, title, check_days)
VALUES (8, 2611180000, 2612182359, 'ATTENDANCE NOV', 30);

-- one row per day (day starts at 1); good_id_2 = 0 for a single reward; is_both = both items at once
INSERT INTO system_event_visit_boxes (event_id, day, good_id_1, good_id_2, is_both)
VALUES (8, 1, 10327904, 10323204, false),
       (8, 2, 20209104, 20203812, false);
-- ... up to check_days
```

Player progress resets automatically when a new visit event starts (`lastVisitDate < beginDate`).

### 3. Quest event (grants mission card set 13)

```sql
INSERT INTO system_event_quest (id, begin_date, ended_date)
VALUES (2, 2611180000, 2612012359);
```

While running, every player gets the free Event mission card set (set 13) in a free slot.

### 4. Rank-up event (bonus on rank up)

```sql
INSERT INTO system_event_rankup (id, begin_date, ended_date, name, description, period, priority, subtitle, image)
VALUES (2, 2611180000, 2612012359, 'Rank Up Event', 'RANK', false, false, '', 1);

-- one row per rank id (0..56): (bonus_exp, bonus_point, percent)
INSERT INTO system_event_rankup_bonuses (event_id, rank_id, bonus_exp, bonus_point, percent)
VALUES (2, 0, 150, 500, 10),
       (2, 1, 150, 500, 10);
```

### 5. Boost event (battle result bonus)

```sql
INSERT INTO system_event_boost (id, begin_date, ended_date, boost_type, boost_value, bonus_exp, bonus_gold, percent, name, description, period, priority, subtitle, image)
VALUES (4, 2611180000, 2611252359, 'Mode', 0, 5000, 10000, 10, 'Double EXP', '', false, false, '', 0);
```

- `boost_type`: `Mode` or `PcCafe`.
- `bonus_exp` / `bonus_gold` are flat additions, `percent` is the percentage bonus.

### 6. Xmas event

```sql
INSERT INTO system_event_xmas (id, begin_date, ended_date, good_id)
VALUES (2, 2612250000, 2701052359, 10310201);
```

### 7. Playtime event (JSON file, not the database)

Edit `server/runtime/Data/Events/Play.json`:

```json
{
  "List": {
    "Event": [
      { "Id": 1, "Begin": 2611180000, "Ended": 2612012359, "Priority": false, "Period": false }
    ]
  }
}
```

Also make sure `EnablePlaytime = true` for your `ConfigId` in `server/runtime/Data/ServerConfig.json`, otherwise the `0x100` feature bit is cleared at login.

---

## Loading & Restart

| Data | Loaded | Reload |
| :--- | :--- | :--- |
| login / visit / quest / xmas | `loadStaticData()` — once at process start (`main.ts`) | restart required |
| rank-up / boost | `loadRewardData()` — once at game server start (`gameServer.ts`) | restart required |
| playtime (Play.json) | `config.playtimeEvents` — once at module load | restart required |
| shop catalog | `loadShop()` at start | in-game `:refreshshop` (GM) |
| server list (`system_servers`) | throttled reload on client refresh | **live**, no restart |

There is **no** `:sys reload` for events — after any `INSERT`/`UPDATE`/`DELETE` on `system_event_*` (or editing `Play.json`), restart the server:

```bash
npm start            # or: npm run dev:all
```

---

## Verifying

```sql
-- what would run right now (UTC!)
SELECT id, name, begin_date, ended_date FROM system_event_login
WHERE begin_date <= to_char(now() AT TIME ZONE 'UTC', 'YYMMDDHH24MI')::bigint
  AND ended_date  >  to_char(now() AT TIME ZONE 'UTC', 'YYMMDDHH24MI')::bigint;
```

In the server log after restart you'll see the startup summary from `loadStaticData()`:

```
... N basics, N awards, N cafes, N coupons, N visit events, ...
```

- Attendance block appears in `GET_USER_INFO_ACK` only when a visit event is running and the player has event state.
- Login gift: server logs `[EventLogin] ...` on failure; success sends announce 3079.
- Rank-up/boost apply in `calculateResult()` (`roomHandlers.ts`) only while a window is active.

---

## Example Seed Data

`db/init/001_init.sql` ships working examples you can copy:

- Login event `1` (`2510010000`–`2612012359`) with reward `10310201`
- Quest event `1`, Rank-up event `1` (ranks 0–56), Xmas event `1`
- Visit event `1` — full 31-day reward table
- Boost events `1`–`3` (Mode + two PcCafe tiers)

> Note: the `COPY ... FROM stdin` seeds only run on a **fresh** database. On an existing database, insert the rows directly (psql / Docker) as shown above.
