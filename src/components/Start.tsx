import { useState } from "react";
import type { Emoji } from "../emoji";
import { initSound } from "../sound";
import { randomItem } from "../util";
import { useFocusOnMount } from "./useFocusOnMount";

const TITLE = "Emoji Quiz!";
const DESCRIPTION = [
  "Pick the emoji that matches the English word.",
  "You have only 10 seconds!",
  "How many can you get right?",
];

type Props = { emojis: readonly Emoji[]; moveFocus: boolean; onStart: () => void };

export function Start({ emojis, moveFocus, onStart }: Props) {
  const [hero] = useState(() => randomItem(emojis).emoji);
  const titleRef = useFocusOnMount<HTMLHeadingElement>(moveFocus);

  return (
    <section className="screen start">
      {/* 1文字ずつ span に分けるので、名前は aria-label でまとめて伝える */}
      <h1 className="title" ref={titleRef} tabIndex={-1} aria-label={TITLE}>
        {[...TITLE].map((ch, i) => (
          <span key={i} aria-hidden="true" style={{ animationDelay: `${i * 0.08}s` }}>
            {ch}
          </span>
        ))}
      </h1>
      <div className="hero" aria-hidden="true">
        {hero}
      </div>
      {/* 文ごとに改行して表示する */}
      <p className="description">
        {DESCRIPTION.map((sentence) => (
          <span key={sentence} className="description-line">
            {sentence}
          </span>
        ))}
      </p>
      <button
        className="primary"
        onClick={() => {
          // AudioContext はユーザー操作の中で初期化する
          initSound();
          onStart();
        }}
      >
        Start
      </button>
    </section>
  );
}
