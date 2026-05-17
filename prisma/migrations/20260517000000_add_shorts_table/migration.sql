-- Separate shorts into their own table; drop is_short flag from videos.

ALTER TABLE videos DROP COLUMN is_short;

CREATE TABLE shorts (
    id               TEXT        NOT NULL,
    title            TEXT        NOT NULL,
    channel_name     TEXT,
    view_count       BIGINT,
    duration_seconds INTEGER,
    thumbnails       JSONB,
    is_available     BOOLEAN     NOT NULL DEFAULT true,
    crawled_at       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP(3) NOT NULL,

    CONSTRAINT shorts_pkey PRIMARY KEY (id)
);

CREATE INDEX shorts_crawled_at_idx ON shorts(crawled_at);
