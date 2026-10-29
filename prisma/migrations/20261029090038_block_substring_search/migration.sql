-- Substring search ("Ball" finds "Fussball"), complementing the German
-- full-text index. pg_trgm ships with PostgreSQL.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "ProgramBlock_searchText_trgm_idx"
  ON "ProgramBlock" USING GIN (lower("searchText") gin_trgm_ops);
