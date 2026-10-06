import "server-only";
import type OpenAI from "openai";
import { getOpenAI } from "@/lib/openai";
import {
  KIRAN_TOOL_DEFINITIONS,
  executeKiranTool,
} from "@/ai/tools/kiran.tools";
import type { BranchScope } from "@/server/branch-scope";

const MAX_ROUNDS = 8;

function systemPrompt(branchName: string | null, userName: string): string {
  const scope = branchName
    ? `You are viewing data for the **${branchName}** branch only.`
    : "You can see data across all branches.";

  const now = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date());

  return `You are Kiran, the AI assistant for Laptop Clinic CRM.
The user is ${userName}. ${scope}
Current date/time (IST): ${now}.

Rules:
1. Only report numbers returned by your tools. Never invent or estimate data.
2. Always show exact figures prominently — lead with the number, then the context.
3. Money is stored in paise (₹1 = 100 paise). Always display as ₹ with Indian comma formatting, e.g. ₹8,42,000.
4. Be concise. One short paragraph or a bullet list is enough unless the user asks for more.
5. If data is not available or the question is outside your tools, say so honestly.
6. Never reveal device passwords, internal IDs, or raw database field names.`;
}

export async function runKiran(
  question: string,
  scope: BranchScope,
  userName: string,
): Promise<{ answer: string; tokensUsed: number }> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: systemPrompt(scope.branch?.name ?? null, userName),
    },
    { role: "user", content: question },
  ];

  let totalTokens = 0;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools: KIRAN_TOOL_DEFINITIONS,
      tool_choice: "auto",
    });

    totalTokens += response.usage?.total_tokens ?? 0;
    const choice = response.choices[0];

    if (!choice) break;

    if (choice.finish_reason === "stop" || !choice.message.tool_calls?.length) {
      return { answer: choice.message.content ?? "", tokensUsed: totalTokens };
    }

    // Append assistant message with tool calls
    messages.push(choice.message as OpenAI.ChatCompletionMessageParam);

    // Execute each tool call and append results
    await Promise.all(
      choice.message.tool_calls.map(async (tc) => {
        // tc is ChatCompletionMessageToolCall which always has .function for function-type tools
        const fn = (
          tc as { id: string; function: { name: string; arguments: string } }
        ).function;
        let result: unknown;
        try {
          const args = JSON.parse(fn.arguments) as Record<string, unknown>;
          result = await executeKiranTool(fn.name, args, scope);
        } catch (e) {
          result = { error: String(e) };
        }
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }),
    );
  }

  // Fell through max rounds — ask for a final answer with what we have
  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  const content =
    typeof lastAssistant?.content === "string"
      ? lastAssistant.content
      : "I couldn't complete the analysis. Please try a more specific question.";
  return { answer: content, tokensUsed: totalTokens };
}
