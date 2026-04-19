-- Add full-text search support to the Video table.
-- Uses PostgreSQL tsvector + GIN index + trigger for automatic maintenance.
--
-- Search columns: title (primary) + channelName + descriptionSnippet
-- Language: 'simple' — no stemming, works for any language including Vietnamese

-- 1. Add tsvector column
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "tsv" tsvector;

-- 2. Backfill existing rows
UPDATE "Video"
SET "tsv" = to_tsvector(
  'simple',
  coalesce(title, '') || ' ' ||
  coalesce("channelName", '') || ' ' ||
  coalesce("descriptionSnippet", '')
);

-- 3. GIN index for fast FTS queries
CREATE INDEX IF NOT EXISTS "idx_video_tsv" ON "Video" USING GIN ("tsv");

-- 4. Trigger function — keeps tsv in sync on INSERT / UPDATE
CREATE OR REPLACE FUNCTION video_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW."tsv" := to_tsvector(
    'simple',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW."channelName", '') || ' ' ||
    coalesce(NEW."descriptionSnippet", '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop if already exists (idempotent re-run)
DROP TRIGGER IF EXISTS "trig_video_tsv" ON "Video";

CREATE TRIGGER "trig_video_tsv"
  BEFORE INSERT OR UPDATE OF title, "channelName", "descriptionSnippet"
  ON "Video"
  FOR EACH ROW
  EXECUTE FUNCTION video_tsv_update();
