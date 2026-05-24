-- Add user_id to comments (nullable — crawled comments have no user)
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS comments_user_id_idx ON comments(user_id);

-- CommentLike join table
CREATE TABLE IF NOT EXISTS comment_likes (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, comment_id)
);
