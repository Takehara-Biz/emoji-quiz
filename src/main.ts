import "./style.css";
import { loadEmojis } from "./emoji";
import { QUESTION_COUNT, createQuestions, type Question } from "./quiz";
import { initSound, playCorrect, playFinish, playWrong } from "./sound";

const NEXT_DELAY_MS = 1200;

const app = document.querySelector<HTMLElement>("#app")!;
// 画面の作り直しで消えないよう、index.html に常設した aria-live 領域
const live = document.querySelector<HTMLElement>("#live")!;
const emojis = loadEmojis();

const CORRECT_MESSAGES = ["Great! 🎉", "Nice! ✨", "Perfect! 🙌", "Yes! 🎯"];
const WRONG_MESSAGES = ["Oops! 😵", "Almost! 😢", "Next time! 💪"];
const CONFETTI_COLORS = ["#ff5fa2", "#ff9f1c", "#ffd43b", "#2ec4b6", "#4d96ff", "#9b5de5"];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// 画面を差し替え、キーボード・支援技術の利用者が迷わないよう focusTarget にフォーカスを移す
function show(screen: HTMLElement, focusTarget?: HTMLElement): void {
  app.replaceChildren(screen);
  if (focusTarget) {
    focusTarget.tabIndex = -1;
    focusTarget.focus();
  }
}

function announce(message: string): void {
  live.textContent = message;
}

// 背景にふわふわ浮かぶ絵文字（装飾なので読み上げ対象外）
function addFloaters(): void {
  const layer = el("div", "floaters");
  layer.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 12; i++) {
    const f = el("span", "floater", randomItem(emojis).emoji);
    f.style.left = `${Math.random() * 92}%`;
    f.style.fontSize = `${28 + Math.random() * 36}px`;
    f.style.animationDuration = `${12 + Math.random() * 14}s`;
    f.style.animationDelay = `${-Math.random() * 26}s`;
    layer.append(f);
  }
  document.body.prepend(layer);
}

function createConfetti(): HTMLElement {
  const layer = el("div", "confetti");
  layer.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 50; i++) {
    const piece = el("i");
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = randomItem(CONFETTI_COLORS);
    piece.style.animationDuration = `${2 + Math.random() * 2.5}s`;
    piece.style.animationDelay = `${Math.random() * 1.2}s`;
    layer.append(piece);
  }
  return layer;
}

function showStart(moveFocus = true): void {
  const screen = el("section", "screen start");

  const title = el("h1", "title");
  // 1文字ずつ span に分けるので、名前は aria-label でまとめて伝える
  title.setAttribute("aria-label", "Emoji Quiz!");
  [...("Emoji Quiz!")].forEach((ch, i) => {
    const s = el("span", undefined, ch === " " ? " " : ch);
    s.setAttribute("aria-hidden", "true");
    s.style.animationDelay = `${i * 0.08}s`;
    title.append(s);
  });

  const hero = el("div", "hero", randomItem(emojis).emoji);
  hero.setAttribute("aria-hidden", "true");

  const start = el("button", "primary", "Start");
  start.addEventListener("click", () => {
    initSound();
    startQuiz();
  });

  screen.append(title, hero, start);
  show(screen, moveFocus ? title : undefined);
}

// 中断の確認ダイアログ。表示中は背景を inert にしてフォーカスを閉じ込め、閉じたら元のボタンに戻す
function openQuitDialog(opener: HTMLElement, onClose: (confirmed: boolean) => void): void {
  const keep = el("button", "dialog-btn primary-dialog", "Keep playing");
  const leave = el("button", "dialog-btn", "Quit");
  const heading = el("h2", "dialog-title", "Quit the game?");
  heading.id = "quit-dialog-title";
  const body = el("p", "dialog-text", "Your progress will be lost.");

  const box = el("div", "dialog");
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-labelledby", heading.id);
  box.append(heading, body, el("div", "dialog-actions"));
  box.lastElementChild?.append(keep, leave);

  const overlay = el("div", "overlay");
  overlay.append(box);

  const close = (confirmed: boolean): void => {
    document.removeEventListener("keydown", onKey);
    overlay.remove();
    app.inert = false;
    if (!confirmed) opener.focus();
    onClose(confirmed);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      close(false);
    } else if (e.key === "Tab") {
      // 2つのボタンの間だけで循環させる
      const first = e.shiftKey ? keep : leave;
      const last = e.shiftKey ? leave : keep;
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    }
  };

  keep.addEventListener("click", () => close(false));
  leave.addEventListener("click", () => close(true));
  // 背景タップは誤操作で中断しないよう「続ける」扱い
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close(false);
  });

  app.inert = true;
  document.body.append(overlay);
  document.addEventListener("keydown", onKey);
  keep.focus();
}

function startQuiz(): void {
  const questions = createQuestions(emojis);
  let index = 0;
  let score = 0;
  let nextTimer: number | undefined;

  // 確認ダイアログの表示中は次の問題へ進めず、閉じてから進める
  let dialogOpen = false;
  let advanceWaiting = false;

  const advance = (): void => {
    index++;
    if (index < QUESTION_COUNT) showQuestion();
    else showResult(score);
  };

  const quit = el("button", "quit", "✕");
  quit.setAttribute("aria-label", "Quit game");
  quit.addEventListener("click", () => {
    dialogOpen = true;
    openQuitDialog(quit, (confirmed) => {
      dialogOpen = false;
      if (confirmed) {
        clearTimeout(nextTimer);
        showStart();
      } else if (advanceWaiting) {
        advanceWaiting = false;
        advance();
      }
    });
  });

  const showQuestion = (): void => {
    const q: Question = questions[index];

    const progressLabel = el("div", "progress-label", `Q ${index + 1} / ${QUESTION_COUNT}`);
    const scoreEl = el("div", "score", `Score: ${score}`);
    const status = el("div", "status");
    status.append(quit, progressLabel, scoreEl);

    const bar = el("div", "progress-bar");
    const barFill = el("div");
    barFill.style.width = `${(index / QUESTION_COUNT) * 100}%`;
    bar.append(barFill);

    const card = el("div", "prompt-card");
    card.append(el("p", "prompt-label", "WHICH ONE?"), el("p", "prompt", q.answer.name));

    // 表示用。読み上げは常設の live 領域で行うので二重にならないよう隠す
    const feedback = el("p", "feedback");
    feedback.setAttribute("aria-hidden", "true");

    const choices = el("div", "choices");
    const buttons = q.choices.map((choice, i) => {
      const b = el("button", "choice", choice.emoji);
      // 絵文字の name を付けると出題文と同じになり答えが分かるので、番号だけにする
      b.setAttribute("aria-label", `Option ${i + 1}`);
      b.addEventListener("click", () => {
        buttons.forEach((x) => (x.disabled = true));
        const correct = choice.unicode === q.answer.unicode;
        if (correct) {
          score++;
          scoreEl.textContent = `Score: ${score}`;
          scoreEl.classList.add("bump");
          b.classList.add("correct");
          feedback.textContent = randomItem(CORRECT_MESSAGES);
          feedback.classList.add("ok");
          announce(`Correct! Score: ${score}`);
          playCorrect();
        } else {
          b.classList.add("wrong");
          // 正解のボタンも示す
          buttons[q.choices.indexOf(q.answer)].classList.add("correct");
          feedback.textContent = randomItem(WRONG_MESSAGES);
          feedback.classList.add("ng");
          announce(`Incorrect. The answer was ${q.answer.name}. Score: ${score}`);
          playWrong();
        }
        barFill.style.width = `${((index + 1) / QUESTION_COUNT) * 100}%`;
        nextTimer = window.setTimeout(() => {
          if (dialogOpen) advanceWaiting = true;
          else advance();
        }, NEXT_DELAY_MS);
      });
      return b;
    });
    choices.append(...buttons);

    const screen = el("section", "screen quiz");
    screen.append(status, bar, card, feedback, choices);
    announce("");
    show(screen, card);
  };

  showQuestion();
}

function resultView(score: number): { trophy: string; message: string } {
  if (score === QUESTION_COUNT) return { trophy: "🏆", message: "Perfect! Amazing!" };
  if (score >= 8) return { trophy: "🥇", message: "Great job!" };
  if (score >= 5) return { trophy: "🎉", message: "Good! Try again!" };
  return { trophy: "💪", message: "Keep going!" };
}

function showResult(score: number): void {
  playFinish();
  const { trophy, message } = resultView(score);

  const screen = el("section", "screen result");
  const again = el("button", "primary", "Play again");
  again.addEventListener("click", startQuiz);

  const trophyEl = el("div", "trophy", trophy);
  trophyEl.setAttribute("aria-hidden", "true");

  const heading = el("h1", "title", "Result");
  screen.append(
    heading,
    trophyEl,
    el("p", "final-score", `${score} / ${QUESTION_COUNT}`),
    el("p", "message", message),
    again,
  );
  if (score >= 5) screen.append(createConfetti());
  announce(`Result: ${score} out of ${QUESTION_COUNT}. ${message}`);
  show(screen, heading);
}

addFloaters();
showStart(false);
