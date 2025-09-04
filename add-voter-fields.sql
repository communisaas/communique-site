-- DropForeignKey
ALTER TABLE "certification_log" DROP CONSTRAINT "certification_log_user_id_fkey";

-- DropIndex
DROP INDEX "user_voter_address_key";

-- AlterTable
ALTER TABLE "user" DROP COLUMN "voter_address",
DROP COLUMN "voter_reputation";

-- DropTable
DROP TABLE "certification_log";

