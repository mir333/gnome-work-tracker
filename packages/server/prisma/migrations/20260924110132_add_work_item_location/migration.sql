-- AlterTable
ALTER TABLE "WorkItem" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "WorkItem" ADD COLUMN "location" TEXT;
ALTER TABLE "WorkItem" ADD COLUMN "locationSource" TEXT;

-- CreateTable
CREATE TABLE "IpLocationCache" (
    "ip" TEXT NOT NULL PRIMARY KEY,
    "location" TEXT NOT NULL,
    "cachedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
