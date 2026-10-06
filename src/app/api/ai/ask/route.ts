import { getCurrentUser } from "@/server/auth/session";
import { getBranchScope } from "@/server/branch-scope";
import { runKiran } from "@/ai/runner/kiran.runner";
import { db } from "@/server/db";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "AI not configured — add OPENAI_API_KEY to .env" }, { status: 503 });
  }

  const body = (await request.json()) as { question?: unknown };
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return Response.json({ error: "question is required" }, { status: 400 });
  }
  if (question.length > 1000) {
    return Response.json({ error: "Question too long" }, { status: 400 });
  }

  const scope = await getBranchScope(user);
  const startedAt = Date.now();

  let answer = "";
  let tokensUsed: number | undefined;
  let error: string | undefined;

  try {
    const result = await runKiran(question, scope, user.name);
    answer = result.answer;
    tokensUsed = result.tokensUsed;
  } catch (e) {
    error = String(e);
    await db.aiAgentRun.create({
      data: {
        agentName: "kiran",
        userId: user.id,
        branchId: scope.branchId,
        question,
        answer: "",
        error,
        durationMs: Date.now() - startedAt,
      },
    });
    return Response.json({ error: "AI request failed. Please try again." }, { status: 500 });
  }

  await db.aiAgentRun.create({
    data: {
      agentName: "kiran",
      userId: user.id,
      branchId: scope.branchId,
      question,
      answer,
      tokensUsed,
      durationMs: Date.now() - startedAt,
    },
  });

  return Response.json({ answer });
}
