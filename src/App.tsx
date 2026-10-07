import { useState } from "react";
import { loadEmojis } from "./emoji";
import { playFinish } from "./sound";
import { Floaters } from "./components/Floaters";
import { Quiz, type EndReason, type HistoryItem } from "./components/Quiz";
import { Result, resultView } from "./components/Result";
import { Start } from "./components/Start";

const emojis = loadEmojis();

type Screen =
  | { type: "start"; moveFocus: boolean }
  | { type: "quiz"; gameId: number }
  | { type: "result"; score: number; reason: EndReason; history: HistoryItem[] };

export function App() {
  const [screen, setScreen] = useState<Screen>({ type: "start", moveFocus: false });
  const [gameId, setGameId] = useState(0);
  // 画面の切り替えで消えないよう、常設した aria-live 領域に出力する
  const [liveMessage, announce] = useState("");

  const startQuiz = (): void => {
    setGameId((id) => id + 1);
    setScreen({ type: "quiz", gameId: gameId + 1 });
  };

  const finish = (score: number, reason: EndReason, history: HistoryItem[]): void => {
    playFinish();
    const reasonText = reason === "timeup" ? "Time's up!" : "Game over!";
    announce(`${reasonText} You got ${score} correct in a row. ${resultView(score).message}`);
    setScreen({ type: "result", score, reason, history });
  };

  return (
    <>
      <Floaters emojis={emojis} />
      <main id="app">
        {screen.type === "start" && (
          <Start emojis={emojis} moveFocus={screen.moveFocus} onStart={startQuiz} />
        )}
        {screen.type === "quiz" && (
          <Quiz
            key={screen.gameId}
            emojis={emojis}
            announce={announce}
            onFinish={finish}
            onQuit={() => setScreen({ type: "start", moveFocus: true })}
          />
        )}
        {screen.type === "result" && (
          <Result
            score={screen.score}
            reason={screen.reason}
            history={screen.history}
            onPlayAgain={startQuiz}
            onBack={() => setScreen({ type: "start", moveFocus: true })}
          />
        )}
      </main>
      <div id="live" className="sr-only" aria-live="polite">
        {liveMessage}
      </div>
    </>
  );
}
