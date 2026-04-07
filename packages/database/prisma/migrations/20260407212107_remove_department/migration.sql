-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_departmentId_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "departmentId";

-- DropTable
DROP TABLE "departments";
