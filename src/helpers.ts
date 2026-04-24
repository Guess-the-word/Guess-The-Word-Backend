export const WORDS = [
  "air guitar",
  "arcade",
  "backflip",
  "bagel",
  "balloon animal",
  "banana peel",
  "barbecue",
  "birthday candle",
  "board game",
  "brain freeze",
  "bubble wrap",
  "campfire",
  "catch phrase",
  "cheeseburger",
  "cliffhanger",
  "comic book",
  "dance battle",
  "detective",
  "disco ball",
  "dogsled",
  "dragon",
  "escape room",
  "fireworks",
  "fortune cookie",
  "freeze tag",
  "ghost story",
  "giant squid",
  "grocery cart",
  "guitar solo",
  "haunted house",
  "high five",
  "hot sauce",
  "ice cream truck",
  "jigsaw puzzle",
  "karaoke",
  "keyboard shortcut",
  "laser tag",
  "lemonade stand",
  "lighthouse",
  "magic trick",
  "marshmallow",
  "meteor shower",
  "moonwalk",
  "mystery novel",
  "nachos",
  "ninja",
  "pancake",
  "paper airplane",
  "password",
  "pickle",
  "pizza delivery",
  "pirate ship",
  "popcorn",
  "roller coaster",
  "rubber duck",
  "scavenger hunt",
  "secret handshake",
  "snow globe",
  "spaceship",
  "spelling bee",
  "submarine",
  "sundae",
  "superhero",
  "taco truck",
  "telescope",
  "theme park",
  "thunderstorm",
  "time machine",
  "treasure map",
  "trampoline",
  "video call",
  "waffle",
  "water balloon",
  "wizard",
  "zipline",
];

export const SILLY_ADJECTIVES = [
  "Funky", "Flying", "Sparkly", "Noisy", "Jolly", "Zany", "Fuzzy", "Cuddly"
];

export const SILLY_NOUNS = [
  "Avocado", "Taco", "Penguin", "Panda", "Banana", "Ninja", "Tiger", "Unicorn"
];

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

export function pickRandomWord(excludedWords: string[] = []): string {
  const excluded = new Set(excludedWords.map(normalizeWord));
  const availableWords = WORDS.filter((word) => !excluded.has(normalizeWord(word)));
  const source = availableWords.length > 0 ? availableWords : WORDS;

  return source[Math.floor(Math.random() * source.length)];
}

export function generateFunnyName(): string {
  const adjective = SILLY_ADJECTIVES[Math.floor(Math.random() * SILLY_ADJECTIVES.length)];
  const noun = SILLY_NOUNS[Math.floor(Math.random() * SILLY_NOUNS.length)];
  return `${adjective}${noun}`;
}
