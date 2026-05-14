-- Standardize naming: rename all tables and columns to snake_case.
-- Prisma @map/@@@map decorators keep TypeScript field names as camelCase;
-- this migration only changes the underlying PostgreSQL column/table names.

-- Drop FTS trigger first (its body references old column names)
DROP TRIGGER IF EXISTS "trig_video_tsv" ON "Video";
DROP FUNCTION IF EXISTS video_tsv_update();

-- ==================== User ====================
ALTER TABLE "User" RENAME COLUMN "passwordHash"     TO password_hash;
ALTER TABLE "User" RENAME COLUMN "passwordAlgo"     TO password_algo;
ALTER TABLE "User" RENAME COLUMN "tokenVersion"     TO token_version;
ALTER TABLE "User" RENAME COLUMN "emailVerifiedAt"  TO email_verified_at;
ALTER TABLE "User" RENAME COLUMN "phoneVerifiedAt"  TO phone_verified_at;
ALTER TABLE "User" RENAME COLUMN "createdAt"        TO created_at;
ALTER TABLE "User" RENAME COLUMN "updatedAt"        TO updated_at;

-- ==================== AuthSession ====================
ALTER TABLE "AuthSession" RENAME COLUMN "userId"              TO user_id;
ALTER TABLE "AuthSession" RENAME COLUMN "deviceId"            TO device_id;
ALTER TABLE "AuthSession" RENAME COLUMN "deviceName"          TO device_name;
ALTER TABLE "AuthSession" RENAME COLUMN "userAgentHash"       TO user_agent_hash;
ALTER TABLE "AuthSession" RENAME COLUMN "ipHash"              TO ip_hash;
ALTER TABLE "AuthSession" RENAME COLUMN "refreshTokenHash"    TO refresh_token_hash;
ALTER TABLE "AuthSession" RENAME COLUMN "refreshTokenFamily"  TO refresh_token_family;
ALTER TABLE "AuthSession" RENAME COLUMN "refreshExpiresAt"    TO refresh_expires_at;
ALTER TABLE "AuthSession" RENAME COLUMN "lastRotatedAt"       TO last_rotated_at;
ALTER TABLE "AuthSession" RENAME COLUMN "revokedAt"           TO revoked_at;
ALTER TABLE "AuthSession" RENAME COLUMN "lastSeenAt"          TO last_seen_at;
ALTER TABLE "AuthSession" RENAME COLUMN "devicePublicKey"     TO device_public_key;
ALTER TABLE "AuthSession" RENAME COLUMN "dpopNonce"           TO dpop_nonce;
ALTER TABLE "AuthSession" RENAME COLUMN "dpopNonceExpiresAt"  TO dpop_nonce_expires_at;
ALTER TABLE "AuthSession" RENAME COLUMN "createdAt"           TO created_at;
ALTER TABLE "AuthSession" RENAME COLUMN "updatedAt"           TO updated_at;

-- ==================== LoginAttempt ====================
ALTER TABLE "LoginAttempt" RENAME COLUMN "userId"    TO user_id;
ALTER TABLE "LoginAttempt" RENAME COLUMN "ipHash"    TO ip_hash;
ALTER TABLE "LoginAttempt" RENAME COLUMN "uaHash"    TO ua_hash;
ALTER TABLE "LoginAttempt" RENAME COLUMN "createdAt" TO created_at;

-- ==================== AuditLog ====================
ALTER TABLE "AuditLog" RENAME COLUMN "userId"    TO user_id;
ALTER TABLE "AuditLog" RENAME COLUMN "sessionId" TO session_id;
ALTER TABLE "AuditLog" RENAME COLUMN "ipHash"    TO ip_hash;
ALTER TABLE "AuditLog" RENAME COLUMN "uaHash"    TO ua_hash;
ALTER TABLE "AuditLog" RENAME COLUMN "createdAt" TO created_at;

-- ==================== Channel ====================
ALTER TABLE "Channel" RENAME COLUMN "subscriberCountText" TO subscriber_count_text;
ALTER TABLE "Channel" RENAME COLUMN "crawledAt"           TO crawled_at;
ALTER TABLE "Channel" RENAME COLUMN "updatedAt"           TO updated_at;

-- ==================== Video ====================
ALTER TABLE "Video" RENAME COLUMN "channelId"         TO channel_id;
ALTER TABLE "Video" RENAME COLUMN "channelName"        TO channel_name;
ALTER TABLE "Video" RENAME COLUMN "viewsText"          TO views_text;
ALTER TABLE "Video" RENAME COLUMN "durationText"       TO duration_text;
ALTER TABLE "Video" RENAME COLUMN "publishedTimeText"  TO published_time_text;
ALTER TABLE "Video" RENAME COLUMN "viewCount"          TO view_count;
ALTER TABLE "Video" RENAME COLUMN "durationSeconds"    TO duration_seconds;
ALTER TABLE "Video" RENAME COLUMN "isLiveContent"      TO is_live_content;
ALTER TABLE "Video" RENAME COLUMN "isShort"            TO is_short;
ALTER TABLE "Video" RENAME COLUMN "descriptionSnippet" TO description_snippet;
ALTER TABLE "Video" RENAME COLUMN "isAvailable"        TO is_available;
ALTER TABLE "Video" RENAME COLUMN "unavailableReason"  TO unavailable_reason;
ALTER TABLE "Video" RENAME COLUMN "detailCrawledAt"    TO detail_crawled_at;
ALTER TABLE "Video" RENAME COLUMN "crawledAt"          TO crawled_at;
ALTER TABLE "Video" RENAME COLUMN "updatedAt"          TO updated_at;

-- ==================== TrendingSnapshot ====================
ALTER TABLE "TrendingSnapshot" RENAME COLUMN "videoId"   TO video_id;
ALTER TABLE "TrendingSnapshot" RENAME COLUMN "crawledAt" TO crawled_at;

-- ==================== SearchResult ====================
ALTER TABLE "SearchResult" RENAME COLUMN "videoId"   TO video_id;
ALTER TABLE "SearchResult" RENAME COLUMN "crawledAt" TO crawled_at;

-- ==================== Comment ====================
ALTER TABLE "Comment" RENAME COLUMN "videoId"           TO video_id;
ALTER TABLE "Comment" RENAME COLUMN "parentId"          TO parent_id;
ALTER TABLE "Comment" RENAME COLUMN "likesCount"        TO likes_count;
ALTER TABLE "Comment" RENAME COLUMN "repliesCount"      TO replies_count;
ALTER TABLE "Comment" RENAME COLUMN "publishedTimeText" TO published_time_text;
ALTER TABLE "Comment" RENAME COLUMN "crawledAt"         TO crawled_at;

-- ==================== Rename tables ====================
ALTER TABLE "User"             RENAME TO users;
ALTER TABLE "AuthSession"      RENAME TO auth_sessions;
ALTER TABLE "LoginAttempt"     RENAME TO login_attempts;
ALTER TABLE "AuditLog"         RENAME TO audit_logs;
ALTER TABLE "Channel"          RENAME TO channels;
ALTER TABLE "Video"            RENAME TO videos;
ALTER TABLE "TrendingSnapshot" RENAME TO trending_snapshots;
ALTER TABLE "SearchResult"     RENAME TO search_results;
ALTER TABLE "Comment"          RENAME TO comments;

-- ==================== Recreate FTS trigger (new column/table names) ====================
UPDATE videos
SET tsv = to_tsvector(
  'simple',
  coalesce(title, '') || ' ' ||
  coalesce(channel_name, '') || ' ' ||
  coalesce(description_snippet, '')
);

CREATE OR REPLACE FUNCTION video_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW.tsv := to_tsvector(
    'simple',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.channel_name, '') || ' ' ||
    coalesce(NEW.description_snippet, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_video_tsv
  BEFORE INSERT OR UPDATE OF title, channel_name, description_snippet
  ON videos
  FOR EACH ROW
  EXECUTE FUNCTION video_tsv_update();
