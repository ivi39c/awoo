const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
function fakeElement(tagName = 'div') {
  const el = {
    tagName, style: {}, children: [], listeners: {}, className: '', textContent: '', innerText: '',
    value: '', disabled: false, hidden: false, options: [], attributes: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    append(...items) { this.children.push(...items); },
    appendChild(item) { this.children.push(item); return item; },
    addEventListener(name, fn) { this.listeners[name] = fn; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    remove() {},
  };
  let html = '';
  Object.defineProperty(el, 'innerHTML', { get() { return html; }, set(value) { html = String(value); if (!html) el.children = []; } });
  return el;
}
function makeContext() {
  const elements = new Map();
  const ensure = (id) => {
    if (!elements.has(id)) elements.set(id, fakeElement());
    return elements.get(id);
  };
  const context = vm.createContext({
    console, Math, Set, Map, Object, Array, Number, String, Error, TypeError, RangeError, JSON,
    setInterval: () => 123, clearInterval: () => {}, setTimeout: () => 456,
    alert: () => {}, prompt: () => { throw new Error('毒藥選擇不應再使用 prompt'); },
  });
  context.window = context;
  context.document = { getElementById: ensure, createElement: (tag) => fakeElement(tag), querySelectorAll: () => [], body: fakeElement('body') };
  for (const relative of [
    'js/role-database.js', 'js/ruleset.js', 'js/game-engine.js', 'js/ui.js',
    'js/game-flow.js', 'js/moderator-script.js', 'js/compendium.js', 'js/app.js',
  ]) vm.runInContext(fs.readFileSync(path.join(root, relative), 'utf8'), context, { filename: relative });
  return { context, elements };
}

test('女巫毒藥選擇器列出所有座位，出局玩家反灰且 disabled', () => {
  const { context, elements } = makeContext();
  vm.runInContext(`
    roomState.isTestMode = true;
    roomState.gameStarted = true;
    roomState.currentPhase = 'NIGHT';
    roomState.currentPerspective = 3;
    roomState.playerCount = 7;
    roomState.players = [
      new Player(1, 'P1', '平民'), new Player(2, 'P2', '平民'),
      new Player(3, 'Witch', '女巫'), new Player(4, 'Wolf A', '小狼'),
      new Player(5, 'Wolf B', '小狼'), new Player(6, 'Seer', '預言家'),
      new Player(7, 'Guard', '守衛')
    ];
    roomState.players[1].isAlive = false;
    gameState.players = roomState.players;
    roomState.nightVictim = null;
    roomState.witchPoisonUsed = false;
    roomState.witchPoisonTargetId = null;
    roomState.moderatorScript = [{ role: '女巫', text: '你有一瓶毒藥，你要毒死誰嗎？請選擇目標。', speechText: '你有一瓶毒藥，你要毒死誰嗎？請選擇目標。', actionKey: 'witchPoisonDecision' }];
    roomState.moderatorStepIndex = 0;
    roomState.moderatorSpeechDone = true;
  `, context);
  assert.equal(context.useWitchPoison(), true);
  assert.equal(vm.runInContext('roomState.showWitchPoisonTargets', context), true);
  const html = elements.get('actionControls').innerHTML;
  for (let id = 1; id <= 7; id++) assert.match(html, new RegExp(`data-poison-target="${id}"`));
  assert.match(html, /data-poison-target="2"[^>]*disabled/);
  assert.match(html, /target-btn is-dead/);
  assert.match(html, /2號（已出局）/);
  assert.match(html, /確認使用毒藥/);
});

test('從女巫選擇座位到夜晚結算的整條鏈會將 1 號列入死亡名單並標記出局', () => {
  const { context, elements } = makeContext();
  vm.runInContext(`
    roomState.isTestMode = true;
    roomState.gameStarted = true;
    roomState.gameOver = false;
    roomState.currentPhase = 'NIGHT';
    roomState.currentPerspective = 3;
    roomState.playerCount = 7;
    roomState.sheriffMode = 'disabled';
    roomState.ruleset = window.AwooRuleset.resolveRuleset({ winMode: 'edge' });
    roomState.players = [
      new Player(1, 'P1', '平民'), new Player(2, 'P2', '平民'),
      new Player(3, 'Witch', '女巫'), new Player(4, 'Wolf A', '小狼'),
      new Player(5, 'Wolf B', '小狼'), new Player(6, 'Seer', '預言家'),
      new Player(7, 'Guard', '守衛')
    ];
    // Keep another villager alive so this example tests a normal dawn instead of a win condition.
    gameState.players = roomState.players;
    gameState.currentDay = 2;
    roomState.rolesInGame = ['平民', '女巫', '小狼', '預言家', '守衛'];
    roomState.nightVictim = null;
    roomState.witchElixirUsed = false;
    roomState.witchSaveTargetId = null;
    roomState.witchPoisonUsed = false;
    roomState.witchPoisonTargetId = null;
    roomState.guardTargetId = null;
    roomState.guardLastTarget = null;
    roomState.lastNightDeaths = [];
    roomState.moderatorScript = [];
  `, context);
  context.useWitchPoison();
  assert.equal(context.selectWitchPoisonTarget(1), true);
  assert.equal(context.confirmWitchPoison(), true);
  assert.equal(vm.runInContext('roomState.witchPoisonTargetId', context), 1);
  assert.equal(vm.runInContext('roomState.witchPoisonUsed', context), true);

  const spoken = [];
  context.speakGod = (text) => spoken.push(text);
  context.renderTable = () => {};
  context.startNoSheriffSpeech = () => {};
  context.updateBanner = (phase, announcement, detail) => { spoken.push(`${phase} ${announcement} ${detail}`); };
  assert.equal(context.resolveNightNow(), true);
  assert.equal(vm.runInContext('roomState.players.find(p => p.id === 1).isAlive', context), false);
  assert.equal(vm.runInContext('roomState.players.find(p => p.id === 1).deathReason', context), 'POISONED_BY_WITCH');
  assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('roomState.lastNightDeaths.map(d => ({id:d.id, reason:d.reason}))', context))), [
    { id: 1, reason: 'POISONED_BY_WITCH' },
  ]);
  assert.ok(spoken.some(line => line.includes('昨夜出局：1 號')), '天亮口白必须依据实际结算死亡名册');
});

test('確認毒藥時會再次檢查首夜雙藥限制，不能沿用過期的選擇驗證', () => {
  const { context } = makeContext();
  vm.runInContext(`
    roomState.isTestMode = true; roomState.gameStarted = true; roomState.currentPhase = 'NIGHT';
    roomState.currentPerspective = 2; roomState.players = [
      new Player(1, 'target', '平民'), new Player(2, 'witch', '女巫'), new Player(3, 'wolf', '小狼')
    ];
    gameState.players = roomState.players; gameState.currentDay = 1;
    roomState.witchPoisonUsed = false; roomState.witchElixirUsed = false;
    roomState.moderatorScript = [{ role: '女巫', text: '毒藥', speechText: '毒藥', actionKey: 'witchPoisonDecision' }];
    roomState.moderatorStepIndex = 0; roomState.moderatorSpeechDone = true;
  `, context);

  assert.equal(context.useWitchPoison(), true);
  assert.equal(context.selectWitchPoisonTarget(1), true);
  // Simulate state changing after target selection but before confirmation.
  vm.runInContext('roomState.witchElixirUsed = true', context);
  assert.equal(context.confirmWitchPoison(), false);
  assert.equal(vm.runInContext('roomState.witchPoisonUsed', context), false);
  assert.equal(vm.runInContext('roomState.witchPoisonTargetId', context), null);
});

test('已出局目標不可投毒，且取消選擇不會消耗毒藥', () => {
  const { context } = makeContext();
  vm.runInContext(`
    roomState.isTestMode = true; roomState.gameStarted = true; roomState.currentPhase = 'NIGHT';
    roomState.currentPerspective = 3;
    roomState.players = [new Player(1, 'dead', '平民'), new Player(2, 'witch', '女巫'), new Player(3, 'wolf', '小狼')];
    roomState.players[0].isAlive = false; gameState.players = roomState.players;
    roomState.witchPoisonUsed = false; roomState.witchPoisonTargetId = null;
  `, context);
  context.useWitchPoison();
  assert.equal(context.selectWitchPoisonTarget(1), false);
  context.cancelWitchPoisonSelection();
  assert.equal(vm.runInContext('roomState.witchPoisonUsed', context), false);
  assert.equal(vm.runInContext('roomState.witchPoisonTargetId', context), null);
});


test('若夜間投毒直接觸發勝負，結束公告仍會說明 1 號已出局', () => {
  const { context, elements } = makeContext();
  vm.runInContext(`
    roomState.isTestMode = true; roomState.gameStarted = true; roomState.gameOver = false;
    roomState.currentPhase = 'NIGHT'; roomState.currentPerspective = 3; roomState.playerCount = 6;
    roomState.sheriffMode = 'disabled';
    roomState.ruleset = window.AwooRuleset.resolveRuleset({ winMode: 'edge' });
    roomState.players = [
      new Player(1, 'last villager', '平民'), new Player(2, 'witch', '女巫'),
      new Player(3, 'wolf A', '小狼'), new Player(4, 'wolf B', '小狼'),
      new Player(5, 'seer', '預言家'), new Player(6, 'guard', '守衛')
    ];
    gameState.players = roomState.players; gameState.currentDay = 3;
    roomState.nightVictim = null; roomState.witchSaveTargetId = null;
    roomState.witchPoisonUsed = true; roomState.witchPoisonTargetId = 1;
    roomState.guardTargetId = null; roomState.guardLastTarget = null;
    roomState.lastNightDeaths = []; roomState.moderatorScript = [];
  `, context);
  const spoken = [];
  const banners = [];
  context.speakGod = (text) => spoken.push(text);
  context.renderTable = () => {};
  context.updateControlPanel = () => {};
  context.updateBanner = (phase, announcement, detail) => banners.push({ phase, announcement, detail });
  assert.equal(context.resolveNightNow(), true);
  assert.equal(vm.runInContext('roomState.gameOver', context), true);
  assert.equal(vm.runInContext('roomState.players.find(p => p.id === 1).isAlive', context), false);
  assert.ok(banners.some(banner => String(banner.announcement).includes('昨夜出局：1 號')));
  assert.ok(spoken.some(line => line.includes('昨夜出局：1 號')), '終局語音不可漏掉實際夜間出局名單');
});
