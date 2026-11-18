-- Multi-VPS placement config: which system_servers row lives on which VPS.
-- gateway = the public WebSocket front of the node that hosts the row ("" = the entry node, the single-node default).
-- 001_init.sql predates the column and its COPY block is positional, so the column lands in its own file; the server
-- also runs this ALTER at startup (db.ensureServerNodeSchema) for databases created before this file existed.
ALTER TABLE public.system_servers ADD COLUMN IF NOT EXISTS gateway text NOT NULL DEFAULT '';
