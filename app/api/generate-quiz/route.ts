import { NextResponse } from "next/server";
import { generateQuizJSON, getProvider, type Material } from "@/lib/ai";
import type { Difficulty, Quiz } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_TEXT_CHARS = 150_000;

export async function POST(req: Request) {
  try {
    if (!getProvider()) {
      return NextResponse.json(
        { error: "No API key found. Add GEMINI_API_KEY (free) to .env.local, then restart the server." },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const pastedText = ((form.get("text") as string) || "").trim();
    const numQuestions = clamp(Number(form.get("numQuestions")) || 5, 3, 20);
    const difficulty = (form.get("difficulty") as Difficulty) || "medium";

    const materials: Material[] = [];

    if (file && file.size > 0) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: "File is larger than 10 MB." }, { status: 400 });
      }
      const name = file.name.toLowerCase();
      const buffer = Buffer.from(await file.arrayBuffer());

      if (file.type === "application/pdf" || name.endsWith(".pdf")) {
        materials.push({ kind: "pdf", base64: buffer.toString("base64") });
      } else if (/\.(txt|md|markdown|csv)$/.test(name) || file.type.startsWith("text/")) {
        materials.push({ kind: "text", text: buffer.toString("utf-8").slice(0, MAX_TEXT_CHARS) });
      } else {
        return NextResponse.json({ error: "Unsupported file type. Use PDF, TXT or MD." }, { status: 400 });
      }
    }

    if (pastedText) materials.push({ kind: "text", text: pastedText.slice(0, MAX_TEXT_CHARS) });

    if (materials.length === 0) {
      return NextResponse.json({ error: "Upload a file or paste some notes." }, { status: 400 });
    }

    const instructions = `Create a ${difficulty} quiz with exactly ${numQuestions} multiple-choice questions based ONLY on the notes above.
Rules:
- Each question has exactly 4 options and one correct answer; correctIndex is 0-3.
- Distractors must be plausible, not silly.
- Vary which option position is correct.
- Cover different topics across the notes rather than repeating one idea.
- ${difficultyGuide(difficulty)}
- The summary is 2-3 sentences on the key ideas. Each explanation says why the answer is right, using the notes.`;

    const raw = await generateQuizJSON(materials, instructions);
    return NextResponse.json(validateQuiz(raw));
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ error: friendlyError(err) }, { status: 500 });
  }
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/429|RESOURCE_EXHAUSTED|rate/i.test(msg))
    return "Free-tier limit reached. Wait a minute and try again.";
  if (/API key not valid|API_KEY_INVALID|401|invalid x-api-key/i.test(msg))
    return "Your API key is invalid. Check the key in .env.local and restart the server.";
  if (/404|not found/i.test(msg) && /model/i.test(msg))
    return "That AI model isn't available. Set GEMINI_MODEL in .env.local to a model listed in Google AI Studio.";
  if (/credit balance/i.test(msg)) return "Your Anthropic account has no credits. Use a free Gemini key instead.";
  return `AI error: ${msg.slice(0, 300)}`;
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
  if (!q || !Array.isArray(q.questions)) throw new Error("The AI returned an invalid quiz. Try again.");
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
