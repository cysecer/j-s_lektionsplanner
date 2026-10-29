-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('COACH', 'READER');

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "allTeamsRole" "TeamRole";

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "allTeamsRole" "TeamRole";

-- CreateTable
CREATE TABLE "MembershipTeam" (
    "membershipId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "role" "TeamRole" NOT NULL,

    CONSTRAINT "MembershipTeam_pkey" PRIMARY KEY ("membershipId","teamId")
);

-- CreateTable
CREATE TABLE "InvitationTeam" (
    "invitationId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "role" "TeamRole" NOT NULL,

    CONSTRAINT "InvitationTeam_pkey" PRIMARY KEY ("invitationId","teamId")
);

-- CreateIndex
CREATE INDEX "MembershipTeam_teamId_idx" ON "MembershipTeam"("teamId");

-- CreateIndex
CREATE INDEX "InvitationTeam_teamId_idx" ON "InvitationTeam"("teamId");

-- AddForeignKey
ALTER TABLE "MembershipTeam" ADD CONSTRAINT "MembershipTeam_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipTeam" ADD CONSTRAINT "MembershipTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationTeam" ADD CONSTRAINT "InvitationTeam_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationTeam" ADD CONSTRAINT "InvitationTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Existing people keep exactly what they had: their role for all teams.
UPDATE "Membership" SET "allTeamsRole" = "role"::text::"TeamRole" WHERE "role" <> 'ADMIN';
UPDATE "Invitation" SET "allTeamsRole" = "role"::text::"TeamRole" WHERE "role" <> 'ADMIN';
