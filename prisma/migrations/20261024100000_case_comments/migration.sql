-- CreateTable
CREATE TABLE "case_comment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "case_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_comment_mention" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "readAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_comment_mention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_comment_caseId_createdAt_idx" ON "case_comment"("caseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "case_comment_mention_commentId_userId_key" ON "case_comment_mention"("commentId", "userId");

-- CreateIndex
CREATE INDEX "case_comment_mention_userId_readAt_idx" ON "case_comment_mention"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "case_comment" ADD CONSTRAINT "case_comment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "service_case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_comment" ADD CONSTRAINT "case_comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_comment" ADD CONSTRAINT "case_comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "case_comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_comment_mention" ADD CONSTRAINT "case_comment_mention_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "case_comment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_comment_mention" ADD CONSTRAINT "case_comment_mention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
