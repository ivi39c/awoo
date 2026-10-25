const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const scripts = [
  'js/role-database.js', 'js/ruleset.js', 'js/game-engine.js', 'js/ui.js',
  'js/game-flow.js', 'js/moderator-script.js', 'js/compendium.js', 'js/app.js',
];

function fakeElement(tagName = 'div') {
  const element = {
    tagName, style: {}, children: [], listeners: {}, className: '', textContent: '', innerText: '',
    value: '', disabled: false, options: [], classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    append(...items) { this.children.push(...items); },
    appendChild(item) { this.children.push(item); return item; },
    addEventListener(name, fn) { this.listeners[name] = fn; },
    setAttribute() {},
    remove() {},
  };
  let html = '';
  Object.defineProperty(element, 'innerHTML', {
    get() { return html; },
    set(value) { html = String(value); if (html === '') element.children = []; },
  });
  return element;
}

function createContext() {
  const elements = new Map();
  const ensure = (id) => {
    if (!elements.has(id)) elements.set(id, fakeElement());
    return elements.get(id);
  };
  ensure('playerNameInput').value = '測試者';
  ensure('googleDriveBgm').play = () => Promise.resolve();
  const context = vm.createContext({
    console, Math, Set, Map, Object, Array, Number, String, Error, TypeError, RangeError, JSON,
    setInterval: () => 123, clearInterval: () => {}, setTimeout: () => 456,
    alert: () => {}, prompt: () => null,
  });
  context.window = context;
  context.document = {
    getElementById: ensure,
    createElement: (tag) => fakeElement(tag),
    querySelectorAll: () => [],
  };
  for (const name of scripts) {
    vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context, { filename: name });
  }
  return { context, elements };
}

test('測試模式入口會建立 12 人 Bot 測試局並啟用全視角選單', () => {
  const { context, elements } = createContext();
  context.startQuickBotTest();
  assert.equal(vm.runInContext('roomState.isTestMode', context), true);
  assert.equal(vm.runInContext('roomState.players.length', context), 12);
  assert.equal(elements.get('perspectiveSelect').style.display, '');
  assert.equal(elements.get('testModeBanner').style.display, 'flex');
  assert.equal(elements.get('spectatorCountBtn').style.display, 'none');
  assert.equal(elements.get('mediaTopBtn').style.display, 'none');
  assert.equal(elements.get('compendiumTopBtn').style.display, 'none');
  assert.equal(elements.get('settingsTopBtn').style.display, 'none');
  assert.equal(elements.get('testModeResolveNightButton').hidden, true);
  assert.match(elements.get('perspectiveSelect').children[0].textContent, /^視角：1號（.+）$/);
  assert.doesNotMatch(elements.get('perspectiveSelect').children[0].textContent, /測試者|Bot/);
  const roleCount = vm.runInContext('ROLE_DATABASE.length', context);
  assert.match(elements.get('testRoleCoverage').textContent, new RegExp(`0 \/ ${roleCount}`));
});

test('測試模式的立即結算按鈕只在夜晚階段顯示', () => {
  const { context, elements } = createContext();
  context.startQuickBotTest();
  vm.runInContext("roomState.gameStarted = true; roomState.currentPhase = 'NIGHT';", context);
  context.updateTestModeUI();
  assert.equal(elements.get('testModeResolveNightButton').hidden, false);
  vm.runInContext("roomState.currentPhase = 'DAY_SPEECH';", context);
  context.updateTestModeUI();
  assert.equal(elements.get('testModeResolveNightButton').hidden, true);
});

test('正式模式禁止切換視角，測試模式允許切換有效座位', () => {
  const { context } = createContext();
  vm.runInContext(`roomState.players = [{id:1,name:'A',role:'小狼',isAlive:true},{id:2,name:'B',role:'平民',isAlive:true}]; roomState.mySeatId=1; roomState.currentPerspective=1;`, context);
  assert.equal(context.switchPerspective(2), false);
  assert.equal(vm.runInContext('roomState.currentPerspective', context), 1);
  vm.runInContext('roomState.isTestMode = true', context);
  assert.equal(context.switchPerspective(2), true);
  assert.equal(vm.runInContext('roomState.currentPerspective', context), 2);
  assert.equal(context.switchPerspective(999), false);
});

test('測試模式可把當前座位替換為圖鑑任一角色並追蹤已巡檢角色', () => {
  const { context, elements } = createContext();
  context.startQuickBotTest();
  vm.runInContext(`roomState.gameStarted=true; roomState.currentPhase='NIGHT'; roomState.currentPerspective=1; gameState.players=roomState.players;`, context);
  assert.equal(context.assignTestRole(1, '妖狐'), true);
  assert.equal(vm.runInContext("roomState.players[0].role", context), '妖狐');
  assert.equal(vm.runInContext("roomState.players[0].isAlive", context), true);
  assert.equal(vm.runInContext("roomState.testedRoles.has('妖狐')", context), true);
  const roleCount = vm.runInContext('ROLE_DATABASE.length', context);
  assert.match(elements.get('testRoleCoverage').textContent, new RegExp(`1 \/ ${roleCount}`));
  assert.equal(vm.runInContext("getTestRoleControlStatus('妖狐').includes('尚未接入')", context), true);
});

test('測試模式控制面板不再顯示額外的測試工具與操作說明', () => {
  const { context, elements } = createContext();
  context.startQuickBotTest();
  vm.runInContext(`roomState.gameStarted=true; roomState.currentPhase='NIGHT'; roomState.currentPerspective=1; gameState.players=roomState.players;`, context);
  context.assignTestRole(1, '小狼');
  const controls = elements.get('actionControls');
  assert.equal(controls.children.some(item => item.className === 'test-mode-tools'), false);
  assert.equal(controls.children.some(item => /測試模式工具|請先點擊/.test(item.textContent || '')), false);
  assert.equal(vm.runInContext("getTestRoleControlStatus('狼王')", context).includes('專屬技能仍需另外實作'), true);
});

test('一般創房流程會關閉測試模式，測試角色覆蓋也不能在一般模式使用', () => {
  const { context } = createContext();
  vm.runInContext(`roomState.isTestMode=true; roomState.testedRoles=new Set(['小狼']); roomState.mySeatId=1;`, context);
  // confirmCreateRoom returns early only if a selected custom role list is invalid; the mode lock happens first.
  context.confirmCreateRoom();
  assert.equal(vm.runInContext('roomState.isTestMode', context), false);
  assert.equal(context.assignTestRole(1, '預言家'), false);
});

test('測試模式的立即結算夜晚共用正式夜晚結算流程', () => {
  const { context } = createContext();
  vm.runInContext(`roomState.currentPhase='NIGHT'; roomState.gameStarted=true; roomState.gameOver=false; roomState.sheriffMode='disabled';`, context);
  let settled = false;
  let announced = false;
  context.settleNightActions = () => { settled = true; return []; };
  context.checkWinCondition = () => null;
  context.announceDayDeath = () => { announced = true; };
  assert.equal(context.resolveNightNow(), true);
  assert.equal(settled, true);
  assert.equal(announced, true);
  assert.equal(vm.runInContext('roomState.timerInterval', context), null);
});
