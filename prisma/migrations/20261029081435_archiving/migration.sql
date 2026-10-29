-- AlterTable
ALTER TABLE "Coach" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CustomField" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "archivedAt" TIMESTAMP(3);
