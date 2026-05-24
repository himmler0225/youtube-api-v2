-- Add subscriber_count column to channels (was missing)
ALTER TABLE channels ADD COLUMN IF NOT EXISTS subscriber_count BIGINT;

-- Enum for Menu type
DO $$ BEGIN
  CREATE TYPE "MenuType" AS ENUM ('MAIN', 'EXPLORE', 'SETTINGS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- menus
CREATE TABLE IF NOT EXISTS menus (
  id          TEXT NOT NULL,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  icon        TEXT,
  path        TEXT,
  "parentId"  TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  type        "MenuType" NOT NULL DEFAULT 'MAIN',
  CONSTRAINT menus_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS menus_slug_key ON menus (slug);
CREATE INDEX IF NOT EXISTS menus_parent_idx ON menus ("parentId");

-- subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id          BIGSERIAL NOT NULL,
  user_id     TEXT NOT NULL,
  channel_id  TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT subscriptions_user_id_fkey  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT subscriptions_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  CONSTRAINT subscriptions_user_channel_unique UNIQUE (user_id, channel_id)
);
CREATE INDEX IF NOT EXISTS subscriptions_user_idx    ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS subscriptions_channel_idx ON subscriptions (channel_id);

-- watch_history
CREATE TABLE IF NOT EXISTS watch_history (
  id         BIGSERIAL NOT NULL,
  user_id    TEXT NOT NULL,
  video_id   TEXT NOT NULL,
  progress   INTEGER NOT NULL DEFAULT 0,
  watched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT watch_history_pkey PRIMARY KEY (id),
  CONSTRAINT watch_history_user_id_fkey  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT watch_history_video_id_fkey FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  CONSTRAINT watch_history_user_video_unique UNIQUE (user_id, video_id)
);
CREATE INDEX IF NOT EXISTS watch_history_user_watched_idx ON watch_history (user_id, watched_at);
CREATE INDEX IF NOT EXISTS watch_history_video_idx        ON watch_history (video_id);

-- video_likes
CREATE TABLE IF NOT EXISTS video_likes (
  id         BIGSERIAL NOT NULL,
  user_id    TEXT NOT NULL,
  video_id   TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT video_likes_pkey PRIMARY KEY (id),
  CONSTRAINT video_likes_user_id_fkey  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT video_likes_video_id_fkey FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  CONSTRAINT video_likes_user_video_unique UNIQUE (user_id, video_id)
);
CREATE INDEX IF NOT EXISTS video_likes_video_idx ON video_likes (video_id);
CREATE INDEX IF NOT EXISTS video_likes_user_idx  ON video_likes (user_id);

-- system_configs
CREATE TABLE IF NOT EXISTS system_configs (
  key        TEXT NOT NULL,
  value      JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT system_configs_pkey PRIMARY KEY (key)
);

-- categories
CREATE TABLE IF NOT EXISTS categories (
  id         TEXT NOT NULL,
  name       TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);

-- user_playlists
CREATE TABLE IF NOT EXISTS user_playlists (
  id          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_playlists_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS user_playlists_user_idx ON user_playlists (user_id);

-- playlist_likes
CREATE TABLE IF NOT EXISTS playlist_likes (
  id          BIGSERIAL NOT NULL,
  user_id     TEXT NOT NULL,
  playlist_id TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT playlist_likes_pkey PRIMARY KEY (id),
  CONSTRAINT playlist_likes_user_playlist_unique UNIQUE (user_id, playlist_id)
);
CREATE INDEX IF NOT EXISTS playlist_likes_user_idx     ON playlist_likes (user_id);
CREATE INDEX IF NOT EXISTS playlist_likes_playlist_idx ON playlist_likes (playlist_id);

-- saved_playlists
CREATE TABLE IF NOT EXISTS saved_playlists (
  id          BIGSERIAL NOT NULL,
  user_id     TEXT NOT NULL,
  playlist_id TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT saved_playlists_pkey PRIMARY KEY (id),
  CONSTRAINT saved_playlists_user_playlist_unique UNIQUE (user_id, playlist_id)
);
CREATE INDEX IF NOT EXISTS saved_playlists_user_idx ON saved_playlists (user_id);
