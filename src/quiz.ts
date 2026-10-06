import type { Emoji } from "./emoji";

export const QUESTION_COUNT = 10;
export const CHOICE_COUNT = 4;

export type Question = {
  answer: Emoji;
  choices: Emoji[]; // 正解を1つ含む。表示順にシャッフル済み
};

// Fisher-Yates
function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 正解は重複しないよう1問ごとに別の絵文字にし、不正解の選択肢は正解以外から無作為に選ぶ
export function createQuestions(emojis: readonly Emoji[]): Question[] {
  const answers = shuffle(emojis).slice(0, QUESTION_COUNT);
  return answers.map((answer) => {
    const wrong = shuffle(emojis.filter((e) => e.unicode !== answer.unicode)).slice(
      0,
      CHOICE_COUNT - 1,
    );
    return { answer, choices: shuffle([answer, ...wrong]) };
  });
}
