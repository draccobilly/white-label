import { STANDARD_DONATION_AMOUNTS } from "@/lib/donation-ticket";
import { splitSocialProofGifts } from "@/lib/social-proof";

const MIN_CENTS = STANDARD_DONATION_AMOUNTS[0] ?? 2500;
/** Mostly the $25 and $50 tickets, so the donor count can add up to the raised total. */
const TARGET_AVERAGE_CENTS = 4_000;
const RECENT_GIFTS = 16;
const COMMENT_COUNT = 10;

const FIRST_NAMES = [
  "Camila", "Andre", "Helena", "Lucia", "Joao", "Patricia", "Marcos", "Fernanda",
  "Diego", "Beatriz", "Rafael", "Nina", "Aline", "Carlos", "Sofia", "Paulo",
  "Renata", "Miguel", "Lara", "Bruno", "Isabel", "Tiago", "Marina", "Eduardo",
  "Bianca", "Gabriel", "Rosa", "Lucas", "Ana", "Pedro", "Clara", "Hugo",
  "Valentina", "Mateus", "Julia", "Daniel", "Elisa", "Ricardo", "Nadia", "Samuel",
] as const;

const INITIALS = "ABCDEFGHJKLMNPRSTV";

export function compatibleRaisedCents(targetCents: number) {
  return Math.round(targetCents / MIN_CENTS) * MIN_CENTS;
}

function spreadTicketMix(gifts: number[], random: () => number) {
  const amounts = [...gifts];
  const plan: Array<[number, number]> = [
    [50_000, 0.008],
    [20_000, 0.018],
    [15_000, 0.028],
    [10_000, 0.045],
  ];
  for (const [target, share] of plan) {
    const wanted = Math.max(1, Math.round(amounts.length * share));
    let made = 0;
    for (let index = 0; index < amounts.length && made < wanted; index += 1) {
      if (amounts[index] !== 5_000) continue;
      if (random() > 0.65 && made > 0) continue;
      const cutsNeeded = (target - 5_000) / MIN_CENTS;
      const cuts: number[] = [];
      for (let cursor = amounts.length - 1; cursor > index && cuts.length < cutsNeeded; cursor -= 1) {
        if (amounts[cursor] === 5_000) cuts.push(cursor);
      }
      if (cuts.length < cutsNeeded) continue;
      amounts[index] = target;
      for (const cut of cuts) amounts[cut] = MIN_CENTS;
      made += 1;
    }
  }
  return amounts;
}

export function causeGiftAmounts(slug: string, targetCents: number) {
  const total = compatibleRaisedCents(targetCents);
  const maxCount = Math.max(1, Math.floor(total / MIN_CENTS));
  const count = Math.max(1, Math.min(maxCount, Math.round(total / TARGET_AVERAGE_CENTS)));
  const gifts = spreadTicketMix(
    splitSocialProofGifts(total, count, STANDARD_DONATION_AMOUNTS),
    rng(hashSeed(`${slug}:tickets`)),
  );
  return { total: gifts.reduce((sum, amount) => sum + amount, 0), gifts };
}

function hashSeed(value: string) {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function rng(seed: number) {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const current = copy[index]!;
    copy[index] = copy[swap]!;
    copy[swap] = current;
  }
  return copy;
}

function donorName(index: number, random: () => number) {
  if (index % 7 === 4) return "Anonymous";
  const first = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)]!;
  const initial = INITIALS[Math.floor(random() * INITIALS.length)]!;
  return `${first} ${initial}.`;
}

function paidAtForIndex(index: number, now: number, random: () => number) {
  if (index === 0) return now - (6 + random() * 20) * 60_000;
  if (index < 4) return now - (45 + index * 70 + random() * 40) * 60_000;
  const daysAgo = 1 + Math.floor((index - 4) / 2);
  return now - (daysAgo * 86_400_000 + random() * 10 * 3_600_000);
}

export type CauseActivity = {
  donations: Array<{ name: string; amount: number; paidAt: string }>;
  comments: Array<{ authorName: string; body: string; createdAt: string }>;
  updatedAt: string;
};

export function causeActivity(
  cause: { slug: string; currentAmount: number; notes: string[] },
  now = Date.now(),
): CauseActivity {
  const random = rng(hashSeed(cause.slug));
  const { gifts } = causeGiftAmounts(cause.slug, cause.currentAmount);
  const ordered = shuffle(gifts, random);
  const named = ordered.map((amount, index) => ({
    amount,
    name: donorName(index, random),
  }));
  const recent = named.slice(0, RECENT_GIFTS).map((gift, index) => ({
    ...gift,
    paidAt: new Date(paidAtForIndex(index, now, random)).toISOString(),
  }));
  const voices = recent.filter((gift) => gift.name !== "Anonymous");
  const notes = cause.notes.filter((note) => note.trim().length > 0);
  const comments = Array.from({ length: Math.min(COMMENT_COUNT, notes.length, voices.length) }, (_, index) => {
    const donor = voices[index]!;
    const paid = new Date(donor.paidAt).getTime();
    const created = now - (12 + index * 35 + random() * 20) * 60_000;
    return {
      authorName: donor.name,
      body: notes[index]!,
      createdAt: new Date(Math.min(now - 60_000, Math.max(paid + 60_000, created))).toISOString(),
    };
  });
  return {
    donations: recent,
    comments,
    updatedAt: new Date(now - 3 * 86_400_000).toISOString(),
  };
}
