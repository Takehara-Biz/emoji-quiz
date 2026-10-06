import csvText from "../emoji-v18.csv?raw";

export type Emoji = {
  unicode: string;
  emoji: string;
  name: string;
};

// ダブルクォートで囲まれたカンマ（例: "kiss: woman, man"）を扱える最小限のCSVパーサー
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function loadEmojis(): Emoji[] {
  const [, ...body] = parseCsv(csvText.replace(/^﻿/, "")); // 先頭は列見出し
  return body.map(([unicode, emoji, name]) => ({ unicode, emoji, name }));
}
