import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudyQuiz AI",
  description: "Turn your notes into a quiz in seconds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
