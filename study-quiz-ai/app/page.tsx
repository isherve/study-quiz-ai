"use client";

import { useRef, useState } from "react";
import QuizPlayer from "@/components/QuizPlayer";
import type { Difficulty, Quiz } from "@/lib/types";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function generate() {
    setError(null);
    if (!file && !text.trim()) {
      setError("Upload a file or paste your notes first.");
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      if (file) form.append("file", file);
      form.append("text", text);
      form.append("numQuestions", String(numQuestions));
      form.append("difficulty", difficulty);

      const res = await fetch("/api/generate-quiz", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      if (!data.questions?.length) throw new Error("No questions were generated. Try more detailed notes.");
      setQuiz(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }

  if (quiz) {
    return (
      <main className="container">
        <QuizPlayer quiz={quiz} onRestart={() => setQuiz(null)} onRegenerate={generate} />
      </main>
    );
  }

  return (
    <main className="container">
      <header className="hero">
        <h1>StudyQuiz <span className="accent">AI</span></h1>
        <p>Upload your notes and get a practice quiz with explanations in seconds.</p>
      </header>

      <section className="card">
        <div
          className={`dropzone ${dragging ? "dragging" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.txt,.md,.markdown"
            hidden
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          {file ? (
            <div>
              <strong>📄 {file.name}</strong>
              <div className="muted">{(file.size / 1024).toFixed(0)} KB</div>
              <button
                className="link"
                onClick={(e) => { e.stopPropagation(); setFile(null); if (inputRef.current) inputRef.current.value = ""; }}
              >
                Remove
              </button>
            </div>
          ) : (
            <div>
              <strong>Drop a PDF, TXT or MD file here</strong>
              <div className="muted">or click to browse (max 10 MB)</div>
            </div>
          )}
        </div>

        <div className="divider"><span>or paste notes</span></div>

        <textarea
          placeholder="Paste your study notes here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
        />

        <div className="options">
          <label>
            Questions
            <select value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value))}>
              {[3, 5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label>
            Difficulty
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
        </div>

        {error && <div className="error">{error}</div>}

        <button className="primary" onClick={generate} disabled={loading}>
          {loading ? <><span className="spinner" /> Generating quiz…</> : "Generate quiz"}
        </button>
      </section>
    </main>
  );
}
