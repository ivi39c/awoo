/*
 * Awoo game engine
 * Pure/domain logic only: no DOM, alerts, timers, or browser media APIs.
 * This module is used by the browser app and Node.js tests.
 */
(function (root, factory) {
  const roleDb = (typeof module === 'object' && module.exports)
    ? require('./role-database.js')
    : (root && root.AwooRoleDatabase);
  const rulesetApi = (typeof module === 'object' && module.exports)
    ? require('./ruleset.js')
    : (root && root.AwooRuleset);
  const api = factory(roleDb, rulesetApi);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AwooGameEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (roleDb, rulesetApi) {
  'use strict';

  const getRoleDefinition = roleDb && roleDb.getRoleDefinition
    ? roleDb.getRoleDefinition
    : () => null;

  const ROLE_CANONICAL = Object.freeze({
    seer: '預言家',
    witch: '女巫',
    guard: '守衛',
  });

  function normalizeRoleName(roleName) {
    const definition = getRoleDefinition(roleName);
    return definition ? definition.name : String(roleName == null ? '' : roleName).trim();
  }

  function getTeam(roleName) {
    const definition = getRoleDefinition(roleName);
    return definition ? definition.team : 'unknown';
  }

  function validateRolePool(rolePool, playerCount) {
    const errors = [];
    if (!Array.isArray(rolePool)) return { valid: false, errors: ['角色清單必須是陣列。'] };
    if (!Number.isInteger(playerCount) || playerCount < 1) {
      errors.push('玩家人數必須是正整數。');
    }
    if (rolePool.length !== playerCount) {
      errors.push(`角色數量（${rolePool.length}）必須與玩家人數（${playerCount}）一致。`);
    }
    const unknown = [...new Set(rolePool.filter(role => !getRoleDefinition(role)))];
    if (unknown.length) errors.push(`尚未定義的角色：${unknown.join('、')}。`);
    return { valid: errors.length === 0, errors, unknown };
  }

  function dealRoles(rolePool, playerCount, random = Math.random) {
    const validation = validateRolePool(rolePool, playerCount);
    if (!validation.valid) {
      const error = new Error(validation.errors.join('\n'));
      error.validation = validation;
      throw error;
    }
    const shuffled = rolePool.map(normalizeRoleName);
    // Fisher–Yates shuffle: O(n), unbiased when random() is uniform.
    for (let i = shuffled.length - 1; i > 0; i--) {
      const sample = Number(random());
      if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
        throw new RangeError('random() 必須回傳大於等於 0 且小於 1 的數值。');
      }
      const j = Math.floor(sample * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function findPlayer(players, id) {
    if (id == null || id === '') return null;
    const numericId = Number(id);
    return players.find(player => Number(player.id) === numericId) || null;
  }

  function isAlivePlayer(players, id) {
    const player = findPlayer(players, id);
    return player && player.isAlive ? player : null;
  }

  function isRole(player, expectedName) {
    return !!player && normalizeRoleName(player.role) === expectedName;
  }

  function resolveRuleset(overrides = {}) {
    return rulesetApi && typeof rulesetApi.resolveRuleset === 'function'
      ? rulesetApi.resolveRuleset(overrides)
      : overrides;
  }

  function validateWolfSelfDestruct({ players, actorId, phase, rules = {} }) {
    const roster = Array.isArray(players) ? players : [];
    const settings = resolveRuleset(rules);
    if (!settings || settings.wolfSelfDestructEnabled !== true) {
      return { valid: false, reason: '目前房規未啟用小狼自爆。' };
    }
    if (!Array.isArray(settings.wolfSelfDestructPhases) || !settings.wolfSelfDestructPhases.includes(phase)) {
      return { valid: false, reason: '目前階段不能自爆；只能在房規允許的白天階段發動。' };
    }
    const actor = isAlivePlayer(roster, actorId);
    if (!actor) return { valid: false, reason: '自爆玩家不存在或已出局。' };
    const configuredRoles = Array.isArray(settings.wolfSelfDestructRoles)
      ? settings.wolfSelfDestructRoles.map(normalizeRoleName)
      : [];
    if (getTeam(actor.role) !== 'wolf' || !configuredRoles.includes(normalizeRoleName(actor.role))) {
      return { valid: false, reason: '此角色沒有小狼自爆技能。' };
    }
    return { valid: true, actor, phase, rules: settings };
  }

  function resolveWolfSelfDestruct({ players, actorId, phase, rules = {} }) {
    const validation = validateWolfSelfDestruct({ players, actorId, phase, rules });
    if (!validation.valid) return validation;
    const actor = validation.actor;
    actor.isAlive = false;
    actor.deathReason = 'WOLF_SELF_DESTRUCT';
    actor.isProtected = false;
    return {
      valid: true,
      actor,
      death: { id: Number(actor.id), reason: 'WOLF_SELF_DESTRUCT' },
      skippedDay: true,
      nextPhase: 'NIGHT',
    };
  }

  function validateNightAction({ players, actorId, action, targetId, state = {} }) {
    const roster = Array.isArray(players) ? players : [];
    const actor = isAlivePlayer(roster, actorId);
    if (state.phase && state.phase !== 'NIGHT') return { valid: false, reason: '目前不是夜晚行動階段。' };
    if (!actor) return { valid: false, reason: '行動者不存在或已出局。' };

    const target = targetId == null ? null : isAlivePlayer(roster, targetId);
    if (action !== 'witchSave' && !target) return { valid: false, reason: '目標不存在或已出局。' };

    switch (action) {
      case 'seerCheck':
        if (!isRole(actor, ROLE_CANONICAL.seer)) return { valid: false, reason: '只有預言家可以查驗。' };
        if (Number(actor.id) === Number(target.id)) return { valid: false, reason: '不能查驗自己。' };
        return { valid: true, actor, target };
      case 'wolfAttack':
        if (getTeam(actor.role) !== 'wolf') return { valid: false, reason: '只有狼人陣營角色可以選擇夜刀。' };
        if (getTeam(target.role) === 'wolf') return { valid: false, reason: '狼人不能襲擊狼人陣營的隊友。' };
        return { valid: true, actor, target };
      case 'guardProtect':
        if (!isRole(actor, ROLE_CANONICAL.guard)) return { valid: false, reason: '只有守衛可以守護。' };
        if (Number(target.id) === Number(state.previousGuardTargetId)) {
          return { valid: false, reason: '守衛不能連續兩晚守護同一位玩家。' };
        }
        return { valid: true, actor, target };
      case 'witchSave': {
        if (!isRole(actor, ROLE_CANONICAL.witch)) return { valid: false, reason: '只有女巫可以使用解藥。' };
        if (state.witchElixirUsed) return { valid: false, reason: '解藥已經使用過了。' };
        const victim = isAlivePlayer(roster, state.nightVictim);
        if (!victim) return { valid: false, reason: '目前沒有有效的狼人襲擊目標。' };
        return { valid: true, actor, target: victim };
      }
      case 'witchPoison':
        if (!isRole(actor, ROLE_CANONICAL.witch)) return { valid: false, reason: '只有女巫可以使用毒藥。' };
        if (state.witchPoisonUsed) return { valid: false, reason: '毒藥已經使用過了。' };
        return { valid: true, actor, target };
      default:
        return { valid: false, reason: `未知的夜晚行動：${String(action)}。` };
    }
  }

  function resolveNight({
    players,
    wolfTargetId = null,
    witchSaveTargetId = null,
    witchPoisonTargetId = null,
    guardTargetId = null,
    previousGuardTargetId = null,
    rules = {},
  }) {
    if (!Array.isArray(players)) throw new TypeError('resolveNight() 需要 players 陣列。');
    const warnings = [];
    const deadById = new Map();

    let wolfTarget = wolfTargetId == null ? null : isAlivePlayer(players, wolfTargetId);
    if (wolfTargetId != null && !wolfTarget) warnings.push('狼人襲擊目標不存在或已出局，該襲擊無效。');
    if (wolfTarget && getTeam(wolfTarget.role) === 'wolf') {
      warnings.push('狼人襲擊目標屬於狼人陣營，該襲擊無效。');
      wolfTarget = null;
    }

    let guardTarget = guardTargetId == null ? null : isAlivePlayer(players, guardTargetId);
    if (guardTargetId != null && !guardTarget) warnings.push('守衛目標不存在或已出局，該守護無效。');
    if (guardTarget && Number(guardTarget.id) === Number(previousGuardTargetId)) {
      warnings.push('守衛連續兩晚選擇同一目標，依預設規則取消本晚守護。');
      guardTarget = null;
    }

    let saveTarget = witchSaveTargetId == null ? null : isAlivePlayer(players, witchSaveTargetId);
    if (witchSaveTargetId != null && !saveTarget) warnings.push('女巫解藥目標不存在或已出局，該解藥無效。');

    let poisonTarget = witchPoisonTargetId == null ? null : isAlivePlayer(players, witchPoisonTargetId);
    if (witchPoisonTargetId != null && !poisonTarget) warnings.push('女巫毒藥目標不存在或已出局，該毒藥無效。');

    players.forEach(player => {
      player.isProtected = !!guardTarget && Number(player.id) === Number(guardTarget.id);
    });

    if (wolfTarget) {
      const isGuarded = !!guardTarget && Number(wolfTarget.id) === Number(guardTarget.id);
      const isSaved = !!saveTarget && Number(wolfTarget.id) === Number(saveTarget.id);
      // Preserve the existing Awoo house rule by default: guard + antidote on the same
      // target does not cancel the wolf kill. A future selected ruleset can override it.
      const guardedAndSavedStillDies = rules.guardAndSaveSameTargetDies !== false;
      const diesToWolf = (isGuarded && isSaved && guardedAndSavedStillDies) || (!isGuarded && !isSaved);
      if (diesToWolf) deadById.set(wolfTarget.id, { id: wolfTarget.id, reason: 'KILLED_BY_WOLF' });
    }

    if (poisonTarget) {
      const existing = deadById.get(poisonTarget.id);
      if (!existing) {
        deadById.set(poisonTarget.id, { id: poisonTarget.id, reason: 'POISONED_BY_WITCH' });
      } else {
        existing.reason = 'KILLED_BY_WOLF_AND_POISON';
      }
      if (normalizeRoleName(poisonTarget.role) === '獵人') poisonTarget.canShoot = false;
    }

    const deaths = [...deadById.values()];
    deaths.forEach(death => {
      const player = findPlayer(players, death.id);
      if (player) {
        player.isAlive = false;
        player.deathReason = death.reason;
      }
    });

    return {
      deaths,
      lastGuardedId: guardTarget ? Number(guardTarget.id) : null,
      warnings,
    };
  }

  function checkWinCondition(players, rules = {}) {
    if (!Array.isArray(players) || players.length === 0) return null;
    const definitions = players.map(player => ({ player, definition: getRoleDefinition(player.role) }));
    const wolves = definitions.filter(item => item.definition && item.definition.team === 'wolf');
    const gods = definitions.filter(item => item.definition && item.definition.team === 'good' && item.definition.category === '神職');
    const villagers = definitions.filter(item => item.definition && item.definition.team === 'good' && item.definition.category !== '神職');
    const aliveWolves = wolves.filter(item => item.player.isAlive).length;
    const aliveGods = gods.filter(item => item.player.isAlive).length;
    const aliveVillagers = villagers.filter(item => item.player.isAlive).length;

    // A role-less or wolf-less custom board must not produce a fictitious wolf victory.
    if (wolves.length > 0 && aliveWolves === 0) return 'GOOD_WIN';

    const winMode = rules.winMode || 'edge';
    if (winMode === 'parity') {
      const livingNonWolves = definitions.filter(item => item.player.isAlive && item.definition && item.definition.team !== 'wolf').length;
      if (aliveWolves > 0 && aliveWolves >= livingNonWolves) return 'WEREWOLF_WIN';
      return null;
    }

    // Default Awoo mode: edge elimination. Only check a side that existed at setup.
    if (wolves.length > 0 && aliveWolves > 0 &&
        ((gods.length > 0 && aliveGods === 0) || (villagers.length > 0 && aliveVillagers === 0))) {
      return 'WEREWOLF_WIN';
    }
    return null;
  }

  function validateVoteSelection({ players, voterId, targetId, votes = {}, phase = 'VOTING' }) {
    if (phase !== 'VOTING') return { valid: false, reason: '目前不是投票階段。' };
    const voter = isAlivePlayer(players, voterId);
    if (!voter) return { valid: false, reason: '出局玩家沒有投票權。' };
    if (Object.prototype.hasOwnProperty.call(votes, Number(voterId)) || Object.prototype.hasOwnProperty.call(votes, String(voterId))) {
      return { valid: false, reason: '本輪已經提交過投票，不能重複投票。' };
    }
    const numericTargetId = Number(targetId);
    if (targetId == null || !Number.isInteger(numericTargetId)) {
      return { valid: false, reason: '請選擇有效的投票目標或棄票。' };
    }
    if (numericTargetId !== 0 && !isAlivePlayer(players, numericTargetId)) {
      return { valid: false, reason: '投票目標已出局或不存在。' };
    }
    return { valid: true, voter, targetId: numericTargetId };
  }

  function resolveVotes(players, votes, rules = {}) {
    if (!Array.isArray(players)) throw new TypeError('resolveVotes() 需要 players 陣列。');
    const submittedVotes = votes && typeof votes === 'object' ? votes : {};
    const voteCounts = new Map();
    const invalidVotes = [];
    const sheriffWeight = Number.isFinite(Number(rules.sheriffWeight)) ? Number(rules.sheriffWeight) : 1.5;

    players.filter(player => player.isAlive).forEach(voter => {
      const key = Object.prototype.hasOwnProperty.call(submittedVotes, voter.id) ? voter.id : String(voter.id);
      if (!Object.prototype.hasOwnProperty.call(submittedVotes, key)) return;
      const targetId = Number(submittedVotes[key]);
      if (!Number.isInteger(targetId) || targetId === 0) return; // Abstention.
      const target = isAlivePlayer(players, targetId);
      if (!target) {
        invalidVotes.push({ voterId: voter.id, targetId: submittedVotes[key] });
        return;
      }
      const weight = voter.isSheriff ? sheriffWeight : 1;
      voteCounts.set(target.id, (voteCounts.get(target.id) || 0) + weight);
    });

    const counts = Object.fromEntries([...voteCounts.entries()].sort((a, b) => a[0] - b[0]));
    if (voteCounts.size === 0) {
      return { status: 'no-votes', targetId: null, highest: 0, leaders: [], counts, invalidVotes };
    }
    const highest = Math.max(...voteCounts.values());
    const leaders = [...voteCounts.entries()]
      .filter(([, count]) => Math.abs(count - highest) < 1e-9)
      .map(([id]) => id)
      .sort((a, b) => a - b);
    if (leaders.length !== 1) {
      return { status: 'tie', targetId: null, highest, leaders, counts, invalidVotes };
    }
    return { status: 'executed', targetId: leaders[0], highest, leaders, counts, invalidVotes };
  }

  function resetNightActions(state) {
    if (!state || typeof state !== 'object') throw new TypeError('resetNightActions() 需要 state 物件。');
    state.nightVictim = null;
    state.lastNightDeaths = [];
    state.witchSaveTargetId = null;
    state.witchPoisonTargetId = null;
    state.guardTargetId = null;
    state.seerTargetId = null;
    // Intentionally retain game-long resources: guardLastTarget, witchElixirUsed,
    // and witchPoisonUsed must not reset when a new night begins.
    return state;
  }

  return Object.freeze({
    normalizeRoleName,
    getTeam,
    validateRolePool,
    dealRoles,
    validateNightAction,
    validateWolfSelfDestruct,
    resolveWolfSelfDestruct,
    resolveNight,
    checkWinCondition,
    validateVoteSelection,
    resolveVotes,
    resetNightActions,
  });
});
