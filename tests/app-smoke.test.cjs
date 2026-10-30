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


test('首頁顯示與 package.json、CHANGELOG 同步的測試版本號', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  assert.match(html, /class="app-version"[^>]*>版本\s*<span id="appVersion">0\.9\.4-alpha\.1<\/span>/);
  assert.equal(pkg.version, '0.9.4-alpha.1');
  assert.match(changelog, /## 0\.9\.4-alpha\.1 — 2026-10-30/);
});

test('night action deaths are merged at settlement and first-night Sheriff election hides the result until dawn', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const hunterShootStart = app.indexOf('function hunterNightShoot');
  const hunterShootEnd = app.indexOf('function declineHunterNightShot', hunterShootStart);
  const hunterShoot = app.slice(hunterShootStart, hunterShootEnd);
  assert.match(hunterShoot, /roomState\.hunterNightShotTargetId = Number\(target\.id\)/);
  assert.doesNotMatch(hunterShoot, /target\.isAlive\s*=\s*false/,
    '夜間獵人目標應留待夜間統一結算，不可提前改成出局');

  const settlementStart = app.indexOf('function settleNightActions');
  const settlementEnd = app.indexOf('// Role data and alias/camp helpers', settlementStart);
  const settlement = app.slice(settlementStart, settlementEnd);
  assert.match(settlement, /const nightDeaths = result\.deaths\.map/);
  assert.match(settlement, /nightDeaths\.push\(\{ id: hunterShotTargetId, reason: 'HUNTER_SHOT' \}\)/);
  assert.match(settlement, /phaseLabel: nightDeaths\.length \? '昨夜出局' : '平安夜'/);

  const resolveStart = app.indexOf('function resolveNightNow');
  const resolveEnd = app.indexOf('function startNextNight', resolveStart);
  const resolve = app.slice(resolveStart, resolveEnd);
  assert.ok(resolve.indexOf('const firstNightElection =') < resolve.indexOf('const immediateWinner'),
    '首夜警長競選必須先於公開天亮結算與勝負檢查');
  assert.match(resolve, /firstNightDeathsHiddenUntilDawn = true/);

  const announceStart = app.indexOf('function announceDayDeath');
  const announceEnd = app.indexOf('function finishAfterDayExecutionDeathSkills', announceStart);
  const announce = app.slice(announceStart, announceEnd);
  assert.match(announce, /if \(roomState\.firstNightDeathsHiddenUntilDawn\)[\s\S]*?player\.isAlive = false[\s\S]*?roomState\.firstNightDeathsHiddenUntilDawn = false/);
  assert.match(app, /const hideDeathStatus = roomState\.firstNightDeathsHiddenUntilDawn && roomState\.currentPhase === 'SHERIFF_ELECTION'/);
});
