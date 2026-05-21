/*
  Warnings:

  - You are about to drop the column `email` on the `OrganisationInvite` table. All the data in the column will be lost.
  - Added the required column `targetUserId` to the `OrganisationInvite` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OrganisationInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invitedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrganisationInvite_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrganisationInvite_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrganisationInvite_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OrganisationInvite" ("createdAt", "id", "invitedBy", "orgId", "status", "updatedAt") SELECT "createdAt", "id", "invitedBy", "orgId", "status", "updatedAt" FROM "OrganisationInvite";
DROP TABLE "OrganisationInvite";
ALTER TABLE "new_OrganisationInvite" RENAME TO "OrganisationInvite";
CREATE UNIQUE INDEX "OrganisationInvite_orgId_targetUserId_key" ON "OrganisationInvite"("orgId", "targetUserId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
