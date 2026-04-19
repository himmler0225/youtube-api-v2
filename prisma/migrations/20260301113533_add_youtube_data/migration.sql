-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT,
    "avatar" TEXT,
    "banner" TEXT,
    "subscriberCountText" TEXT,
    "description" TEXT,
    "crawledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "channelId" TEXT,
    "channelName" TEXT,
    "viewsText" TEXT,
    "durationText" TEXT,
    "publishedTimeText" TEXT,
    "viewCount" BIGINT,
    "durationSeconds" INTEGER,
    "isLiveContent" BOOLEAN NOT NULL DEFAULT false,
    "descriptionSnippet" TEXT,
    "thumbnails" JSONB,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "unavailableReason" TEXT,
    "detailCrawledAt" TIMESTAMP(3),
    "crawledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendingSnapshot" (
    "id" BIGSERIAL NOT NULL,
    "videoId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "category" TEXT,
    "crawledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchResult" (
    "id" BIGSERIAL NOT NULL,
    "videoId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "sort" TEXT NOT NULL DEFAULT 'relevance',
    "crawledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "parentId" TEXT,
    "author" TEXT NOT NULL,
    "avatar" TEXT,
    "content" TEXT NOT NULL,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "repliesCount" INTEGER NOT NULL DEFAULT 0,
    "publishedTimeText" TEXT,
    "crawledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Video_channelId_idx" ON "Video"("channelId");

-- CreateIndex
CREATE INDEX "Video_crawledAt_idx" ON "Video"("crawledAt");

-- CreateIndex
CREATE INDEX "Video_isAvailable_idx" ON "Video"("isAvailable");

-- CreateIndex
CREATE INDEX "TrendingSnapshot_crawledAt_idx" ON "TrendingSnapshot"("crawledAt");

-- CreateIndex
CREATE INDEX "TrendingSnapshot_videoId_crawledAt_idx" ON "TrendingSnapshot"("videoId", "crawledAt");

-- CreateIndex
CREATE INDEX "SearchResult_query_crawledAt_idx" ON "SearchResult"("query", "crawledAt");

-- CreateIndex
CREATE INDEX "SearchResult_videoId_idx" ON "SearchResult"("videoId");

-- CreateIndex
CREATE INDEX "Comment_videoId_idx" ON "Comment"("videoId");

-- CreateIndex
CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");

-- CreateIndex
CREATE INDEX "Comment_videoId_crawledAt_idx" ON "Comment"("videoId", "crawledAt");

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrendingSnapshot" ADD CONSTRAINT "TrendingSnapshot_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchResult" ADD CONSTRAINT "SearchResult_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
