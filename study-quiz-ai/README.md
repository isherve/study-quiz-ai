# StudyQuiz AI 🧠

Upload your study notes (PDF, TXT, MD, or pasted text) and get an interactive multiple-choice quiz with explanations, scoring and a list of topics to review. Built with **Next.js 15** and the **Claude API**.

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
cp .env.example .env.local   # then paste your Anthropic API key into it
npm run dev
```
Open http://localhost:3000.

Get an API key at https://console.anthropic.com.

## How it works
```
Browser (app/page.tsx)
   │  FormData: file / text, numQuestions, difficulty
   ▼
API route (app/api/generate-quiz/route.ts)
   │  PDF  → sent to Claude as a native document block
   │  text → wrapped in <notes> tags
   │  Claude is forced to call the `create_quiz` tool → guaranteed JSON shape
   ▼
Validated Quiz JSON → QuizPlayer component (components/QuizPlayer.tsx)
```

The trick for reliable structured output is **forced tool use**. The route defines a `create_quiz` tool with a JSON schema and sets `tool_choice` to that tool, so Claude always returns data in that exact shape. A `validateQuiz()` check then guards against malformed items.

## Project structure
```
app/
  api/generate-quiz/route.ts   # server: calls Claude
  page.tsx                     # upload + settings UI
  layout.tsx, globals.css
components/QuizPlayer.tsx      # quiz, feedback, results
lib/types.ts                   # shared TypeScript types
```

## Deploy
Push to GitHub and import the repo at https://vercel.com, then add `ANTHROPIC_API_KEY` under Environment Variables.

## Ideas to extend
- [ ] Sign-in plus a database (Supabase) to save quizzes and track scores over time
- [ ] Flashcard mode and spaced repetition
- [ ] More question types: true/false, fill-in-the-blank, short answer graded by AI
- [ ] Export a quiz to PDF, or share it by link
- [ ] Rate limiting so your API key can't be abused
- [ ] Support for .docx files (e.g. with `mammoth`)
