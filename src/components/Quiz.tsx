import { useEffect, useRef, useState } from "react";
import type { Emoji } from "../emoji";
import { createQuestionSource, type Question } from "../quiz";
import { playCorrect, playWrong } from "../sound";
import { randomItem } from "../util";
import { QuitDialog } from "./QuitDialog";
import { useFocusOnMount } from "./useFocusOnMount";

const NEXT_DELAY_MS = 1200;
const START_TIME_MS = 10_000;
const BONUS_TIME_MS = 1_000;
// タブが裏に回った後などで時間が一気に減らないよう、1フレームで進める上限
const MAX_TICK_MS = 100;

const CORRECT_MESSAGES = ["Great! 🎉", "Nice! ✨", "Perfect! 🙌", "Yes! 🎯"];
const WRONG_MESSAGES = ["Oops! 😵", "Almost! 😢", "Next time! 💪"];

export type EndReason = "wrong" | "timeup";
export type HistoryItem = { emoji: Emoji; correct: boolean };

// answering: 回答受付中 / picked: 回答後の演出中 / timeup: 時間切れの演出中
type Phase =
  | { type: "answering" }
  | { type: "picked"; choice: Emoji; correct: boolean; message: string }
  | { type: "timeup" };

type Props = {
  emojis: readonly Emoji[];
  announce: (message: string) => void;
  onFinish: (score: number, reason: EndReason, history: HistoryItem[]) => void;
  onQuit: () => void;
};

function formatTime(ms: number): string {
  // 切り捨てて表示する（0.00 になるのは本当に時間切れのときだけ）
  return (Math.floor(ms / 10) / 100).toFixed(2);
}

function PromptCard({ name }: { name: string }) {
  const ref = useFocusOnMount<HTMLDivElement>();
  return (
    <div className="prompt-card" ref={ref} tabIndex={-1}>
      <p className="prompt-label">WHICH ONE?</p>
      <p className="prompt">{name}</p>
    </div>
  );
}

export function Quiz({ emojis, announce, onFinish, onQuit }: Props) {
  const [nextQuestion] = useState(() => createQuestionSource(emojis));
  const [question, setQuestion] = useState<Question>(() => nextQuestion());
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [phase, setPhase] = useState<Phase>({ type: "answering" });
  const [remaining, setRemaining] = useState(START_TIME_MS);
  const remainingRef = useRef(START_TIME_MS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nextReady, setNextReady] = useState(false);
  const quitRef = useRef<HTMLButtonElement>(null);

  const answering = phase.type === "answering";

  const timeUp = (): void => {
    setPhase({ type: "timeup" });
    setHistory((h) => [...h, { emoji: question.answer, correct: false }]);
    announce(`Time's up. The answer was ${question.answer.name}. Streak: ${score}`);
    playWrong();
  };
  const timeUpRef = useRef(timeUp);
  timeUpRef.current = timeUp;

  // 回答受付中だけ時間が進む。回答後の演出中や確認ダイアログの表示中は止める
  const running = answering && !dialogOpen;
  useEffect(() => {
    if (!running) return;
    let rafId = 0;
    let last = performance.now();
    const tick = (now: number): void => {
      remainingRef.current -= Math.min(Math.max(now - last, 0), MAX_TICK_MS);
      last = now;
      if (remainingRef.current <= 0) {
        remainingRef.current = 0;
        setRemaining(0);
        timeUpRef.current();
        return;
      }
      setRemaining(remainingRef.current);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [running]);

  // 演出が終わったら次へ。確認ダイアログの表示中は進めず、閉じてから進める
  useEffect(() => {
    if (answering) return;
    const timer = setTimeout(() => setNextReady(true), NEXT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [answering]);
  useEffect(() => {
    if (!nextReady || dialogOpen) return;
    setNextReady(false);
    if (phase.type === "picked" && phase.correct) {
      setQuestion(nextQuestion());
      setIndex((i) => i + 1);
      setPhase({ type: "answering" });
      announce("");
    } else {
      onFinish(score, phase.type === "timeup" ? "timeup" : "wrong", history);
    }
  }, [nextReady, dialogOpen]);

  const pick = (choice: Emoji): void => {
    if (!answering) return;
    const correct = choice.unicode === question.answer.unicode;
    setHistory((h) => [...h, { emoji: question.answer, correct }]);
    if (correct) {
      setScore(score + 1);
      remainingRef.current += BONUS_TIME_MS;
      setRemaining(remainingRef.current);
      setPhase({ type: "picked", choice, correct, message: `${randomItem(CORRECT_MESSAGES)} +1s` });
      announce(`Correct! Streak: ${score + 1}. Plus 1 second.`);
      playCorrect();
    } else {
      setPhase({ type: "picked", choice, correct, message: randomItem(WRONG_MESSAGES) });
      announce(`Incorrect. The answer was ${question.answer.name}. Streak: ${score}`);
      playWrong();
    }
  };

  const picked = phase.type === "picked" ? phase : undefined;
  const feedback = picked ? picked.message : phase.type === "timeup" ? "Time's up! ⏰" : "";
  const feedbackClass = picked?.correct ? "ok" : feedback ? "ng" : "";

  return (
    <>
      <section className="screen quiz" key={index}>
        <div className="status">
          <button
            className="quit"
            ref={quitRef}
            aria-label="Quit game"
            onClick={() => setDialogOpen(true)}
          >
            ✕
          </button>
          <div className="progress-label">{`Q ${index + 1}`}</div>
          <div className={picked?.correct ? "score bump" : "score"}>{`Streak: ${score}`}</div>
        </div>

        {/* 毎フレーム変わるので読み上げ対象外にする（終了時に announce で伝える） */}
        <div className="timer" aria-hidden="true">
          <span className="timer-label">TIME</span>
          <span className="timer-value">{formatTime(remaining)}</span>
          <span className="timer-unit">s</span>
        </div>

        <PromptCard name={question.answer.name} />

        {/* 表示用。読み上げは常設の live 領域で行うので二重にならないよう隠す */}
        <p className={`feedback ${feedbackClass}`.trim()} aria-hidden="true">
          {feedback}
        </p>

        <div className="choices">
          {question.choices.map((choice, i) => {
            const isAnswer = choice.unicode === question.answer.unicode;
            const cls = !answering && isAnswer ? "correct" : picked?.choice === choice && !picked.correct ? "wrong" : "";
            return (
              <button
                key={choice.unicode}
                className={`choice ${cls}`.trim()}
                // 絵文字の name を付けると出題文と同じになり答えが分かるので、番号だけにする
                aria-label={`Option ${i + 1}`}
                disabled={!answering}
                onClick={() => pick(choice)}
              >
                {choice.emoji}
              </button>
            );
          })}
        </div>
      </section>
      {dialogOpen && (
        <QuitDialog
          opener={quitRef.current}
          onKeep={() => setDialogOpen(false)}
          onQuit={onQuit}
        />
      )}
    </>
  );
}
