const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../js/game-engine.js');

function player(id, role, overrides = {}) {
  return {
    id,
    name: `${id}號玩家`,
    role,
    isAlive: true,
    deathReason: null,
    isProtected: false,
    canShoot: true,
    isSheriff: false,
    ...overrides,
  };
}

test('角色池驗證會檢查數量與未知角色', () => {
  assert.equal(Engine.validateRolePool(['小狼', '預言家'], 2).valid, true);
  assert.equal(Engine.validateRolePool(['小狼'], 2).valid, false);
  assert.equal(Engine.validateRolePool(['自創但未登錄的角色'], 1).valid, false);
});

test('發牌保留角色數量、使用 Fisher–Yates 並將別名正規化', () => {
  const pool = ['小狼', 'SEER', '女巫', '平民'];
  const result = Engine.dealRoles(pool, 4, () => 0.5);
  assert.equal(result.length, 4);
  assert.deepEqual([...result].sort(), ['小狼', '預言家', '女巫', '平民'].sort());
  assert.deepEqual(pool, ['小狼', 'SEER', '女巫', '平民'], '發牌不可修改原始角色池');
  assert.throws(() => Engine.dealRoles(['不存在的角色'], 1), /尚未定義/);
});

test('夜晚結算：單獨守衛或女巫解藥可擋狼人襲擊', () => {
  for (const protection of [
    { guardTargetId: 2, witchSaveTargetId: null },
    { guardTargetId: null, witchSaveTargetId: 2 },
  ]) {
    const players = [player(1, '小狼'), player(2, '平民'), player(3, '預言家')];
    const result = Engine.resolveNight({ players, wolfTargetId: 2, ...protection });
    assert.deepEqual(result.deaths, []);
    assert.equal(players[1].isAlive, true);
  }
});

test('夜晚結算：守衛與解藥同目標遵循 Awoo 既有房規', () => {
  const players = [player(1, '小狼'), player(2, '平民')];
  const result = Engine.resolveNight({
    players, wolfTargetId: 2, guardTargetId: 2, witchSaveTargetId: 2,
  });
  assert.equal(result.deaths.length, 1);
  assert.equal(result.deaths[0].reason, 'KILLED_BY_WOLF');
  assert.equal(players[1].isAlive, false);

  const alternatePlayers = [player(1, '小狼'), player(2, '平民')];
  const alternate = Engine.resolveNight({
    players: alternatePlayers, wolfTargetId: 2, guardTargetId: 2,
    witchSaveTargetId: 2, rules: { guardAndSaveSameTargetDies: false },
  });
  assert.deepEqual(alternate.deaths, []);
});

test('夜晚結算：毒藥與狼人襲擊會合併死亡原因，毒殺獵人會封槍', () => {
  const players = [player(1, '小狼'), player(2, '獵人'), player(3, '平民')];
  const result = Engine.resolveNight({
    players, wolfTargetId: 2, witchPoisonTargetId: 2,
  });
  assert.equal(result.deaths.length, 1);
  assert.equal(result.deaths[0].reason, 'KILLED_BY_WOLF_AND_POISON');
  assert.equal(players[1].canShoot, false);
});

test('夜晚行動驗證會檢查角色、階段、存活狀態與守衛連守', () => {
  const players = [player(1, '守衛'), player(2, '平民'), player(3, '小狼'), player(4, '預言家')];
  assert.equal(Engine.validateNightAction({
    players, actorId: 1, action: 'guardProtect', targetId: 2,
    state: { phase: 'NIGHT', previousGuardTargetId: 2 },
  }).valid, false);
  assert.equal(Engine.validateNightAction({
    players, actorId: 3, action: 'seerCheck', targetId: 2,
    state: { phase: 'NIGHT' },
  }).valid, false);
  assert.equal(Engine.validateNightAction({
    players, actorId: 4, action: 'seerCheck', targetId: 2,
    state: { phase: 'DAY_SPEECH' },
  }).valid, false);
  assert.equal(Engine.validateNightAction({
    players, actorId: 4, action: 'seerCheck', targetId: 2,
    state: { phase: 'NIGHT' },
  }).valid, true);
});


test('女巫首夜不能同時使用解藥與毒藥，第二夜則允許兩者並用', () => {
  const players = [
    player(1, '女巫'),
    player(2, '平民'),
    player(3, '小狼'),
  ];

  const firstNightPoisonAfterSave = Engine.validateNightAction({
    players, actorId: 1, action: 'witchPoison', targetId: 2,
    state: { phase: 'NIGHT', currentDay: 1, witchElixirUsed: true, witchPoisonUsed: false },
  });
  assert.equal(firstNightPoisonAfterSave.valid, false);
  assert.match(firstNightPoisonAfterSave.reason, /首夜不能同時使用解藥與毒藥/);

  const firstNightSaveAfterPoison = Engine.validateNightAction({
    players, actorId: 1, action: 'witchSave',
    state: { phase: 'NIGHT', currentDay: 1, nightVictim: 2, witchElixirUsed: false, witchPoisonUsed: true },
  });
  assert.equal(firstNightSaveAfterPoison.valid, false);
  assert.match(firstNightSaveAfterPoison.reason, /首夜不能同時使用解藥與毒藥/);

  const secondNightPoisonAfterSave = Engine.validateNightAction({
    players, actorId: 1, action: 'witchPoison', targetId: 2,
    state: { phase: 'NIGHT', currentDay: 2, witchElixirUsed: true, witchPoisonUsed: false },
  });
  assert.equal(secondNightPoisonAfterSave.valid, true);

  const secondNightSaveAfterPoison = Engine.validateNightAction({
    players, actorId: 1, action: 'witchSave',
    state: { phase: 'NIGHT', currentDay: 2, nightVictim: 2, witchElixirUsed: false, witchPoisonUsed: true },
  });
  assert.equal(secondNightSaveAfterPoison.valid, true);
});

test('勝負判定不會因為沒有狼人或沒有某一好人分組而誤判', () => {
  assert.equal(Engine.checkWinCondition([player(1, '平民'), player(2, '預言家')]), null);
  assert.equal(Engine.checkWinCondition([
    player(1, '預言家'), player(2, '平民'), player(3, '小狼', { isAlive: false }),
  ]), 'GOOD_WIN');
});

test('屠邊勝負判定需要狼仍存活，並確認初始存在的分組已被消滅', () => {
  assert.equal(Engine.checkWinCondition([
    player(1, '小狼'), player(2, '預言家', { isAlive: false }),
    player(3, '平民'),
  ]), 'WEREWOLF_WIN');
  assert.equal(Engine.checkWinCondition([
    player(1, '小狼', { isAlive: false }), player(2, '預言家', { isAlive: false }),
    player(3, '平民'),
  ]), 'GOOD_WIN');
  assert.equal(Engine.checkWinCondition([
    player(1, '小狼'), player(2, '預言家'), player(3, '平民'),
  ]), null);
});

test('公投結算正確處理警長權重、平票、棄票與無效目標', () => {
  const players = [
    player(1, '小狼', { isSheriff: true }),
    player(2, '平民'), player(3, '預言家'), player(4, '女巫'),
  ];
  assert.deepEqual(Engine.resolveVotes(players, { 1: 2, 2: 2, 3: 0, 4: 99 }).status, 'executed');
  assert.equal(Engine.resolveVotes(players, { 2: 3, 3: 2 }).status, 'tie');
  assert.equal(Engine.resolveVotes(players, { 1: 0, 2: 0 }).status, 'no-votes');
});

test('投票驗證拒絕重複提交、死亡玩家與已出局目標', () => {
  const players = [player(1, '平民'), player(2, '小狼'), player(3, '預言家', { isAlive: false })];
  assert.equal(Engine.validateVoteSelection({ players, voterId: 1, targetId: 2, votes: {}, phase: 'VOTING' }).valid, true);
  assert.equal(Engine.validateVoteSelection({ players, voterId: 1, targetId: 2, votes: { 1: 2 }, phase: 'VOTING' }).valid, false);
  assert.equal(Engine.validateVoteSelection({ players, voterId: 3, targetId: 2, votes: {}, phase: 'VOTING' }).valid, false);
  assert.equal(Engine.validateVoteSelection({ players, voterId: 1, targetId: 3, votes: {}, phase: 'VOTING' }).valid, false);
});

test('新夜重置只清理本夜暫存，不重置整局技能資源', () => {
  const state = {
    nightVictim: 2, lastNightDeaths: [{ id: 2 }], witchSaveTargetId: 2,
    witchPoisonTargetId: 3, guardTargetId: 4, seerTargetId: 5,
    guardLastTarget: 4, witchElixirUsed: true, witchPoisonUsed: true,
  };
  Engine.resetNightActions(state);
  assert.equal(state.nightVictim, null);
  assert.deepEqual(state.lastNightDeaths, []);
  assert.equal(state.guardTargetId, null);
  assert.equal(state.guardLastTarget, 4);
  assert.equal(state.witchElixirUsed, true);
  assert.equal(state.witchPoisonUsed, true);
});


test('小狼可在白天自爆，死亡原因正確且要求跳過白天進入黑夜', () => {
  const players = [player(1, '小狼'), player(2, '小狼'), player(3, '預言家')];
  const result = Engine.resolveWolfSelfDestruct({
    players, actorId: 1, phase: 'DAY_SPEECH',
  });
  assert.equal(result.valid, true);
  assert.equal(result.actor.id, 1);
  assert.equal(players[0].isAlive, false);
  assert.equal(players[0].deathReason, 'WOLF_SELF_DESTRUCT');
  assert.deepEqual(result.death, { id: 1, reason: 'WOLF_SELF_DESTRUCT' });
  assert.equal(result.skippedDay, true);
  assert.equal(result.nextPhase, 'NIGHT');
});

test('小狼自爆可以中斷白天公投，但不能在夜晚發動', () => {
  const players = [player(1, '小狼'), player(2, '平民')];
  assert.equal(Engine.validateWolfSelfDestruct({
    players, actorId: 1, phase: 'VOTING',
  }).valid, true);
  const invalid = Engine.resolveWolfSelfDestruct({
    players, actorId: 1, phase: 'NIGHT',
  });
  assert.equal(invalid.valid, false);
  assert.equal(players[0].isAlive, true, '非法階段不能改變存活狀態');
});

test('自爆限制只允許房規指定的基本小狼，其他角色不可借用此技能', () => {
  for (const role of ['狼王', '白狼王', '平民']) {
    const players = [player(1, role), player(2, '小狼')];
    const result = Engine.resolveWolfSelfDestruct({ players, actorId: 1, phase: 'DAY_SPEECH' });
    assert.equal(result.valid, false, `${role} 不應直接使用小狼自爆技能`);
    assert.equal(players[0].isAlive, true);
  }
});

test('自爆需要存活玩家且可由 ruleset 關閉', () => {
  const deadPlayers = [player(1, '小狼', { isAlive: false })];
  assert.equal(Engine.validateWolfSelfDestruct({
    players: deadPlayers, actorId: 1, phase: 'DAY_SPEECH',
  }).valid, false);

  const players = [player(1, '小狼')];
  const disabled = Engine.resolveWolfSelfDestruct({
    players, actorId: 1, phase: 'DAY_SPEECH', rules: { wolfSelfDestructEnabled: false },
  });
  assert.equal(disabled.valid, false);
  assert.equal(players[0].isAlive, true);
});
