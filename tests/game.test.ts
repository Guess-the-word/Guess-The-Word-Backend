import { MatchRooms, RoomSnapshot } from '../src/game';

const roomName = 'match123';
let game: MatchRooms;
let publish: jest.Mock;
let action = 0;
const state = (id = 'a'): RoomSnapshot => game.snapshot(id)!;
const join = (id: string, nickname = id) => game.handle('joinRoom', id, { roomName, nickname });
const command = (event: string, id = 'a', extra: Record<string, unknown> = {}) => game.handle(event, id, {
  roomName, lobbyId: state().lobbyId, matchId: state().matchId,
  turnId: state().turnId, actionId: String(++action), ...extra,
});
const start = (rounds = 3, turnSeconds = 30) => {
  command('updateSettings', 'a', { rounds, turnSeconds });
  expect(command('startGame')).toEqual({ ok: true });
  jest.advanceTimersByTime(3000);
};
const resolve = (event = 'skipWord') => {
  const result = command(event, state().describer!);
  if (state().phase === 'reveal') jest.advanceTimersByTime(5500);
  return result;
};
const finish = () => { while (state().status === 'playing') resolve(); };

beforeEach(() => {
  jest.useFakeTimers('modern');
  jest.setSystemTime(100000);
  publish = jest.fn();
  game = new MatchRooms(publish);
  join('a'); join('b');
});
afterEach(() => { game.dispose(); jest.useRealTimers(); });

test('defaults, host order, duplicate names and repeated joins preserve distinct connections', () => {
  join('c', 'Same'); join('d', 'Same'); join('c', 'Changed');
  expect(state().hostId).toBe('a');
  expect(state().settings).toEqual({ rounds: 3, turnSeconds: 60 });
  expect(state().players).toEqual(['a', 'b', 'c', 'd']);
  expect(state().teams).toEqual({ '1': ['a', 'c'], '2': ['b', 'd'] });
  expect(state().nicknames.c).toBe('Same');
  expect(state().nicknames.d).toBe('Same');
});

test('validates settings and only permits host configuration', () => {
  expect(command('updateSettings', 'b', { rounds: 7, turnSeconds: 90 }).ok).toBe(false);
  for (const rounds of [0, 4, 3.5, '3', null]) expect(command('updateSettings', 'a', { rounds, turnSeconds: 60 }).ok).toBe(false);
  for (const turnSeconds of [0, 31, '60', null]) expect(command('updateSettings', 'a', { rounds: 3, turnSeconds }).ok).toBe(false);
  expect(command('updateSettings', 'a', { rounds: 7, turnSeconds: 90 }).ok).toBe(true);
  expect(state('b').settings).toEqual({ rounds: 7, turnSeconds: 90 });
});

test('both teams must be populated and only the host may start', () => {
  expect(command('startGame', 'b').ok).toBe(false);
  command('switchTeam', 'b', { newTeam: '1' });
  expect(command('startGame').ok).toBe(false);
  command('switchTeam', 'b', { newTeam: '2' });
  expect(command('startGame').ok).toBe(true);
});

test('start cannot restart play and settings, teams and reset are locked during play', () => {
  start();
  const original = state();
  expect(command('startGame').ok).toBe(false);
  expect(command('updateSettings', 'a', { rounds: 7, turnSeconds: 90 }).ok).toBe(false);
  expect(command('switchTeam', 'b', { newTeam: '1' }).ok).toBe(false);
  expect(command('resetGame').ok).toBe(false);
  expect(state()).toEqual(original);
  expect(jest.getTimerCount()).toBe(1);
});

test.each([3, 5, 7])('%i rounds are exactly two turns each; all passes finish as a draw', rounds => {
  start(rounds);
  for (let turn = 0; turn < rounds * 2; turn++) {
    expect(state().round).toBe(Math.floor(turn / 2) + 1);
    expect(state().currentTeam).toBe(turn % 2 ? '2' : '1');
    expect(state().status).toBe('playing');
    resolve();
  }
  expect(state().status).toBe('finished');
  expect(state().winner).toBe('draw');
  expect(state().history).toHaveLength(rounds * 2);
  expect(state().timeLeft).toBe(0);
  expect(jest.getTimerCount()).toBe(0);
  jest.advanceTimersByTime(300000);
  expect(state().history).toHaveLength(rounds * 2);
  expect(resolve('correctWord').ok).toBe(false);
});

test('the agreed six-turn match ends 2–1 with the exact round breakdown', () => {
  start();
  command('guessWord', 'b', { guess: ` ${state().yourWord!.toUpperCase()}! ` });
  jest.advanceTimersByTime(5500);
  resolve(); resolve(); resolve('correctWord'); resolve('correctWord');
  jest.advanceTimersByTime(32500);
  expect(state().status).toBe('finished');
  expect(state().score).toEqual({ '1': 2, '2': 1 });
  expect(state().winner).toBe('1');
  expect(state().history.map(({ round, team, outcome, points }) => ({ round, team, outcome, points }))).toEqual([
    { round: 1, team: '1', outcome: 'correct', points: 1 },
    { round: 1, team: '2', outcome: 'passed', points: 0 },
    { round: 2, team: '1', outcome: 'passed', points: 0 },
    { round: 2, team: '2', outcome: 'correct', points: 1 },
    { round: 3, team: '1', outcome: 'correct', points: 1 },
    { round: 3, team: '2', outcome: 'expired', points: 0 },
  ]);
});

test('Team 2 can win and describers rotate within each team', () => {
  join('c'); join('d'); start();
  const describers: string[] = [];
  while (state().status === 'playing') {
    describers.push(state().describer!);
    resolve(state().currentTeam === '2' ? 'correctWord' : 'skipWord');
  }
  expect(describers).toEqual(['a', 'b', 'c', 'd', 'a', 'b']);
  expect(state().winner).toBe('2');
});

test('only the describer receives the word, including after repeated joins and spectator arrival', () => {
  start(); join('c'); join('a');
  expect(state().yourWord).toEqual(expect.any(String));
  expect(state('b').yourWord).toBeNull();
  expect(state('c').yourWord).toBeNull();
  const word = state().yourWord;
  for (const [recipient, snapshot] of publish.mock.calls) {
    if (recipient !== 'a') expect(JSON.stringify(snapshot)).not.toContain(`"${word}"`);
  }
  resolve();
  expect(state().yourWord).toBeNull();
  expect(state('b').yourWord).toEqual(expect.any(String));
  expect(state('b').yourWord).not.toBe(word);
});

test('incorrect guesses keep the original deadline and duplicate guesses are logged once', () => {
  start(); jest.advanceTimersByTime(5000);
  command('guessWord', 'b', { guess: 'definitely incorrect', actionId: 'same' });
  command('guessWord', 'b', { guess: 'definitely incorrect', actionId: 'same' });
  expect(state().timeLeft).toBe(25);
  expect(state().turnId).toBe(0);
  expect(state().guesses).toHaveLength(1);
  jest.advanceTimersByTime(25000);
  expect(state().history[0].outcome).toBe('expired');
});

test('only describer can mark Correct or Pass, and describer cannot submit their own guess', () => {
  start();
  expect(command('correctWord', 'b').ok).toBe(false);
  expect(command('skipWord', 'b').ok).toBe(false);
  expect(command('guessWord', 'a', { guess: state().yourWord }).ok).toBe(false);
  expect(state().score).toEqual({ '1': 0, '2': 0 });
});

test.each([29999, 30000, 30001])('action at %ims observes the deadline, even before a timer callback runs', elapsed => {
  start();
  jest.setSystemTime(103000 + elapsed);
  resolve('correctWord');
  expect(state().history).toHaveLength(1);
  expect(state().history[0].outcome).toBe(elapsed < 30000 ? 'correct' : 'expired');
  expect(state().score['1']).toBe(elapsed < 30000 ? 1 : 0);
  expect(state().turnId).toBe(1);
});

test('competing correct/pass/guess requests for a resolved turn cannot resolve another turn', () => {
  start();
  const old = state();
  const payload = { roomName, matchId: old.matchId, turnId: old.turnId, actionId: 'first' };
  game.handle('correctWord', 'a', payload);
  game.handle('correctWord', 'a', payload);
  game.handle('skipWord', 'a', { ...payload, actionId: 'second' });
  game.handle('guessWord', 'b', { ...payload, guess: old.yourWord, actionId: 'third' });
  expect(state().history).toHaveLength(1);
  expect(state().score).toEqual({ '1': 1, '2': 0 });
  jest.advanceTimersByTime(35500);
  expect(state().history).toHaveLength(2);
});

test('outsiders and members of another room cannot mutate this room', () => {
  start();
  game.handle('joinRoom', 'outsider', { roomName: 'elsewhere' });
  const before = state();
  for (const id of ['outsider', 'unknown']) {
    for (const event of ['startGame', 'resetGame', 'switchTeam', 'updateSettings', 'correctWord', 'skipWord', 'guessWord', 'leaveRoom']) {
      expect(command(event, id, { newTeam: '1', guess: before.yourWord }).ok).toBe(false);
    }
  }
  expect(state()).toEqual(before);
});

test('late arrivals are visible spectators, cannot act, and do not cancel play when leaving', () => {
  start(); join('c');
  expect(state().waitingPlayers).toEqual(['c']);
  expect(state().teams).toEqual({ '1': ['a'], '2': ['b'] });
  expect(command('guessWord', 'c', { guess: state().yourWord }).ok).toBe(false);
  expect(command('correctWord', 'c').ok).toBe(false);
  expect(command('switchTeam', 'c', { newTeam: '2' }).ok).toBe(false);
  game.leave('c');
  expect(state().status).toBe('playing');
  expect(state().waitingPlayers).toEqual([]);
});

test('any participant leaving cancels, clears history, promotes waiting players, and retains settings and teams', () => {
  join('c'); start(5, 90); join('d'); resolve('correctWord');
  // c is not the describer, and both teams would still be populated after c leaves.
  game.leave('c');
  expect(state().status).toBe('waiting');
  expect(state().notice).toContain('c left or disconnected');
  expect(state().teams).toEqual({ '1': ['a', 'd'], '2': ['b'] });
  expect(state().settings).toEqual({ rounds: 5, turnSeconds: 90 });
  expect(state().score).toEqual({ '1': 0, '2': 0 });
  expect(state().history).toEqual([]);
  expect(state().waitingPlayers).toEqual([]);
  expect(jest.getTimerCount()).toBe(0);
});

test('host leaving transfers ownership to the earliest remaining connection', () => {
  join('c'); start(); game.leave('a');
  expect(state('b').hostId).toBe('b');
  expect(state('b').status).toBe('waiting');
  expect(game.handle('updateSettings', 'b', { roomName, lobbyId: state('b').lobbyId, rounds: 7, turnSeconds: 90 }).ok).toBe(true);
});

test('results persist when participants leave; results arrivals wait until Play Again', () => {
  start(); finish(); const history = state().history;
  join('c', 'b'); game.leave('b');
  expect(state().status).toBe('finished');
  expect(state().history).toEqual(history);
  expect(state().teams['2']).toEqual([]);
  expect(state().waitingPlayers).toEqual(['c']);
  command('resetGame');
  expect(state().status).toBe('waiting');
  expect(state().teams['2']).toEqual(['c']);
});

test('host transfer on results retains results and allows the new host to play again', () => {
  start(); finish(); game.leave('a');
  expect(state('b').status).toBe('finished');
  expect(state('b').hostId).toBe('b');
  expect(game.handle('resetGame', 'b', { roomName, matchId: state('b').matchId }).ok).toBe(true);
  expect(state('b').status).toBe('waiting');
});

test('rematch clears all match state, retains setup, and rejects stale start/reset/play requests', () => {
  start(5, 90);
  const previous = state();
  command('guessWord', 'b', { guess: 'wrong' }); finish();
  expect(command('resetGame', 'b').ok).toBe(false);
  const reset = { roomName, matchId: state().matchId };
  game.handle('resetGame', 'a', reset);
  expect(state().score).toEqual({ '1': 0, '2': 0 });
  expect(state().history).toEqual([]);
  expect(state().guesses).toEqual([]);
  expect(state().yourWord).toBeNull();
  expect(state().settings).toEqual({ rounds: 5, turnSeconds: 90 });
  expect(state().teams).toEqual(previous.teams);
  expect(command('startGame', 'a', { lobbyId: previous.lobbyId }).ok).toBe(false);
  command('startGame');
  expect(state().matchId).not.toBe(previous.matchId);
  expect(state().describer).toBe('a');
  expect(game.handle('resetGame', 'a', reset).ok).toBe(false);
  expect(command('correctWord', 'a', { matchId: previous.matchId, turnId: 0 }).ok).toBe(false);
  expect(state().turnId).toBe(0);
});

test('refresh is a new connection, even with the same display name', () => {
  start(); game.leave('b'); join('new-b', 'b');
  expect(state().players).toEqual(['a', 'new-b']);
  expect(state().status).toBe('waiting');
  expect(state().history).toEqual([]);
  expect(game.snapshot('b')).toBeUndefined();
});

test('last departure discards settings, timers and tokens; reused room name is fresh', () => {
  start(7, 90); const old = state();
  game.leave('a'); game.leave('b'); join('a'); join('b');
  expect(state().settings).toEqual({ rounds: 3, turnSeconds: 60 });
  expect(state().lobbyId).not.toBe(old.lobbyId);
  expect(state().hostId).toBe('a');
  expect(jest.getTimerCount()).toBe(0);
  expect(command('startGame', 'a', { lobbyId: old.lobbyId }).ok).toBe(false);
});

test('malformed payloads, oversized input and special object keys are safely handled', () => {
  for (const payload of [null, undefined, [], 'hello', { roomName: '../bad' }, { roomName, nickname: {} }]) {
    expect(game.handle('joinRoom', 'c', payload).ok).toBe(false);
  }
  expect(game.handle('joinRoom', 'c', { roomName: 'constructor' }).ok).toBe(false); // exceeds 10 characters
  expect(game.handle('joinRoom', 'c', { roomName: 'toString' }).ok).toBe(true);
  start();
  for (const guess of [null, 42, {}, '', ' '.repeat(10), 'a'.repeat(121)]) expect(command('guessWord', 'b', { guess }).ok).toBe(false);
  expect(state().status).toBe('playing');
});


test('countdown is synchronized, hides the word and cannot consume guessing time', () => {
  command('startGame');
  expect(state()).toMatchObject({ phase: 'countdown', phaseSeconds: 3, timeLeft: 60, yourWord: null });
  expect(state('b').phaseSeconds).toBe(3);
  expect(command('correctWord').ok).toBe(false);
  expect(command('guessWord', 'b', { guess: 'anything' }).ok).toBe(false);
  jest.advanceTimersByTime(2000);
  join('c');
  expect(state('c')).toMatchObject({ phase: 'countdown', phaseSeconds: 1, yourWord: null });
  jest.advanceTimersByTime(1000);
  expect(state()).toMatchObject({ phase: 'active', timeLeft: 60 });
  expect(state().yourWord).toEqual(expect.any(String));
  expect(state('b').yourWord).toBeNull();
});

test.each(['correctWord', 'skipWord', 'timeout'])('%s reveals once to everyone before advancing', event => {
  start();
  const word = state().yourWord;
  if (event === 'timeout') jest.advanceTimersByTime(30000);
  else command(event);
  expect(state()).toMatchObject({ phase: 'reveal', turnId: 0, timeLeft: 0, yourWord: null });
  expect(state('b').history[0].word).toBe(word);
  join('c');
  expect(state('c').history[0].word).toBe(word);
  expect(command('correctWord').ok).toBe(false);
  expect(command('guessWord', 'b', { guess: word }).ok).toBe(false);
  expect(state().history).toHaveLength(1);
  jest.advanceTimersByTime(2500);
  expect(state()).toMatchObject({ phase: 'countdown', turnId: 1, timeLeft: 30 });
  expect(state('b').yourWord).toBeNull();
  jest.advanceTimersByTime(3000);
  expect(state('b')).toMatchObject({ phase: 'active', timeLeft: 30 });
  expect(state('b').yourWord).toEqual(expect.any(String));
});

test.each(['countdown', 'reveal'])('leaving during %s cancels pending transitions', phase => {
  command('startGame');
  if (phase === 'reveal') { jest.advanceTimersByTime(3000); command('correctWord'); }
  game.leave('b');
  expect(state().status).toBe('waiting');
  expect(jest.getTimerCount()).toBe(0);
  jest.advanceTimersByTime(100000);
  expect(state().status).toBe('waiting');
  expect(state().history).toEqual([]);
});

test('the final word gets its reveal before results and rematch unlock', () => {
  start();
  for (let turn = 0; turn < 5; turn++) resolve();
  command('correctWord', state().describer!);
  expect(state()).toMatchObject({ status: 'playing', phase: 'reveal', winner: null });
  expect(state().history).toHaveLength(6);
  expect(command('resetGame').ok).toBe(false);
  jest.advanceTimersByTime(2499);
  expect(state().status).toBe('playing');
  jest.advanceTimersByTime(1);
  expect(state()).toMatchObject({ status: 'finished', winner: '2' });
  expect(jest.getTimerCount()).toBe(0);
});
