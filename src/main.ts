import "./style.css";
import { loadEmojis, type Emoji } from "./emoji";
import { createQuestionSource, type Question } from "./quiz";
import { initSound, playCorrect, playFinish, playWrong } from "./sound";

const NEXT_DELAY_MS = 1200;
const START_TIME_MS = 10_000;
const BONUS_TIME_MS = 1_000;
// タブが裏に回った後などで時間が一気に減らないよう、1フレームで進める上限
const MAX_TICK_MS = 100;

type EndReason = "wrong" | "timeup";
type HistoryItem = { emoji: Emoji; correct: boolean };

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

  // 文ごとに改行して表示する
  const description = el("p", "description");
  description.append(
    ...[
      "Pick the emoji that matches the English word.",
      "You have only 10 seconds!",
      "How many can you get right?",
    ].map((sentence) => el("span", "description-line", sentence)),
  );

  const start = el("button", "primary", "Start");
  start.addEventListener("click", () => {
    initSound();
    startQuiz();
  });

  screen.append(title, hero, description, start);
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

function formatTime(ms: number): string {
  // 切り捨てて表示する（0.00 になるのは本当に時間切れのときだけ）
  return (Math.floor(ms / 10) / 100).toFixed(2);
}

function startQuiz(): void {
  const nextQuestion = createQuestionSource(emojis);
  let index = 0;
  let score = 0;
  const history: HistoryItem[] = [];
  let remaining = START_TIME_MS;
  let nextTimer: number | undefined;

  // 回答受付中だけ時間が進む。回答後の演出中や確認ダイアログの表示中は止める
  let answering = false;
  let timerRunning = false;
  let rafId = 0;
  let lastFrame = 0;
  let timeEl: HTMLElement | undefined;

  // 確認ダイアログの表示中は次へ進めず、閉じてから進める
  let dialogOpen = false;
  let pending: (() => void) | undefined;

  const renderTime = (): void => {
    if (timeEl) timeEl.textContent = formatTime(remaining);
  };
  const stopTimer = (): void => {
    timerRunning = false;
    cancelAnimationFrame(rafId);
  };
  const tick = (now: number): void => {
    if (!timerRunning) return;
    remaining -= Math.min(now - lastFrame, MAX_TICK_MS);
    lastFrame = now;
    if (remaining <= 0) {
      remaining = 0;
      renderTime();
      stopTimer();
      timeUp();
      return;
    }
    renderTime();
    rafId = requestAnimationFrame(tick);
  };
  const startTimer = (): void => {
    stopTimer();
    timerRunning = true;
    lastFrame = performance.now();
    rafId = requestAnimationFrame(tick);
  };

  const goNext = (next: () => void): void => {
    nextTimer = window.setTimeout(() => {
      if (dialogOpen) pending = next;
      else next();
    }, NEXT_DELAY_MS);
  };

  const advance = (): void => {
    index++;
    showQuestion();
  };

  const quit = el("button", "quit", "✕");
  quit.setAttribute("aria-label", "Quit game");
  quit.addEventListener("click", () => {
    dialogOpen = true;
    if (answering) stopTimer();
    openQuitDialog(quit, (confirmed) => {
      dialogOpen = false;
      if (confirmed) {
        stopTimer();
        clearTimeout(nextTimer);
        showStart();
        return;
      }
      if (answering) startTimer();
      if (pending) {
        const next = pending;
        pending = undefined;
        next();
      }
    });
  });

  let current: Question;
  let buttons: HTMLButtonElement[] = [];
  let feedback: HTMLElement;

  // 時間切れ。回答中だった問題の正解も示してゲームを終える
  const timeUp = (): void => {
    answering = false;
    const q = current;
    buttons.forEach((x) => (x.disabled = true));
    buttons[q.choices.indexOf(q.answer)].classList.add("correct");
    feedback.textContent = "Time's up! ⏰";
    feedback.classList.add("ng");
    announce(`Time's up. The answer was ${q.answer.name}. Streak: ${score}`);
    playWrong();
    history.push({ emoji: q.answer, correct: false });
    goNext(() => showResult(score, "timeup", history));
  };

  const showQuestion = (): void => {
    const q = nextQuestion();
    current = q;

    const progressLabel = el("div", "progress-label", `Q ${index + 1}`);
    const scoreEl = el("div", "score", `Streak: ${score}`);
    const status = el("div", "status");
    status.append(quit, progressLabel, scoreEl);

    // 毎フレーム変わるので読み上げ対象外にする（終了時に announce で伝える）
    const timer = el("div", "timer");
    const timeLabel = el("span", "timer-label", "TIME");
    timeEl = el("span", "timer-value");
    timer.append(timeLabel, timeEl, el("span", "timer-unit", "s"));
    timer.setAttribute("aria-hidden", "true");
    renderTime();

    const card = el("div", "prompt-card");
    card.append(el("p", "prompt-label", "WHICH ONE?"), el("p", "prompt", q.answer.name));

    // 表示用。読み上げは常設の live 領域で行うので二重にならないよう隠す
    feedback = el("p", "feedback");
    feedback.setAttribute("aria-hidden", "true");

    const choices = el("div", "choices");
    buttons = q.choices.map((choice, i) => {
      const b = el("button", "choice", choice.emoji);
      // 絵文字の name を付けると出題文と同じになり答えが分かるので、番号だけにする
      b.setAttribute("aria-label", `Option ${i + 1}`);
      b.addEventListener("click", () => {
        answering = false;
        stopTimer();
        buttons.forEach((x) => (x.disabled = true));
        const correct = choice.unicode === q.answer.unicode;
        history.push({ emoji: q.answer, correct });
        if (correct) {
          score++;
          remaining += BONUS_TIME_MS;
          renderTime();
          scoreEl.textContent = `Streak: ${score}`;
          scoreEl.classList.add("bump");
          b.classList.add("correct");
          feedback.textContent = `${randomItem(CORRECT_MESSAGES)} +1s`;
          feedback.classList.add("ok");
          announce(`Correct! Streak: ${score}. Plus 1 second.`);
          playCorrect();
          goNext(advance);
        } else {
          b.classList.add("wrong");
          // 正解のボタンも示す
          buttons[q.choices.indexOf(q.answer)].classList.add("correct");
          feedback.textContent = randomItem(WRONG_MESSAGES);
          feedback.classList.add("ng");
          announce(`Incorrect. The answer was ${q.answer.name}. Streak: ${score}`);
          playWrong();
          goNext(() => showResult(score, "wrong", history));
        }
      });
      return b;
    });
    choices.append(...buttons);

    const screen = el("section", "screen quiz");
    screen.append(status, timer, card, feedback, choices);
    announce("");
    show(screen, card);
    answering = true;
    startTimer();
  };

  showQuestion();
}

function resultView(score: number): { trophy: string; message: string } {
  if (score >= 15) return { trophy: "🏆", message: "Perfect! Amazing!" };
  if (score >= 10) return { trophy: "🥇", message: "Incredible!" };
  if (score >= 6) return { trophy: "🎉", message: "Great job!" };
  if (score >= 3) return { trophy: "👍", message: "Good! Try again!" };
  return { trophy: "💪", message: "Keep going!" };
}

function showResult(score: number, reason: EndReason, history: HistoryItem[]): void {
  playFinish();
  const { trophy, message } = resultView(score);
  const reasonText = reason === "timeup" ? "Time's up!" : "Game over!";

  const screen = el("section", "screen result");
  const again = el("button", "primary", "Play again");
  again.addEventListener("click", startQuiz);
  const back = el("button", "secondary", "Back to start");
  back.addEventListener("click", () => showStart());
  const actions = el("div", "result-actions");
  actions.append(again, back);

  const trophyEl = el("div", "trophy", trophy);
  trophyEl.setAttribute("aria-hidden", "true");

  // 縦に長くなるのでエリア内でスクロールさせる。キーボードでもスクロールできるよう tabindex を付ける
  const listTitle = el("h2", "history-title", "Your answers");
  listTitle.id = "history-title";
  const list = el("ul", "history");
  history.forEach(({ emoji, correct }) => {
    const item = el("li", correct ? "history-item ok" : "history-item ng");
    const icon = el("span", "history-emoji", emoji.emoji);
    icon.setAttribute("aria-hidden", "true");
    // 色だけで伝えないよう、記号と文言（読み上げ用）を併用する
    const mark = el("span", "history-mark", correct ? "✓" : "✗");
    mark.setAttribute("aria-hidden", "true");
    const status = el("span", "sr-only", correct ? "Correct: " : "Missed: ");
    item.append(mark, icon, status, el("span", "history-name", emoji.name));
    list.append(item);
  });
  const historyBox = el("div", "history-box");
  list.tabIndex = 0;
  list.setAttribute("aria-labelledby", listTitle.id);
  historyBox.append(listTitle, list);

  const heading = el("h1", "title", "Result");
  screen.append(
    heading,
    trophyEl,
    el("p", "message", reasonText),
    el("p", "final-score", `${score} in a row`),
    el("p", "message", message),
    historyBox,
    actions,
  );
  if (score >= 5) screen.append(createConfetti());
  announce(`${reasonText} You got ${score} correct in a row. ${message}`);
  show(screen, heading);
}

addFloaters();
showStart(false);
