/*
  Warnings:

  - A unique constraint covering the columns `[userEmail,categoryId,toolName]` on the table `user_tools` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "user_tools_userEmail_categoryId_toolName_key" ON "user_tools"("userEmail", "categoryId", "toolName");
