# StudyQuiz AI 🧠

Upload your study notes (PDF, TXT, MD, or pasted text) and get an interactive multiple-choice quiz with explanations, scoring and a list of topics to review. Built with **Next.js 15** and **Google Gemini (free tier)**, with optional support for the Claude API.

## Features
- 📄 Drag-and-drop upload for **PDF**, TXT and Markdown, or paste text
- ⚙️ Choose the number of questions (3–20) and the difficulty (easy, medium, hard)
- ✅ Instant feedback on each answer, with an explanation
- 📊 Results screen with your score, the weak topics to review and a full answer review
- 🔁 Retry the same quiz, or generate fresh questions from the same notes
- 🌗 Automatic dark mode

## Getting started
```bash
npm install
cp .env.example .env.local   # then paste your free Gemini key into it
npm run dev
```
Open http://localhost:3000.

Get a **free** Gemini API key at https://aistudio.google.com/apikey (Google account, no credit card).
The free tier has per-minute and per-day request limits. If you see "limit reached", wait a minute.

## How it works
```
Browser (app/page.tsx)
   │  FormData: file / text, numQuestions, difficulty
   ▼
API route (app/api/generate-quiz/route.ts)
   │  PDF  → sent to the AI as a native document
   │  text → wrapped in <notes> tags
   ▼
lib/ai.ts → Gemini (responseSchema) or Claude (forced tool use) → guaranteed JSON shape
   ▼
Validated Quiz JSON → QuizPlayer component (components/QuizPlayer.tsx)
```

The trick for reliable output is a **JSON schema**. Gemini's `responseSchema` (and, for Claude, forced tool use) makes the AI always return data in the exact shape the UI expects. A `validateQuiz()` check then guards against malformed items.

## Project structure
```
app/
  api/generate-quiz/route.ts   # server: calls Claude
  page.tsx                     # upload + settings UI
  layout.tsx, globals.css
components/QuizPlayer.tsx      # quiz, feedback, results
lib/ai.ts                      # Gemini / Claude providers
lib/types.ts                   # shared TypeScript types
```

## Deploy
Push to GitHub and import the repo at https://vercel.com, then add `GEMINI_API_KEY` under Environment Variables.

## Ideas to extend
- [ ] Sign-in plus a database (Supabase) to save quizzes and track scores over time
- [ ] Flashcard mode and spaced repetition
- [ ] More question types: true/false, fill-in-the-blank, short answer graded by AI
- [ ] Export a quiz to PDF, or share it by link
- [ ] Rate limiting so your API key can't be abused
- [ ] Support for .docx files (e.g. with `mammoth`)
