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
  assert.equal(elements.get('testModeSkipSpeechButton').hidden, true);
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
  assert.equal(elements.get('testModeSkipSpeechButton').hidden, false);
  vm.runInContext("roomState.currentPhase = 'DAY_SPEECH';", context);
  context.updateTestModeUI();
  assert.equal(elements.get('testModeResolveNightButton').hidden, true);
  assert.equal(elements.get('testModeSkipSpeechButton').hidden, true);
});

test('正式模式禁止切換視角，測試模式允許切換有效座位', () => {
  const { context, elements } = createContext();
  vm.runInContext(`roomState.players = [{id:1,name:'A',role:'小狼',isAlive:true},{id:2,name:'B',role:'平民',isAlive:true}]; roomState.mySeatId=1; roomState.currentPerspective=1;`, context);
  assert.equal(context.switchPerspective(2), false);
  assert.equal(vm.runInContext('roomState.currentPerspective', context), 1);
  vm.runInContext('roomState.isTestMode = true', context);
  assert.equal(context.switchPerspective(2), true);
  assert.equal(vm.runInContext('roomState.currentPerspective', context), 2);
  assert.equal(elements.get('perspectiveSelect').children[1].textContent, '視角：2號（平民）');
  assert.equal(context.switchPerspective(999), false);
});

test('測試模式可把當前座位替換為圖鑑任一角色並追蹤已巡檢角色', () => {
  const { context, elements } = createContext();
  context.startQuickBotTest();
  vm.runInContext(`roomState.gameStarted=true; roomState.currentPhase='NIGHT'; roomState.currentPerspective=1; gameState.players=roomState.players; roomState.players[0].deathSkillUsed=true;`, context);
  assert.equal(context.assignTestRole(1, '妖狐'), true);
  assert.equal(vm.runInContext('roomState.players[0].deathSkillUsed', context), false, '替換測試角色時必須清除前一角色的死亡技能使用狀態');
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

test('正式發牌時重置上一局遺留的死亡技能使用狀態', () => {
  const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const dealStart = appSource.indexOf('roomState.players.forEach((p, idx) => {');
  const dealEnd = appSource.indexOf('gameState.players = roomState.players;', dealStart);
  assert.notEqual(dealStart, -1, '必須存在正式發牌的玩家重置區段');
  assert.notEqual(dealEnd, -1, '必須存在發牌後的狀態初始化');
  assert.match(appSource.slice(dealStart, dealEnd), /deathSkillUsed = false/, '每次正式發牌都必須重置死亡技能狀態');
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

test('進入或重置測試模式時不顯示多餘的操作說明文案', () => {
  const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  assert.doesNotMatch(appSource, /Bot 已填滿座位。請開始遊戲|測試局已重置。可重新發牌|測試模式允許切換視角及覆蓋測試角色/);
  assert.match(appSource, /updateBanner\('【測試模式】', '', ''\)/, '測試模式只保留簡短狀態標題，不顯示操作教學');
});

test('測試模式橫幅不顯示說明文案或角色巡檢計數', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const start = html.indexOf('<div id="testModeBanner"');
  const end = html.indexOf('</div>', html.indexOf('<div class="test-mode-actions">', start)) + '</div>'.length;
  assert.notEqual(start, -1, '必須存在測試模式操作橫幅');
  const banner = html.slice(start, end);
  assert.doesNotMatch(banner, /本機 Bot 測試|可切換座位|角色控制台巡檢|測試模式已開啟/);
  assert.match(banner, /立即結算本夜/);
  assert.match(banner, />退出</);
});


test('白狼王帶走警長後處理警徽仍會直接進入下一夜', () => {
  const { context } = createContext();
  vm.runInContext(`
    roomState.currentPhase = 'SHERIFF_BADGE';
    roomState.players = [
      { id: 1, role: '白狼王', isAlive: false, isSheriff: false },
      { id: 2, role: '平民', isAlive: false, isSheriff: true },
      { id: 3, role: '小狼', isAlive: true, isSheriff: false },
    ];
    roomState.sheriffId = 2;
    roomState.sheriffBadgeReturnPhase = 'WHITE_WOLF_KING_SELF_DESTRUCT';
    roomState.sheriffBadgeExecutedVictim = null;
    roomState.currentPerspective = 2;
  `, context);
  let nightStarted = false;
  let dayAnnounced = false;
  context.speakGod = () => {};
  context.renderTable = () => {};
  context.startNextNight = (options) => {
    nightStarted = true;
    assert.match(options.announcement, /白狼王自爆/);
  };
  context.announceDayDeath = () => { dayAnnounced = true; };
  assert.equal(context.resolveSheriffBadge('destroy'), true);
  assert.equal(nightStarted, true, '警徽處理完後必須依白狼王自爆規則進入下一夜');
  assert.equal(dayAnnounced, false, '不能錯誤地恢復白天死亡公告流程');
});


test('正式發牌後，視角選單每個座位都顯示該座位實際發到的正規身份', () => {
  const { context, elements } = createContext();
  context.startQuickBotTest();
  context.startGameFlow();
  const expected = JSON.parse(vm.runInContext('JSON.stringify(roomState.players.map(p => ({ id: p.id, role: getRoleDefinition(p.role)?.name || p.role })))', context));
  const options = elements.get('perspectiveSelect').children;
  assert.equal(options.length, expected.length);
  expected.forEach((player, index) => {
    assert.equal(String(options[index].value), String(player.id));
    assert.equal(options[index].textContent, `視角：${player.id}號（${player.role}）`);
  });
});
