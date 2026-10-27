-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "defaultDurationMinutes" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "defaultStartTimeMinutes" INTEGER NOT NULL DEFAULT 1080;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "defaultDurationMinutes" INTEGER,
ADD COLUMN     "defaultStartTimeMinutes" INTEGER;

ALTER TABLE "Club"
  ADD CONSTRAINT "Club_defaultStartTime_check" CHECK ("defaultStartTimeMinutes" BETWEEN 0 AND 1439),
  ADD CONSTRAINT "Club_defaultDuration_check" CHECK ("defaultDurationMinutes" BETWEEN 1 AND 1440);

ALTER TABLE "Team"
  ADD CONSTRAINT "Team_defaultStartTime_check" CHECK ("defaultStartTimeMinutes" IS NULL OR "defaultStartTimeMinutes" BETWEEN 0 AND 1439),
  ADD CONSTRAINT "Team_defaultDuration_check" CHECK ("defaultDurationMinutes" IS NULL OR "defaultDurationMinutes" BETWEEN 1 AND 1440);
