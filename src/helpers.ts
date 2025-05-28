const WORDS = [
  "apple", "banana", "table", "soccer", "javascript",
  "elephant", "kangaroo", "avocado", "spaceship",
  "submarine", "lighthouse", "telescope", "catch phrase",
];

const SILLY_ADJECTIVES = [
  "Funky", "Flying", "Sparkly", "Noisy", "Jolly", "Zany", "Fuzzy", "Cuddly"
];

const SILLY_NOUNS = [
  "Avocado", "Taco", "Penguin", "Panda", "Banana", "Ninja", "Tiger", "Unicorn"
];

export function pickRandomWord(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

export function generateFunnyName(): string {
  const adjective = SILLY_ADJECTIVES[Math.floor(Math.random() * SILLY_ADJECTIVES.length)];
  const noun = SILLY_NOUNS[Math.floor(Math.random() * SILLY_NOUNS.length)];
  return `${adjective}${noun}`;
}
