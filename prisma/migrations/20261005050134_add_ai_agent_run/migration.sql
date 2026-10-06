-- CreateTable
CREATE TABLE "ai_agent_run" (
    "id" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "tokensUsed" INTEGER,
    "durationMs" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_agent_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_agent_run_userId_createdAt_idx" ON "ai_agent_run"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_agent_run_agentName_createdAt_idx" ON "ai_agent_run"("agentName", "createdAt");
