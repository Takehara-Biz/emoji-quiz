import { useState, type CSSProperties } from "react";
import type { Emoji } from "../emoji";
import { randomItem } from "../util";

// 背景にふわふわ浮かぶ絵文字（装飾なので読み上げ対象外）
export function Floaters({ emojis }: { emojis: readonly Emoji[] }) {
  const [items] = useState(() =>
    Array.from({ length: 12 }, () => ({
      emoji: randomItem(emojis).emoji,
      style: {
        left: `${Math.random() * 92}%`,
        fontSize: `${28 + Math.random() * 36}px`,
        animationDuration: `${12 + Math.random() * 14}s`,
        animationDelay: `${-Math.random() * 26}s`,
      } satisfies CSSProperties,
    })),
  );
  return (
    <div className="floaters" aria-hidden="true">
      {items.map((f, i) => (
        <span key={i} className="floater" style={f.style}>
          {f.emoji}
        </span>
      ))}
    </div>
  );
}
