const SALE_CHIME_MESSAGE = "sale-chime";

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

let context: AudioContext | null = null;

function audioContext() {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as WindowWithWebkitAudio).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  return context;
}

export function unlockSaleChime() {
  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
}

function ping(
  ctx: AudioContext,
  time: number,
  frequency: number,
  duration: number,
  gain: number,
) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, time);
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(gain, time + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(time);
  osc.stop(time + duration + 0.03);
}

export function playSaleChime() {
  const ctx = audioContext();
  if (!ctx) return;
  void ctx.resume().then(() => {
    const start = ctx.currentTime;
    ping(ctx, start, 1568, 0.1, 0.18);
    ping(ctx, start + 0.07, 2093, 0.14, 0.22);
    ping(ctx, start + 0.16, 2637, 0.2, 0.14);
  });
}

export function isSaleChimeMessage(data: unknown) {
  return Boolean(
    data &&
      typeof data === "object" &&
      "type" in data &&
      data.type === SALE_CHIME_MESSAGE,
  );
}

export { SALE_CHIME_MESSAGE };
