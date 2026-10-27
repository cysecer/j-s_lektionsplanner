-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'DEMANDING');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('DRAFT', 'FINAL');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'LIST', 'NUMBER', 'IMAGE');

-- CreateEnum
CREATE TYPE "BuiltinSection" AS ENUM ('INTRO', 'MAIN', 'END');

-- CreateTable
CREATE TABLE "Club" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "logoAssetId" UUID,
    "pdfFooterText" TEXT,
    "defaultLayoutId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coach" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachTeam" (
    "coachId" UUID NOT NULL,
    "teamId" UUID NOT NULL,

    CONSTRAINT "CoachTeam_pkey" PRIMARY KEY ("coachId","teamId")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "builtin" "BuiltinSection",
    "name" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomField" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "type" "CustomFieldType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "searchable" BOOLEAN NOT NULL DEFAULT true,
    "filterable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Layout" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Layout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramBlock" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "durationMinutes" INTEGER,
    "description" JSONB,
    "rules" JSONB,
    "variations" TEXT[],
    "organization" JSONB,
    "material" TEXT[],
    "responsibleCoachId" UUID,
    "responsibleText" TEXT,
    "suggestedSectionId" UUID,
    "ageMin" INTEGER,
    "ageMax" INTEGER,
    "difficulty" "Difficulty",
    "customValues" JSONB NOT NULL DEFAULT '{}',
    "searchText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramBlockTeam" (
    "blockId" UUID NOT NULL,
    "teamId" UUID NOT NULL,

    CONSTRAINT "ProgramBlockTeam_pkey" PRIMARY KEY ("blockId","teamId")
);

-- CreateTable
CREATE TABLE "ProgramBlockTag" (
    "blockId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "ProgramBlockTag_pkey" PRIMARY KEY ("blockId","tagId")
);

-- CreateTable
CREATE TABLE "ProgramBlockSketch" (
    "blockId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProgramBlockSketch_pkey" PRIMARY KEY ("blockId","assetId")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "teamId" UUID,
    "layoutId" UUID,
    "title" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTimeMinutes" INTEGER,
    "totalDurationMinutes" INTEGER,
    "location" TEXT,
    "ageMin" INTEGER,
    "ageMax" INTEGER,
    "groupSize" TEXT,
    "difficulty" "Difficulty",
    "safety" JSONB,
    "goals" JSONB,
    "notes" JSONB,
    "status" "LessonStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonCoach" (
    "lessonId" UUID NOT NULL,
    "coachId" UUID NOT NULL,

    CONSTRAINT "LessonCoach_pkey" PRIMARY KEY ("lessonId","coachId")
);

-- CreateTable
CREATE TABLE "LessonItem" (
    "id" UUID NOT NULL,
    "lessonId" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "sourceBlockId" UUID,
    "modifiedLocally" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "durationMinutes" INTEGER,
    "description" JSONB,
    "rules" JSONB,
    "variations" TEXT[],
    "organization" JSONB,
    "material" TEXT[],
    "responsibleCoachId" UUID,
    "responsibleText" TEXT,
    "customValues" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonItemSketch" (
    "itemId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LessonItemSketch_pkey" PRIMARY KEY ("itemId","assetId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Club_logoAssetId_key" ON "Club"("logoAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "Club_defaultLayoutId_key" ON "Club"("defaultLayoutId");

-- CreateIndex
CREATE INDEX "Team_clubId_sortOrder_idx" ON "Team"("clubId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Team_clubId_name_key" ON "Team"("clubId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Coach_clubId_name_key" ON "Coach"("clubId", "name");

-- CreateIndex
CREATE INDEX "CoachTeam_teamId_idx" ON "CoachTeam"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_clubId_name_key" ON "Tag"("clubId", "name");

-- CreateIndex
CREATE INDEX "Section_clubId_sortOrder_idx" ON "Section"("clubId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Section_clubId_builtin_key" ON "Section"("clubId", "builtin");

-- CreateIndex
CREATE INDEX "CustomField_clubId_sortOrder_idx" ON "CustomField"("clubId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CustomField_clubId_label_key" ON "CustomField"("clubId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Layout_clubId_name_key" ON "Layout"("clubId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_storageKey_key" ON "Asset"("storageKey");

-- CreateIndex
CREATE INDEX "Asset_clubId_idx" ON "Asset"("clubId");

-- CreateIndex
CREATE INDEX "ProgramBlock_clubId_title_idx" ON "ProgramBlock"("clubId", "title");

-- CreateIndex
CREATE INDEX "ProgramBlock_clubId_durationMinutes_idx" ON "ProgramBlock"("clubId", "durationMinutes");

-- CreateIndex
CREATE INDEX "ProgramBlockTeam_teamId_idx" ON "ProgramBlockTeam"("teamId");

-- CreateIndex
CREATE INDEX "ProgramBlockTag_tagId_idx" ON "ProgramBlockTag"("tagId");

-- CreateIndex
CREATE INDEX "ProgramBlockSketch_assetId_idx" ON "ProgramBlockSketch"("assetId");

-- CreateIndex
CREATE INDEX "Lesson_clubId_date_idx" ON "Lesson"("clubId", "date");

-- CreateIndex
CREATE INDEX "Lesson_clubId_teamId_date_idx" ON "Lesson"("clubId", "teamId", "date");

-- CreateIndex
CREATE INDEX "LessonCoach_coachId_idx" ON "LessonCoach"("coachId");

-- CreateIndex
CREATE INDEX "LessonItem_lessonId_sectionId_sortOrder_idx" ON "LessonItem"("lessonId", "sectionId", "sortOrder");

-- CreateIndex
CREATE INDEX "LessonItem_sourceBlockId_idx" ON "LessonItem"("sourceBlockId");

-- CreateIndex
CREATE INDEX "LessonItemSketch_assetId_idx" ON "LessonItemSketch"("assetId");

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_logoAssetId_fkey" FOREIGN KEY ("logoAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_defaultLayoutId_fkey" FOREIGN KEY ("defaultLayoutId") REFERENCES "Layout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachTeam" ADD CONSTRAINT "CoachTeam_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachTeam" ADD CONSTRAINT "CoachTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomField" ADD CONSTRAINT "CustomField_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Layout" ADD CONSTRAINT "Layout_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramBlock" ADD CONSTRAINT "ProgramBlock_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramBlock" ADD CONSTRAINT "ProgramBlock_responsibleCoachId_fkey" FOREIGN KEY ("responsibleCoachId") REFERENCES "Coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramBlock" ADD CONSTRAINT "ProgramBlock_suggestedSectionId_fkey" FOREIGN KEY ("suggestedSectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramBlockTeam" ADD CONSTRAINT "ProgramBlockTeam_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "ProgramBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramBlockTeam" ADD CONSTRAINT "ProgramBlockTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramBlockTag" ADD CONSTRAINT "ProgramBlockTag_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "ProgramBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramBlockTag" ADD CONSTRAINT "ProgramBlockTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramBlockSketch" ADD CONSTRAINT "ProgramBlockSketch_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "ProgramBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramBlockSketch" ADD CONSTRAINT "ProgramBlockSketch_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "Layout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonCoach" ADD CONSTRAINT "LessonCoach_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonCoach" ADD CONSTRAINT "LessonCoach_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonItem" ADD CONSTRAINT "LessonItem_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonItem" ADD CONSTRAINT "LessonItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonItem" ADD CONSTRAINT "LessonItem_sourceBlockId_fkey" FOREIGN KEY ("sourceBlockId") REFERENCES "ProgramBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonItem" ADD CONSTRAINT "LessonItem_responsibleCoachId_fkey" FOREIGN KEY ("responsibleCoachId") REFERENCES "Coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonItemSketch" ADD CONSTRAINT "LessonItemSketch_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "LessonItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonItemSketch" ADD CONSTRAINT "LessonItemSketch_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written additions (not expressible in schema.prisma)
-- ---------------------------------------------------------------------------

-- German full-text search over program blocks
CREATE INDEX "ProgramBlock_searchText_fts_idx"
  ON "ProgramBlock" USING GIN (to_tsvector('german', "searchText"));

-- Defence in depth: the app validates all input with zod, the database
-- additionally rejects impossible values.
ALTER TABLE "ProgramBlock"
  ADD CONSTRAINT "ProgramBlock_duration_check" CHECK ("durationMinutes" IS NULL OR "durationMinutes" BETWEEN 0 AND 600),
  ADD CONSTRAINT "ProgramBlock_age_check" CHECK (
    ("ageMin" IS NULL OR "ageMin" BETWEEN 0 AND 120)
    AND ("ageMax" IS NULL OR "ageMax" BETWEEN 0 AND 120)
    AND ("ageMin" IS NULL OR "ageMax" IS NULL OR "ageMin" <= "ageMax")
  ),
  ADD CONSTRAINT "ProgramBlock_responsible_check" CHECK ("responsibleCoachId" IS NULL OR "responsibleText" IS NULL);

ALTER TABLE "LessonItem"
  ADD CONSTRAINT "LessonItem_duration_check" CHECK ("durationMinutes" IS NULL OR "durationMinutes" BETWEEN 0 AND 600),
  ADD CONSTRAINT "LessonItem_sortOrder_check" CHECK ("sortOrder" >= 0),
  ADD CONSTRAINT "LessonItem_responsible_check" CHECK ("responsibleCoachId" IS NULL OR "responsibleText" IS NULL);

ALTER TABLE "Lesson"
  ADD CONSTRAINT "Lesson_startTime_check" CHECK ("startTimeMinutes" IS NULL OR "startTimeMinutes" BETWEEN 0 AND 1439),
  ADD CONSTRAINT "Lesson_totalDuration_check" CHECK ("totalDurationMinutes" IS NULL OR "totalDurationMinutes" BETWEEN 0 AND 1440),
  ADD CONSTRAINT "Lesson_age_check" CHECK (
    ("ageMin" IS NULL OR "ageMin" BETWEEN 0 AND 120)
    AND ("ageMax" IS NULL OR "ageMax" BETWEEN 0 AND 120)
    AND ("ageMin" IS NULL OR "ageMax" IS NULL OR "ageMin" <= "ageMax")
  );

ALTER TABLE "Section"
  ADD CONSTRAINT "Section_name_check" CHECK ("builtin" IS NOT NULL OR "name" IS NOT NULL);

ALTER TABLE "Asset"
  ADD CONSTRAINT "Asset_size_check" CHECK ("width" > 0 AND "height" > 0 AND "byteSize" > 0);
