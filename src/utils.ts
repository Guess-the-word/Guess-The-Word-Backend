// Word list for the game
export const wordList = [
  "apple", "banana", "carrot", "dolphin", "elephant",
  "football", "guitar", "hamburger", "internet", "jacket",
  "kangaroo", "lemon", "mountain", "notebook", "octopus",
  "pizza", "queen", "rainbow", "sunshine", "telephone",
  "umbrella", "volcano", "waterfall", "xylophone", "yogurt",
  "zebra", "airplane", "bicycle", "chocolate", "dinosaur",
  "elevator", "fireworks", "giraffe", "helicopter", "igloo",
  "jellyfish", "keyboard", "lighthouse", "motorcycle", "newspaper",
  "orchestra", "penguin", "quicksand", "restaurant", "skateboard",
  "telescope", "unicorn", "vacation", "windmill", "xylophone",
  "yesterday", "zucchini", "adventure", "butterfly", "crocodile",
  "detective", "electricity", "flamingo", "grasshopper", "hurricane",
  "imagination", "jungle", "kaleidoscope", "laboratory", "magnificent",
  "nightingale", "opportunity", "pineapple", "qualification", "rhinoceros",
  "spectacular", "tangerine", "university", "vegetable", "watermelon",
  "xylography", "yellowstone", "zoologist", "astronaut", "basketball",
  "celebration", "dictionary", "expedition", "friendship", "gymnasium",
  "happiness", "invitation", "journalist", "knowledge", "landscape",
  "mathematics", "navigation", "observatory", "philosophy", "quarantine",
  "revolution", "submarine", "technology", "umbrella", "vaccination",
  "wilderness", "xylophone", "yesterday", "zoology"
];

// Function to get a random word from the word list
export function getRandomWord(): string {
  const randomIndex = Math.floor(Math.random() * wordList.length);
  return wordList[randomIndex];
}

// Function to generate a funny nickname
export function generateNickname(): string {
  const adjectives = [
    "Happy", "Silly", "Sparkly", "Jumpy", "Fluffy",
    "Bouncy", "Giggly", "Wobbly", "Fuzzy", "Bubbly",
    "Shiny", "Wiggly", "Zippy", "Zoomy", "Quirky",
    "Perky", "Jazzy", "Snazzy", "Dazzling", "Glittery"
  ];
  
  const nouns = [
    "Panda", "Unicorn", "Taco", "Penguin", "Cupcake",
    "Potato", "Noodle", "Muffin", "Llama", "Koala",
    "Pickle", "Donut", "Banana", "Kitten", "Puppy",
    "Waffle", "Pancake", "Jellybean", "Marshmallow", "Pineapple"
  ];
  
  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  
  return `${randomAdjective}${randomNoun}`;
}
