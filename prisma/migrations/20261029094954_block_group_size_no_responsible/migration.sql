-- Responsible person moves from the library block to the lesson item.
ALTER TABLE "ProgramBlock" DROP CONSTRAINT IF EXISTS "ProgramBlock_responsible_check";

-- DropForeignKey
ALTER TABLE "ProgramBlock" DROP CONSTRAINT "ProgramBlock_responsibleCoachId_fkey";

-- AlterTable
ALTER TABLE "LessonItem" ADD COLUMN     "maxParticipants" INTEGER,
ADD COLUMN     "minParticipants" INTEGER,
ADD COLUMN     "teamCount" INTEGER;

-- AlterTable
ALTER TABLE "ProgramBlock" DROP COLUMN "responsibleCoachId",
DROP COLUMN "responsibleText",
ADD COLUMN     "maxParticipants" INTEGER,
ADD COLUMN     "minParticipants" INTEGER,
ADD COLUMN     "teamCount" INTEGER;


-- Group size and team count: positive, bounded, min <= max.
ALTER TABLE "ProgramBlock"
  ADD CONSTRAINT "ProgramBlock_teamCount_check" CHECK ("teamCount" IS NULL OR "teamCount" BETWEEN 1 AND 50),
  ADD CONSTRAINT "ProgramBlock_participants_check" CHECK (
    ("minParticipants" IS NULL OR "minParticipants" BETWEEN 1 AND 500)
    AND ("maxParticipants" IS NULL OR "maxParticipants" BETWEEN 1 AND 500)
    AND ("minParticipants" IS NULL OR "maxParticipants" IS NULL OR "minParticipants" <= "maxParticipants")
  );

ALTER TABLE "LessonItem"
  ADD CONSTRAINT "LessonItem_teamCount_check" CHECK ("teamCount" IS NULL OR "teamCount" BETWEEN 1 AND 50),
  ADD CONSTRAINT "LessonItem_participants_check" CHECK (
    ("minParticipants" IS NULL OR "minParticipants" BETWEEN 1 AND 500)
    AND ("maxParticipants" IS NULL OR "maxParticipants" BETWEEN 1 AND 500)
    AND ("minParticipants" IS NULL OR "maxParticipants" IS NULL OR "minParticipants" <= "maxParticipants")
  );
