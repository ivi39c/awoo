const test = require('node:test');
const assert = require('node:assert/strict');
const Ruleset = require('../js/ruleset.js');

test('預設房規啟用小狼自爆，且只限定小狼角色', () => {
  const rules = Ruleset.resolveRuleset();
  assert.equal(rules.wolfSelfDestructEnabled, true);
  assert.deepEqual([...rules.wolfSelfDestructRoles], ['小狼']);
  assert.ok(rules.wolfSelfDestructPhases.includes('DAY_SPEECH'));
  assert.ok(rules.wolfSelfDestructPhases.includes('VOTING'));
});

test('房規可以關閉自爆或限制可自爆的白天階段', () => {
  const disabled = Ruleset.resolveRuleset({ wolfSelfDestructEnabled: false });
  assert.equal(disabled.wolfSelfDestructEnabled, false);
  const speechOnly = Ruleset.resolveRuleset({ wolfSelfDestructPhases: ['DAY_SPEECH'] });
  assert.deepEqual([...speechOnly.wolfSelfDestructPhases], ['DAY_SPEECH']);
});

test('房規驗證會拒絕非法階段與不合理警長票權重', () => {
  const result = Ruleset.validateRuleset({
    wolfSelfDestructPhases: ['NIGHT'],
    sheriffWeight: 0,
  });
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 2);
});


test('首夜女巫自救房規預設開啟且可由房主關閉', () => {
  assert.equal(Ruleset.resolveRuleset().witchCanSelfSaveFirstNight, true);
  assert.equal(Ruleset.resolveRuleset({ witchCanSelfSaveFirstNight: false }).witchCanSelfSaveFirstNight, false);
  assert.equal(Ruleset.validateRuleset({ witchCanSelfSaveFirstNight: false }).valid, true);
  assert.equal(Ruleset.validateRuleset({ witchCanSelfSaveFirstNight: 'false' }).valid, false);
});
