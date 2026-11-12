import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI, Type } from "@google/genai";

/**
 * One piece of study material: either a PDF (base64) or plain text.
 */
export type Material =
  | { kind: "pdf"; base64: string }
  | { kind: "text"; text: string };

const SYSTEM =
  "You are an expert teacher who writes clear, accurate exam questions from a student's notes.";

/**
 * Picks the AI provider from your .env.local:
 *  - GEMINI_API_KEY set     -> Google Gemini (has a FREE tier)
 *  - ANTHROPIC_API_KEY set  -> Claude (paid)
 * Force one with AI_PROVIDER=gemini or AI_PROVIDER=anthropic.
 */
export function getProvider(): "gemini" | "anthropic" | null {
  const forced = process.env.AI_PROVIDER?.toLowerCase();
  if (forced === "gemini" || forced === "anthropic") return forced;
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export async function generateQuizJSON(materials: Material[], instructions: string): Promise<unknown> {
  const provider = getProvider();
  if (provider === "gemini") return withGemini(materials, instructions);
  if (provider === "anthropic") return withClaude(materials, instructions);
  throw new Error("NO_KEY");
}

// ---------------- Google Gemini (free tier) ----------------

async function withGemini(materials: Material[], instructions: string) {
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, apiVersion: "v1beta" });  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const parts = materials.map((m) =>
    m.kind === "pdf"
      ? { inlineData: { mimeType: "application/pdf", data: m.base64 } }
      : { text: `<notes>\n${m.text}\n</notes>` }
  );
  parts.push({ text: instructions });

  // responseSchema forces Gemini to reply with JSON in exactly this shape.
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctIndex: { type: Type.INTEGER },
                explanation: { type: Type.STRING },
                topic: { type: Type.STRING },
              },
              required: ["question", "options", "correctIndex", "explanation", "topic"],
              propertyOrdering: ["question", "options", "correctIndex", "explanation", "topic"],
            },
          },
        },
        required: ["title", "summary", "questions"],
        propertyOrdering: ["title", "summary", "questions"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response.");
  return JSON.parse(text);
}

// ---------------- Anthropic Claude (paid) ----------------

const quizTool: Anthropic.Tool = {
  name: "create_quiz",
  description: "Create a multiple-choice quiz from the student's study notes.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
            correctIndex: { type: "integer", minimum: 0, maximum: 3 },
            explanation: { type: "string" },
            topic: { type: "string" },
          },
          required: ["question", "options", "correctIndex", "explanation", "topic"],
        },
      },
    },
    required: ["title", "summary", "questions"],
  },
};

async function withClaude(materials: Material[], instructions: string) {
  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

  const content: Anthropic.ContentBlockParam[] = materials.map((m) =>
    m.kind === "pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: m.base64 } }
      : { type: "text", text: `<notes>\n${m.text}\n</notes>` }
  );
  content.push({ type: "text", text: instructions + "\nCall the create_quiz tool with the result." });

  // Forced tool use guarantees Claude replies in the schema above.
  const response = await client.messages.create({
    model,
    max_tokens: 8000,
    system: SYSTEM,
    tools: [quizTool],
    tool_choice: { type: "tool", name: "create_quiz" },
    messages: [{ role: "user", content }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Claude did not return a quiz.");
  return toolUse.input;
}
