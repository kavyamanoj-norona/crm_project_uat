/*
  Warnings:

  - You are about to drop the column `isPrimaryAdmin` on the `user` table. Access now comes only from the privilege (isSuperAdmin).

*/
-- AlterTable
ALTER TABLE "user" DROP COLUMN "isPrimaryAdmin";
