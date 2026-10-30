-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "faviconAssetId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "Club_faviconAssetId_key" ON "Club"("faviconAssetId");

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_faviconAssetId_fkey" FOREIGN KEY ("faviconAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

