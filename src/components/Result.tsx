import { useState, type CSSProperties } from "react";
import { randomItem } from "../util";
import { useFocusOnMount } from "./useFocusOnMount";
import type { EndReason, HistoryItem } from "./Quiz";

const CONFETTI_COLORS = ["#ff5fa2", "#ff9f1c", "#ffd43b", "#2ec4b6", "#4d96ff", "#9b5de5"];

export function resultView(score: number): { trophy: string; message: string } {
  if (score >= 15) return { trophy: "🏆", message: "Perfect! Amazing!" };
  if (score >= 10) return { trophy: "🥇", message: "Incredible!" };
  if (score >= 6) return { trophy: "🎉", message: "Great job!" };
  if (score >= 3) return { trophy: "👍", message: "Good! Try again!" };
  return { trophy: "💪", message: "Keep going!" };
}

function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 50 }, (): CSSProperties => ({
      left: `${Math.random() * 100}%`,
      background: randomItem(CONFETTI_COLORS),
      animationDuration: `${2 + Math.random() * 2.5}s`,
      animationDelay: `${Math.random() * 1.2}s`,
    })),
  );
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((style, i) => (
        <i key={i} style={style} />
      ))}
    </div>
  );
}

type Props = {
  score: number;
  reason: EndReason;
  history: HistoryItem[];
  onPlayAgain: () => void;
  onBack: () => void;
};

export function Result({ score, reason, history, onPlayAgain, onBack }: Props) {
  const { trophy, message } = resultView(score);
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  return (
    <section className="screen result">
      <h1 className="title" ref={headingRef} tabIndex={-1}>
        Result
      </h1>
      <div className="trophy" aria-hidden="true">
        {trophy}
      </div>
      <p className="message">{reason === "timeup" ? "Time's up!" : "Game over!"}</p>
      <p className="final-score">{`${score} in a row`}</p>
      <p className="message">{message}</p>
      <div className="history-box">
        <h2 className="history-title" id="history-title">
          Your answers
        </h2>
        {/* 縦に長くなるのでエリア内でスクロールさせる。キーボードでもスクロールできるよう tabIndex を付ける */}
        <ul className="history" tabIndex={0} aria-labelledby="history-title">
          {history.map(({ emoji, correct }, i) => (
            <li key={i} className={correct ? "history-item ok" : "history-item ng"}>
              {/* 色だけで伝えないよう、記号と文言（読み上げ用）を併用する */}
              <span className="history-mark" aria-hidden="true">
                {correct ? "✓" : "✗"}
              </span>
              <span className="history-emoji" aria-hidden="true">
                {emoji.emoji}
              </span>
              <span className="sr-only">{correct ? "Correct: " : "Missed: "}</span>
              <span className="history-name">{emoji.name}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="result-actions">
        <button className="primary" onClick={onPlayAgain}>
          Play again
        </button>
        <button className="secondary" onClick={onBack}>
          Back to start
        </button>
      </div>
      {score >= 5 && <Confetti />}
    </section>
  );
}
