-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "readerPdfDailyLimit" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "PdfExport" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "lessonId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdfExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PdfExport_userId_createdAt_idx" ON "PdfExport"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PdfExport_createdAt_idx" ON "PdfExport"("createdAt");

-- AddForeignKey
ALTER TABLE "PdfExport" ADD CONSTRAINT "PdfExport_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfExport" ADD CONSTRAINT "PdfExport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfExport" ADD CONSTRAINT "PdfExport_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Reader quota: 0 (readers cannot export) up to 1000 per day.
ALTER TABLE "Club" ADD CONSTRAINT "Club_readerPdfDailyLimit_range" CHECK ("readerPdfDailyLimit" BETWEEN 0 AND 1000);
