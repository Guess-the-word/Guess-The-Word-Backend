export const WORDS = [
  "apple", "banana", "table", "soccer", "javascript",
  "elephant", "kangaroo", "avocado", "spaceship",
  "submarine", "lighthouse", "telescope", "catch phrase",
];

export const SILLY_ADJECTIVES = [
  "Funky", "Flying", "Sparkly", "Noisy", "Jolly", "Zany", "Fuzzy", "Cuddly"
];
export const SILLY_NOUNS = [
  "Avocado", "Taco", "Penguin", "Panda", "Banana", "Ninja", "Tiger", "Unicorn"
];

export function pickRandomWord(): string {
  const idx = Math.floor(Math.random() * WORDS.length);
  return WORDS[idx];
}

export function generateFunnyName(): string {
  const adj = SILLY_ADJECTIVES[Math.floor(Math.random() * SILLY_ADJECTIVES.length)];
  const noun = SILLY_NOUNS[Math.floor(Math.random() * SILLY_NOUNS.length)];
  return `${adj}${noun}`;
}
