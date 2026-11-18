-- Display config of a system_servers row: how the card reads in the client's "select server" screen, and which
-- category (tab) it is grouped under. Both are free text and both are read live by GET /api/nodes, so renaming a
-- server or moving it to another category needs no restart: the client picks it up on its next refresh.
--
--   name     "" = the classic label "<kind name> <zero-padded index>" (e.g. "Normal Server 004")
--   category "" = the row keeps the tab of its `type` (Public -> Normal, Clan -> Clan, ...); a non-empty value gives
--                 it a tab of its own, which is how the servers hosted on another VPS are kept apart from the ones
--                 running on the entry node.
--
-- 001_init.sql predates both columns and its COPY block is positional, so they land in their own file; the server
-- also runs these ALTERs at startup (db.ensureServerNodeSchema) for databases created before this file existed.
ALTER TABLE public.system_servers ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '';
ALTER TABLE public.system_servers ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '';
