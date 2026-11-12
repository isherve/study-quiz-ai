import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { Difficulty, Quiz } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_TEXT_CHARS = 150_000;

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

// Forcing Claude to call this "tool" guarantees structured JSON output.
const quizTool: Anthropic.Tool = {
  name: "create_quiz",
  description: "Create a multiple-choice quiz from the student's study notes.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short title for the quiz" },
      summary: {
        type: "string",
        description: "2-3 sentence summary of the key ideas in the notes",
      },
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            options: {
              type: "array",
              items: { type: "string" },
              minItems: 4,
              maxItems: 4,
            },
            correctIndex: { type: "integer", minimum: 0, maximum: 3 },
            explanation: {
              type: "string",
              description: "Why the correct answer is right, citing the notes",
            },
            topic: { type: "string", description: "Sub-topic this tests" },
          },
          required: ["question", "options", "correctIndex", "explanation", "topic"],
        },
      },
    },
    required: ["title", "summary", "questions"],
  },
};

export async function POST(req: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Server is missing ANTHROPIC_API_KEY. Add it to .env.local." },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const pastedText = ((form.get("text") as string) || "").trim();
    const numQuestions = clamp(Number(form.get("numQuestions")) || 5, 3, 20);
    const difficulty = (form.get("difficulty") as Difficulty) || "medium";

    // Build the content for Claude: either a PDF document block or plain text.
    const content: Anthropic.ContentBlockParam[] = [];

    if (file && file.size > 0) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: "File is larger than 10 MB." }, { status: 400 });
      }
      const name = file.name.toLowerCase();
      const buffer = Buffer.from(await file.arrayBuffer());

      if (file.type === "application/pdf" || name.endsWith(".pdf")) {
        content.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: buffer.toString("base64"),
          },
        });
      } else if (/\.(txt|md|markdown|csv)$/.test(name) || file.type.startsWith("text/")) {
        content.push({ type: "text", text: `<notes>\n${buffer.toString("utf-8").slice(0, MAX_TEXT_CHARS)}\n</notes>` });
      } else {
        return NextResponse.json(
          { error: "Unsupported file type. Use PDF, TXT or MD." },
          { status: 400 }
        );
      }
    }

    if (pastedText) {
      content.push({ type: "text", text: `<notes>\n${pastedText.slice(0, MAX_TEXT_CHARS)}\n</notes>` });
    }

    if (content.length === 0) {
      return NextResponse.json({ error: "Upload a file or paste some notes." }, { status: 400 });
    }

    content.push({
      type: "text",
      text: `Create a ${difficulty} quiz with exactly ${numQuestions} multiple-choice questions based ONLY on the notes above.
Rules:
- Each question has exactly 4 options and one correct answer.
- Distractors must be plausible, not silly.
- Vary which option position is correct.
- Cover different topics across the notes rather than repeating one idea.
- ${difficultyGuide(difficulty)}
Call the create_quiz tool with the result.`,
    });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system:
        "You are an expert teacher who writes clear, accurate exam questions from a student's notes.",
      tools: [quizTool],
      tool_choice: { type: "tool", name: "create_quiz" },
      messages: [{ role: "user", content }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ error: "The AI did not return a quiz. Try again." }, { status: 502 });
    }

    const quiz = validateQuiz(toolUse.input);
    return NextResponse.json(quiz);
  } catch (err: unknown) {
    console.error(err);
    const message =
      err instanceof Anthropic.APIError
        ? `AI service error (${err.status}): ${err.message}`
        : "Something went wrong generating the quiz.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function difficultyGuide(d: Difficulty) {
  if (d === "easy") return "Easy: test recall of definitions and key facts.";
  if (d === "hard") return "Hard: test application, comparison and reasoning, not just recall.";
  return "Medium: mix recall with understanding of how ideas connect.";
}

// Defensive check so a malformed response never crashes the UI.
function validateQuiz(input: unknown): Quiz {
  const q = input as Quiz;
  if (!q || !Array.isArray(q.questions)) throw new Error("Invalid quiz shape");
  return {
    title: String(q.title || "Your Quiz"),
    summary: String(q.summary || ""),
    questions: q.questions
      .filter(
        (x) =>
          x &&
          Array.isArray(x.options) &&
          x.options.length >= 2 &&
          Number.isInteger(x.correctIndex) &&
          x.correctIndex >= 0 &&
          x.correctIndex < x.options.length
      )
      .map((x) => ({
        question: String(x.question),
        options: x.options.map(String),
        correctIndex: x.correctIndex,
        explanation: String(x.explanation || ""),
        topic: String(x.topic || "General"),
      })),
  };
}
