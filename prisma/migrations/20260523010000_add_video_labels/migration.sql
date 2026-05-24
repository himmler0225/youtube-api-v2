-- video_labels
CREATE TABLE IF NOT EXISTS video_labels (
  id         BIGSERIAL NOT NULL,
  video_id   TEXT NOT NULL,
  category   TEXT NOT NULL,
  quality    INTEGER NOT NULL DEFAULT 2,
  labeled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT video_labels_pkey PRIMARY KEY (id),
  CONSTRAINT video_labels_video_id_key UNIQUE (video_id),
  CONSTRAINT video_labels_video_id_fkey FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS video_labels_category_idx ON video_labels (category);
