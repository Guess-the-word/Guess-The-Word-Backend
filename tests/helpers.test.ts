import { pickRandomWord, generateFunnyName, WORDS, SILLY_ADJECTIVES, SILLY_NOUNS } from '../src/helpers';

describe('pickRandomWord', () => {
  test('returns a word from WORDS', () => {
    const word = pickRandomWord();
    expect(WORDS).toContain(word);
  });
});

describe('generateFunnyName', () => {
  test('combines an adjective and noun from the lists', () => {
    const name = generateFunnyName();
    const matches = SILLY_ADJECTIVES.flatMap(adj =>
      SILLY_NOUNS.map(noun => `${adj}${noun}`)
    );
    expect(matches).toContain(name);
  });
});
