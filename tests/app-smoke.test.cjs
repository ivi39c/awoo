const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

test('瀏覽器腳本可依賴順序載入，且主要控制器函式可解析', () => {
  const context = vm.createContext({ console, Math, Set, Map, Object, Array, Number, String, Error, TypeError, RangeError, JSON });
  context.window = context;
  context.document = { getElementById: () => null };
  for (const relativePath of [
    'js/role-database.js',
    'js/ruleset.js',
    'js/game-engine.js',
    'js/ui.js',
    'js/game-flow.js',
    'js/moderator-script.js',
    'js/compendium.js',
    'js/app.js',
  ]) {
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    assert.doesNotThrow(() => vm.runInContext(source, context, { filename: relativePath }), relativePath);
  }
  assert.ok(context.AwooRoleDatabase, 'role database should be registered');
  assert.ok(context.AwooRuleset, 'ruleset module should be registered');
  assert.ok(context.AwooGameEngine, 'game engine should be registered');
  assert.ok(context.AwooUI, 'UI helpers should be registered');
  assert.ok(context.AwooGameFlow, 'game flow helpers should be registered');
  assert.ok(context.AwooModeratorScript, 'moderator voice-flow builder should be registered');
  assert.ok(context.AwooCompendium, 'compendium module should be registered');
  for (const functionName of ['startGameFlow', 'beginNight', 'settleNightActions', 'finalizePublicVote', 'checkWinCondition', 'wolfSelfDestruct']) {
    assert.equal(vm.runInContext(`typeof ${functionName}`, context), 'function', `${functionName} should be defined`);
  }
});

test('index.html 以正確順序載入所有本機 JavaScript 模組', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\s+src="([^"]+)"\s+defer><\/script>/g)].map(match => match[1]);
  assert.deepEqual(scripts, ['js/role-database.js', 'js/ruleset.js', 'js/game-engine.js', 'js/ui.js', 'js/game-flow.js', 'js/moderator-script.js', 'js/compendium.js', 'js/app.js']);
  for (const script of scripts) assert.ok(fs.existsSync(path.join(root, script)), `缺少腳本：${script}`);
  assert.ok(fs.existsSync(path.join(root, 'css/styles.css')), '缺少樣式表');
});
