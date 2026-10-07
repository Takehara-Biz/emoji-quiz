import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type Props = {
  opener: HTMLElement | null;
  onKeep: () => void;
  onQuit: () => void;
};

// 中断の確認ダイアログ。表示中は背景を inert にしてフォーカスを閉じ込め、閉じたら元のボタンに戻す
export function QuitDialog({ opener, onKeep, onQuit }: Props) {
  const keepRef = useRef<HTMLButtonElement>(null);
  const leaveRef = useRef<HTMLButtonElement>(null);
  const onKeepRef = useRef(onKeep);
  onKeepRef.current = onKeep;

  useEffect(() => {
    const app = document.getElementById("app");
    if (app) app.inert = true;
    keepRef.current?.focus();

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        onKeepRef.current();
      } else if (e.key === "Tab") {
        // 2つのボタンの間だけで循環させる
        const first = e.shiftKey ? keepRef.current : leaveRef.current;
        const last = e.shiftKey ? leaveRef.current : keepRef.current;
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (app) app.inert = false;
      opener?.focus();
    };
  }, [opener]);

  return createPortal(
    // 背景タップは誤操作で中断しないよう「続ける」扱い
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onKeep()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="quit-dialog-title">
        <h2 className="dialog-title" id="quit-dialog-title">
          Quit the game?
        </h2>
        <p className="dialog-text">Your progress will be lost.</p>
        <div className="dialog-actions">
          <button className="dialog-btn primary-dialog" ref={keepRef} onClick={onKeep}>
            Keep playing
          </button>
          <button className="dialog-btn" ref={leaveRef} onClick={onQuit}>
            Quit
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
