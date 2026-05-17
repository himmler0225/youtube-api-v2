-- Fix FK constraints: add ON DELETE CASCADE for child tables
ALTER TABLE trending_snapshots
  DROP CONSTRAINT IF EXISTS "TrendingSnapshot_videoId_fkey";
ALTER TABLE trending_snapshots
  ADD CONSTRAINT "TrendingSnapshot_videoId_fkey"
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;

ALTER TABLE search_results
  DROP CONSTRAINT IF EXISTS "SearchResult_videoId_fkey";
ALTER TABLE search_results
  ADD CONSTRAINT "SearchResult_videoId_fkey"
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;

ALTER TABLE comments
  DROP CONSTRAINT IF EXISTS "Comment_videoId_fkey";
ALTER TABLE comments
  ADD CONSTRAINT "Comment_videoId_fkey"
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;

-- Fix Comment self-ref: replies become top-level when parent deleted
ALTER TABLE comments
  DROP CONSTRAINT IF EXISTS "Comment_parentId_fkey";
ALTER TABLE comments
  ADD CONSTRAINT "Comment_parentId_fkey"
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE SET NULL;

-- Add channel_id to shorts
ALTER TABLE shorts ADD COLUMN IF NOT EXISTS channel_id TEXT REFERENCES channels(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS shorts_channel_id_idx ON shorts(channel_id);

-- Add index on channels.handle for lookup by handle
CREATE INDEX IF NOT EXISTS channels_handle_idx ON channels(handle);

-- Drop broken playlists table (was created with typo "modal", may not exist)
DROP TABLE IF EXISTS playlists CASCADE;

-- Create playlists table
CREATE TABLE IF NOT EXISTS playlists (
  id          TEXT        NOT NULL,
  channel_id  TEXT        REFERENCES channels(id) ON DELETE SET NULL,
  title       TEXT        NOT NULL,
  description TEXT,
  video_count INTEGER,
  thumbnails  JSONB,
  crawled_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT playlists_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS playlists_channel_id_idx ON playlists(channel_id);

-- Create playlist_items join table
CREATE TABLE IF NOT EXISTS playlist_items (
  id          BIGSERIAL   PRIMARY KEY,
  playlist_id TEXT        NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  video_id    TEXT        NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  position    INTEGER     NOT NULL,
  crawled_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT playlist_items_playlist_id_video_id_key UNIQUE (playlist_id, video_id)
);
CREATE INDEX IF NOT EXISTS playlist_items_video_id_idx ON playlist_items(video_id);
