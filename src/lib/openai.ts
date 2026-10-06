import "server-only";
import OpenAI from "openai";

/** Call this inside a route handler or server action — not at module scope. */
export function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set in .env");
  return new OpenAI({ apiKey });
}
