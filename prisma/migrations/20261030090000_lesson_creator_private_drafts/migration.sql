-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "createdById" UUID;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "privateDrafts" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Lesson_createdById_idx" ON "Lesson"("createdById");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Best-effort backfill: existing lessons get a creator when their author
-- name matches exactly one account of the club (by linked coach or user name).
WITH candidates AS (
  SELECT l."id" AS lesson_id, m."userId" AS user_id
  FROM "Lesson" l
  JOIN "Membership" m ON m."clubId" = l."clubId"
  JOIN "user" u ON u."id" = m."userId"
  LEFT JOIN "Coach" c ON c."id" = m."coachId"
  WHERE l."createdById" IS NULL
    AND (lower(u."name") = lower(l."authorName") OR lower(c."name") = lower(l."authorName"))
),
unique_match AS (
  SELECT lesson_id, min(user_id::text)::uuid AS user_id
  FROM candidates
  GROUP BY lesson_id
  HAVING count(DISTINCT user_id) = 1
)
UPDATE "Lesson" l SET "createdById" = um.user_id
FROM unique_match um
WHERE l."id" = um.lesson_id;
