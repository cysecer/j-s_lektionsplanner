-- CreateEnum
CREATE TYPE "SmtpSecurity" AS ENUM ('TLS', 'STARTTLS', 'NONE');

-- CreateEnum
CREATE TYPE "MailStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "MailSettings" (
    "clubId" UUID NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "security" "SmtpSecurity" NOT NULL,
    "username" TEXT,
    "passwordEncrypted" TEXT,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailSettings_pkey" PRIMARY KEY ("clubId")
);

-- CreateTable
CREATE TABLE "MailLog" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "lessonId" UUID,
    "recipients" TEXT[],
    "subject" TEXT NOT NULL,
    "status" "MailStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MailLog_clubId_createdAt_idx" ON "MailLog"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "MailLog_userId_createdAt_idx" ON "MailLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MailLog_lessonId_createdAt_idx" ON "MailLog"("lessonId", "createdAt");

-- AddForeignKey
ALTER TABLE "MailSettings" ADD CONSTRAINT "MailSettings_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailLog" ADD CONSTRAINT "MailLog_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailLog" ADD CONSTRAINT "MailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailLog" ADD CONSTRAINT "MailLog_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Sanity limits (also validated in src/lib/mail/settings-schema.ts).
ALTER TABLE "MailSettings" ADD CONSTRAINT "MailSettings_port_range" CHECK ("port" BETWEEN 1 AND 65535);
ALTER TABLE "MailLog" ADD CONSTRAINT "MailLog_recipients_count" CHECK (cardinality("recipients") BETWEEN 1 AND 50);
