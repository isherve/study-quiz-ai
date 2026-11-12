"use client";

import { useState } from "react";
import type { Quiz } from "@/lib/types";

interface Props {
  quiz: Quiz;
  onRestart: () => void;
  onRegenerate: () => void;
}

export default function QuizPlayer({ quiz, onRestart, onRegenerate }: Props) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => quiz.questions.map(() => null));
  const [finished, setFinished] = useState(false);

  const q = quiz.questions[current];
  const selected = answers[current];
  const answered = selected !== null;
  const score = answers.filter((a, i) => a === quiz.questions[i].correctIndex).length;

  function choose(i: number) {
    if (answered) return;
    setAnswers((prev) => prev.map((a, idx) => (idx === current ? i : a)));
  }

  function retry() {
    setAnswers(quiz.questions.map(() => null));
    setCurrent(0);
    setFinished(false);
  }

  if (finished) {
    const pct = Math.round((score / quiz.questions.length) * 100);
    const weakTopics = Array.from(
      new Set(quiz.questions.filter((qq, i) => answers[i] !== qq.correctIndex).map((qq) => qq.topic))
    );
    return (
      <section className="card results">
        <h2>Results</h2>
        <div className="score-circle" style={{ ["--pct" as string]: pct }}>
          <span>{pct}%</span>
        </div>
        <p className="big">{score} / {quiz.questions.length} correct</p>
        <p className="muted">{pct >= 80 ? "Excellent work! 🎉" : pct >= 50 ? "Good effort, so review the topics below." : "Keep studying. You've got this!"}</p>

        {weakTopics.length > 0 && (
          <div className="weak">
            <h3>Topics to review</h3>
            <ul>{weakTopics.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        )}

        <details className="review">
          <summary>Review all answers</summary>
          {quiz.questions.map((qq, i) => (
            <div key={i} className="review-item">
              <p><strong>{i + 1}. {qq.question}</strong></p>
              <p className={answers[i] === qq.correctIndex ? "ok" : "bad"}>
                Your answer: {answers[i] !== null ? qq.options[answers[i]!] : "-"}
              </p>
              {answers[i] !== qq.correctIndex && <p className="ok">Correct: {qq.options[qq.correctIndex]}</p>}
              <p className="muted">{qq.explanation}</p>
            </div>
          ))}
        </details>

        <div className="row">
          <button className="secondary" onClick={retry}>Retry quiz</button>
          <button className="secondary" onClick={onRegenerate}>New questions</button>
          <button className="primary" onClick={onRestart}>New notes</button>
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="quiz-head">
        <h2>{quiz.title}</h2>
        <button className="link" onClick={onRestart}>← Back</button>
      </div>
      {current === 0 && !answered && quiz.summary && <p className="summary">{quiz.summary}</p>}

      <div className="progress"><div style={{ width: `${((current + 1) / quiz.questions.length) * 100}%` }} /></div>
      <div className="muted small">
        Question {current + 1} of {quiz.questions.length} · <span className="tag">{q.topic}</span>
      </div>

      <h3 className="question">{q.question}</h3>

      <div className="choices">
        {q.options.map((opt, i) => {
          let cls = "choice";
          if (answered) {
            if (i === q.correctIndex) cls += " correct";
            else if (i === selected) cls += " wrong";
            else cls += " dim";
          }
          return (
            <button key={i} className={cls} onClick={() => choose(i)} disabled={answered}>
              <span className="letter">{String.fromCharCode(65 + i)}</span> {opt}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className={`explanation ${selected === q.correctIndex ? "ok-bg" : "bad-bg"}`}>
          <strong>{selected === q.correctIndex ? "Correct!" : "Not quite."}</strong> {q.explanation}
        </div>
      )}

      <div className="row">
        <button className="secondary" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
          Previous
        </button>
        {current < quiz.questions.length - 1 ? (
          <button className="primary" disabled={!answered} onClick={() => setCurrent((c) => c + 1)}>
            Next
          </button>
        ) : (
          <button className="primary" disabled={!answered} onClick={() => setFinished(true)}>
            See results
          </button>
        )}
      </div>
    </section>
  );
}
