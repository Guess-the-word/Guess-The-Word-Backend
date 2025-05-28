"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFunnyName = exports.pickRandomWord = void 0;
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
function pickRandomWord() {
    return WORDS[Math.floor(Math.random() * WORDS.length)];
}
exports.pickRandomWord = pickRandomWord;
function generateFunnyName() {
    const adjective = SILLY_ADJECTIVES[Math.floor(Math.random() * SILLY_ADJECTIVES.length)];
    const noun = SILLY_NOUNS[Math.floor(Math.random() * SILLY_NOUNS.length)];
    return `${adjective}${noun}`;
}
exports.generateFunnyName = generateFunnyName;
//# sourceMappingURL=helpers.js.map