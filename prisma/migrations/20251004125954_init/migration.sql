-- CreateTable
CREATE TABLE "user_tools" (
    "id" SERIAL NOT NULL,
    "userEmail" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "toolUrl" TEXT NOT NULL,
    "iconUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_tools_pkey" PRIMARY KEY ("id")
);
