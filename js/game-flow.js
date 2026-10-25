/*
 * Awoo game-flow helpers.
 * Owns legal phase transitions and deterministic speaking order, not DOM or timers.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AwooGameFlow = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PHASES = Object.freeze([
    'LOBBY', 'NIGHT', 'SHERIFF_ELECTION', 'SHERIFF_VOTING', 'DEATH_SKILL', 'DAY_DEATH',
    'DAY_SPEECH', 'VOTING', 'LAST_WORDS', 'GAME_OVER'
  ]);
  const TERMINAL_PHASE = 'GAME_OVER';
  const ALLOWED_TRANSITIONS = Object.freeze({
    LOBBY: new Set(['NIGHT']),
    NIGHT: new Set(['SHERIFF_ELECTION', 'DEATH_SKILL', 'DAY_DEATH']),
    // Jumps from daytime to NIGHT are reserved for a validated self-destruct action.
    SHERIFF_ELECTION: new Set(['SHERIFF_VOTING', 'DAY_DEATH', 'NIGHT']),
    SHERIFF_VOTING: new Set(['DAY_DEATH', 'NIGHT']),
    DEATH_SKILL: new Set(['SHERIFF_ELECTION', 'DAY_DEATH', 'LAST_WORDS', 'NIGHT']),
    DAY_DEATH: new Set(['DAY_SPEECH', 'NIGHT']),
    DAY_SPEECH: new Set(['VOTING', 'NIGHT']),
    VOTING: new Set(['DEATH_SKILL', 'LAST_WORDS', 'NIGHT']),
    LAST_WORDS: new Set(['NIGHT']),
    GAME_OVER: new Set()
  });

  function transitionPhase(state, nextPhase) {
    if (!state || typeof state !== 'object') {
      return { ok: false, from: null, to: nextPhase, reason: '缺少有效的遊戲狀態。' };
    }
    const current = state.currentPhase;
    if (!PHASES.includes(nextPhase)) {
      return { ok: false, from: current ?? null, to: nextPhase, reason: '未知的遊戲階段。' };
    }
    if (current === nextPhase) return { ok: true, from: current, to: nextPhase, reason: '階段未變更。' };
    if (nextPhase === TERMINAL_PHASE) {
      state.currentPhase = nextPhase;
      return { ok: true, from: current ?? null, to: nextPhase, reason: null };
    }
    if (current === TERMINAL_PHASE) {
      return { ok: false, from: current, to: nextPhase, reason: '遊戲已結束，不能再切換階段。' };
    }
    if (!ALLOWED_TRANSITIONS[current] || !ALLOWED_TRANSITIONS[current].has(nextPhase)) {
      return { ok: false, from: current ?? null, to: nextPhase, reason: '不允許此階段轉換。' };
    }
    state.currentPhase = nextPhase;
    return { ok: true, from: current, to: nextPhase, reason: null };
  }

  function buildSpeechQueue(players, playerCount, startId, isClockwise) {
    if (!Array.isArray(players)) throw new TypeError('buildSpeechQueue() 需要 players 陣列。');
    const total = Number(playerCount);
    if (!Number.isInteger(total) || total < 1) return [];
    const requestedStart = Number(startId);
    const start = Number.isInteger(requestedStart)
      ? ((requestedStart - 1) % total + total) % total + 1
      : 1;
    const byId = new Map(players.map(player => [Number(player.id), player]));
    const queue = [];
    let seat = start;
    for (let i = 0; i < total; i++) {
      const player = byId.get(seat);
      if (player && player.isAlive) queue.push(player.id);
      seat = isClockwise ? (seat % total) + 1 : ((seat - 2 + total) % total) + 1;
    }
    return queue;
  }

  function getNextSpeaker(queue, currentIndex) {
    const safeQueue = Array.isArray(queue) ? queue : [];
    const index = Number.isInteger(currentIndex) ? currentIndex + 1 : 0;
    if (index < 0 || index >= safeQueue.length) {
      return { done: true, index: safeQueue.length, playerId: null };
    }
    return { done: false, index, playerId: safeQueue[index] };
  }

  return Object.freeze({ PHASES, transitionPhase, buildSpeechQueue, getNextSpeaker });
});
