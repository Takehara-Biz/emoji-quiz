let ctx: AudioContext | undefined;

// ブラウザの制約上、ユーザー操作（Startボタン）の中で呼ぶ必要がある
export function initSound(): void {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
}

function tone(
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType,
  volume = 0.2,
): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const t0 = ctx.currentTime + start;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration);
}

// 正解: 明るい上昇音（ピンポン）
export function playCorrect(): void {
  tone(880, 0, 0.15, "sine");
  tone(1318.5, 0.12, 0.3, "sine");
}

// 不正解: 低い下降音（ブッ）
export function playWrong(): void {
  tone(220, 0, 0.18, "sawtooth", 0.15);
  tone(155.6, 0.16, 0.32, "sawtooth", 0.15);
}

// 終了時のファンファーレ
export function playFinish(): void {
  [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone(f, i * 0.12, 0.25, "triangle"));
}
