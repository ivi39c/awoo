/*
 * Awoo ruleset defaults and validation.
 * This module is intentionally DOM-free so it can be used in browser and Node tests.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AwooRuleset = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SELF_DESTRUCT_DAY_PHASES = Object.freeze([
    'SHERIFF_ELECTION',
    'DAY_DEATH',
    'DAY_SPEECH',
    'VOTING',
    'LAST_WORDS',
  ]);

  const DEFAULT_RULESET = Object.freeze({
    id: 'awoo-standard',
    name: 'Awoo 標準房規',
    winMode: 'edge',
    sheriffWeight: 1.5,
    // Awoo custom follows the requested order: wolves -> witch -> seer -> guard.
    // 'classic' follows common alternative boards: guard -> wolves -> witch -> seer.
    moderatorNightOrderPreset: 'awoo-custom',
    guardAndSaveSameTargetDies: true,
    wolfSelfDestructEnabled: true,
    // By default only the basic wolf can self-destruct. Variants such as White Wolf King
    // must define their own effect rather than silently inheriting this rule.
    wolfSelfDestructRoles: Object.freeze(['小狼']),
    // Self-destruct may interrupt any active daytime phase, including the current vote.
    wolfSelfDestructPhases: SELF_DESTRUCT_DAY_PHASES,
  });

  function resolveRuleset(overrides = {}) {
    const source = overrides && typeof overrides === 'object' ? overrides : {};
    const merged = { ...DEFAULT_RULESET, ...source };
    merged.wolfSelfDestructRoles = Object.freeze(
      (Array.isArray(source.wolfSelfDestructRoles)
        ? source.wolfSelfDestructRoles
        : DEFAULT_RULESET.wolfSelfDestructRoles)
        .map(role => String(role).trim()).filter(Boolean)
    );
    merged.wolfSelfDestructPhases = Object.freeze(
      (Array.isArray(source.wolfSelfDestructPhases)
        ? source.wolfSelfDestructPhases
        : DEFAULT_RULESET.wolfSelfDestructPhases)
        .map(phase => String(phase).trim()).filter(Boolean)
    );
    return merged;
  }

  function validateRuleset(input = {}) {
    const rules = resolveRuleset(input);
    const errors = [];
    if (!['edge', 'parity'].includes(rules.winMode)) {
      errors.push('winMode 只能是 edge 或 parity。');
    }
    if (!['awoo-custom', 'classic'].includes(rules.moderatorNightOrderPreset)) {
      errors.push('moderatorNightOrderPreset 只能是 awoo-custom 或 classic。');
    }
    if (typeof rules.sheriffWeight !== 'number' || !Number.isFinite(rules.sheriffWeight) || rules.sheriffWeight <= 0) {
      errors.push('sheriffWeight 必須是大於 0 的有限數字。');
    }
    if (typeof rules.guardAndSaveSameTargetDies !== 'boolean') {
      errors.push('guardAndSaveSameTargetDies 必須是布林值。');
    }
    if (typeof rules.wolfSelfDestructEnabled !== 'boolean') {
      errors.push('wolfSelfDestructEnabled 必須是布林值。');
    }
    const invalidPhases = rules.wolfSelfDestructPhases.filter(phase => !SELF_DESTRUCT_DAY_PHASES.includes(phase));
    if (invalidPhases.length) errors.push(`自爆階段設定包含非白天階段：${invalidPhases.join('、')}。`);
    if (rules.wolfSelfDestructEnabled && rules.wolfSelfDestructRoles.length === 0) {
      errors.push('自爆功能啟用時，至少要設定一個允許自爆的角色。');
    }
    return { valid: errors.length === 0, errors, rules };
  }

  return Object.freeze({
    SELF_DESTRUCT_DAY_PHASES,
    DEFAULT_RULESET,
    resolveRuleset,
    validateRuleset,
  });
});
