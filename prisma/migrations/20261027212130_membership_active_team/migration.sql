-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "activeTeamId" UUID;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_activeTeamId_fkey" FOREIGN KEY ("activeTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
