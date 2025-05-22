require('ts-node/register');
const { rooms, nextTurn } = require('./index.ts');

describe('nextTurn', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    for (const key in rooms) {
      delete rooms[key];
    }
  });

  test('keeps current team when other team empty and starts new turn', () => {
    rooms['room1'] = {
      players: ['p1'],
      status: 'playing',
      teams: { '1': ['p1'], '2': [] },
      currentTeam: 1,
      describer: null,
      word: null,
      score: { '1': 0, '2': 0 },
      timer: null,
      timeLeft: 0,
      nicknames: {},
    };

    nextTurn('room1');

    const room = rooms['room1'];
    expect(room.currentTeam).toBe(1);
    expect(room.describer).toBe('p1');
    expect(room.word).toBeTruthy();
    expect(room.timer).not.toBeNull();
  });

  test('switches team when other team has players', () => {
    rooms['room2'] = {
      players: ['a', 'b'],
      status: 'playing',
      teams: { '1': ['a'], '2': ['b'] },
      currentTeam: 1,
      describer: null,
      word: null,
      score: { '1': 0, '2': 0 },
      timer: null,
      timeLeft: 0,
      nicknames: {},
    };

    nextTurn('room2');

    const room = rooms['room2'];
    expect(room.currentTeam).toBe(2);
    expect(room.describer).toBe('b');
  });
});
