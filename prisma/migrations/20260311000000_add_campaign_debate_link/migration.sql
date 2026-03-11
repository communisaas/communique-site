-- AlterTable
ALTER TABLE "campaign" ADD COLUMN "debate_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "campaign_debate_id_key" ON "campaign"("debate_id");

-- AddForeignKey
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
