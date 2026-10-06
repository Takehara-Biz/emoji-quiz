import "./style.css";
import { loadEmojis } from "./emoji";
import { QUESTION_COUNT, createQuestions, type Question } from "./quiz";
import { initSound, playCorrect, playFinish, playWrong } from "./sound";

const NEXT_DELAY_MS = 1200;

const app = document.querySelector<HTMLElement>("#app")!;
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

function show(...children: HTMLElement[]): void {
  app.replaceChildren(...children);
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

function showStart(): void {
  const screen = el("section", "screen start");

  const title = el("h1", "title");
  [...("Emoji Quiz!")].forEach((ch, i) => {
    const s = el("span", undefined, ch === " " ? " " : ch);
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
  show(screen);
}

function startQuiz(): void {
  const questions = createQuestions(emojis);
  let index = 0;
  let score = 0;
  let nextTimer: number | undefined;

  const quit = el("button", "quit", "🏠");
  quit.addEventListener("click", () => {
    if (!confirm("タイトルに戻りますか？\n（進行中のクイズは破棄されます）")) return;
    clearTimeout(nextTimer);
    showStart();
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

    const feedback = el("p", "feedback");
    feedback.setAttribute("aria-live", "polite");

    const choices = el("div", "choices");
    const buttons = q.choices.map((choice) => {
      const b = el("button", "choice", choice.emoji);
      b.setAttribute("aria-label", choice.name);
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
          playCorrect();
        } else {
          b.classList.add("wrong");
          // 正解のボタンも示す
          buttons[q.choices.indexOf(q.answer)].classList.add("correct");
          feedback.textContent = randomItem(WRONG_MESSAGES);
          feedback.classList.add("ng");
          playWrong();
        }
        barFill.style.width = `${((index + 1) / QUESTION_COUNT) * 100}%`;
        nextTimer = window.setTimeout(() => {
          index++;
          if (index < QUESTION_COUNT) showQuestion();
          else showResult(score);
        }, NEXT_DELAY_MS);
      });
      return b;
    });
    choices.append(...buttons);

    const screen = el("section", "screen quiz");
    screen.append(status, bar, card, feedback, choices);
    show(screen);
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

  screen.append(
    el("h1", "title", "Result"),
    trophyEl,
    el("p", "final-score", `${score} / ${QUESTION_COUNT}`),
    el("p", "message", message),
    again,
  );
  if (score >= 5) screen.append(createConfetti());
  show(screen);
}

addFloaters();
showStart();
