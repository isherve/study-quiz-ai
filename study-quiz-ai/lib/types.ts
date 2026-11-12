export type Difficulty = "easy" | "medium" | "hard";

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topic: string;
}

export interface Quiz {
  title: string;
  summary: string;
  questions: QuizQuestion[];
}
