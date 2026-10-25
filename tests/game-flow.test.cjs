const test = require('node:test');
const assert = require('node:assert/strict');
const Flow = require('../js/game-flow.js');

function player(id, isAlive = true) { return { id, isAlive }; }

test('phase engine accepts valid transitions and rejects impossible transitions', () => {
  const state = { currentPhase: 'LOBBY' };
  assert.equal(Flow.transitionPhase(state, 'NIGHT').ok, true);
  assert.equal(state.currentPhase, 'NIGHT');
  assert.equal(Flow.transitionPhase(state, 'VOTING').ok, false, 'night cannot jump directly to voting');
  assert.equal(state.currentPhase, 'NIGHT', 'rejected transition must not mutate state');
  assert.equal(Flow.transitionPhase(state, 'SHERIFF_VOTING').ok, false, 'night cannot jump to sheriff voting');
  assert.equal(Flow.transitionPhase(state, 'DAY_DEATH').ok, true);
  assert.equal(Flow.transitionPhase(state, 'DAY_SPEECH').ok, true);
  assert.equal(Flow.transitionPhase(state, 'DAY_SPEECH').ok, true, 'same phase is an accepted no-op for next speaker');
  assert.equal(Flow.transitionPhase(state, 'VOTING').ok, true);
  assert.equal(Flow.transitionPhase(state, 'GAME_OVER').ok, true, 'game over may be reached from any live phase');
  assert.equal(Flow.transitionPhase(state, 'NIGHT').ok, false, 'game over is terminal');
});

test('speech queue wraps seats in either direction and skips dead/missing players', () => {
  const players = [player(1), player(2, false), player(3), player(4), player(5, false)];
  assert.deepEqual(Flow.buildSpeechQueue(players, 5, 3, true), [3, 4, 1]);
  assert.deepEqual(Flow.buildSpeechQueue(players, 5, 3, false), [3, 1, 4]);
  assert.deepEqual(Flow.buildSpeechQueue([player(1), player(3)], 4, 2, true), [3, 1]);
});

test('getNextSpeaker returns next active seat or a terminal result', () => {
  const queue = [4, 1, 3];
  assert.deepEqual(Flow.getNextSpeaker(queue, -1), { done: false, index: 0, playerId: 4 });
  assert.deepEqual(Flow.getNextSpeaker(queue, 1), { done: false, index: 2, playerId: 3 });
  assert.deepEqual(Flow.getNextSpeaker(queue, 2), { done: true, index: 3, playerId: null });
  assert.deepEqual(Flow.getNextSpeaker([], -1), { done: true, index: 0, playerId: null });
});


test('daytime self-destruct phases may jump directly to night after engine validation', () => {
  for (const phase of ['SHERIFF_ELECTION', 'DAY_DEATH', 'DAY_SPEECH', 'VOTING', 'LAST_WORDS']) {
    const state = { currentPhase: phase };
    const result = Flow.transitionPhase(state, 'NIGHT');
    assert.equal(result.ok, true, `${phase} should allow an immediate night transition`);
    assert.equal(state.currentPhase, 'NIGHT');
  }
});


test('sheriff voting phase can transition to day death or night after a valid outcome', () => {
  const state = { currentPhase: 'SHERIFF_VOTING' };
  assert.equal(Flow.transitionPhase(state, 'DAY_DEATH').ok, true);
  assert.equal(Flow.transitionPhase(state, 'NIGHT').ok, true, 'self-destruct may interrupt sheriff voting and enter night');
});
