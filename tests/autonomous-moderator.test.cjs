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
function makeContext(testMode = false) {
  const elements = new Map();
  const timers = new Map();
  let nextTimerId = 1;
  const ensure = (id) => { if (!elements.has(id)) elements.set(id, fakeElement()); return elements.get(id); };
  const alerts = [];
  const context = vm.createContext({
    console, Math, Set, Map, Object, Array, Number, String, Error, TypeError, RangeError, JSON,
    setInterval: () => 1000, clearInterval: () => {},
    setTimeout: (fn, ms = 0) => { const id = nextTimerId++; timers.set(id, { fn, ms, cancelled: false }); return id; },
    clearTimeout: (id) => { const timer = timers.get(id); if (timer) timer.cancelled = true; },
    alert: message => alerts.push(String(message)), prompt: () => { throw new Error('不應用 prompt 取得行動目標'); },
  });
  context.window = context;
  context.document = { getElementById: ensure, createElement: tag => fakeElement(tag), querySelectorAll: () => [], body: fakeElement('body') };
  for (const relative of [
    'js/role-database.js', 'js/ruleset.js', 'js/game-engine.js', 'js/ui.js',
    'js/game-flow.js', 'js/moderator-script.js', 'js/compendium.js', 'js/app.js',
  ]) vm.runInContext(fs.readFileSync(path.join(root, relative), 'utf8'), context, { filename: relative });

  const utterances = [];
  context.SpeechSynthesisUtterance = function (text) { this.text = text; utterances.push(this); };
  context.speechSynthesis = {
    cancel() {},
    getVoices() { return [{ lang: 'zh-TW' }]; },
    speak(utterance) { if (!utterances.includes(utterance)) utterances.push(utterance); },
  };
  vm.runInContext(`
    roomState.isTestMode = ${testMode ? 'true' : 'false'};
    roomState.isHost = true;
    roomState.gameStarted = true;
    roomState.gameOver = false;
    roomState.currentPhase = 'NIGHT';
    roomState.currentPerspective = 1;
    roomState.ruleset = window.AwooRuleset.resolveRuleset({ winMode: 'edge' });
    roomState.players = [new Player(1, 'Wolf', '小狼'), new Player(2, 'Civilian', '平民')];
    gameState.players = roomState.players;
    roomState.rolesInGame = ['小狼', '平民'];
    roomState.nightVictim = null;
    roomState.wolfActionDecided = false;
    roomState.moderatorScript = [
      { role: '全體', text: '天黑請閉眼。', speechText: '天黑請閉眼。', actionKey: null, postSpeechPauseMs: 100 },
      { role: '狼人陣營', text: '狼人請選擇今晚要殺的對象。', speechText: '狼人請選擇今晚要殺的對象。', actionKey: 'wolfAttack', postSpeechPauseMs: 100 },
      { role: '狼人陣營', text: '狼人請閉眼。', speechText: '狼人請閉眼。', actionKey: null, postSpeechPauseMs: 100 },
    ];
    roomState.moderatorStepIndex = 0;
    roomState.moderatorSpeechDone = true;
    roomState.moderatorManualCompletedStepIndex = null;
  `, context);
  function runNextTimer() {
    const entry = [...timers.entries()].find(([, timer]) => !timer.cancelled);
    assert.ok(entry, '應有自動推進計時器');
    const [id, timer] = entry;
    timers.delete(id);
    timer.fn();
    return timer.ms;
  }
  return { context, elements, timers, utterances, alerts, runNextTimer };
}

test('正式模式：無需角色操作的口白結束後會自動播放下一句', () => {
  const { context, elements, utterances, runNextTimer } = makeContext(false);
  context.renderGodFlowPanel();
  assert.equal(elements.get('godFlowNextButton').hidden, true, '正式模式不顯示人工主持的下一句按鈕');
  context.speakCurrentModeratorLine();
  assert.equal(utterances.at(-1).text, '天黑請閉眼。');
  utterances.at(-1).onend();
  runNextTimer();
  assert.equal(vm.runInContext('roomState.moderatorStepIndex', context), 1);
  assert.equal(utterances.at(-1).text, '狼人請選擇今晚要殺的對象。');
});

test('正式模式：狼人目標未確認前停止自動推進，完成選擇後自動播報狼人閉眼', () => {
  const { context, elements, utterances, timers, runNextTimer } = makeContext(false);
  context.speakCurrentModeratorLine();
  utterances.at(-1).onend();
  runNextTimer(); // move to wolf target prompt
  utterances.at(-1).onend();
  assert.equal([...timers.values()].filter(t => !t.cancelled).length, 0, '狼刀未決定時不能自動離開行動步驟');
  assert.equal(vm.runInContext('roomState.moderatorStepIndex', context), 1);
  assert.equal(context.wolfKillTarget(2), true);
  assert.equal(vm.runInContext('roomState.nightVictim', context), 2);
  runNextTimer();
  assert.equal(vm.runInContext('roomState.moderatorStepIndex', context), 2);
  assert.equal(utterances.at(-1).text, '狼人請閉眼。');
  assert.equal(elements.get('godFlowNextButton').hidden, true);
});

test('測試模式保留手動推進，不會在語音結束後自動跳下一句', () => {
  const { context, utterances, timers } = makeContext(true);
  context.speakCurrentModeratorLine();
  utterances.at(-1).onend();
  assert.equal(vm.runInContext('roomState.moderatorStepIndex', context), 0);
  assert.equal([...timers.values()].filter(t => !t.cancelled).length, 0);
  assert.equal(context.advanceModeratorLine(), true);
  assert.equal(vm.runInContext('roomState.moderatorStepIndex', context), 1);
});

test('正式模式隱藏人工主持控制；測試模式顯示下一句和重播工具', () => {
  const formal = makeContext(false);
  formal.context.renderGodFlowPanel();
  assert.equal(formal.elements.get('godFlowNextButton').hidden, true);
  assert.equal(formal.elements.get('godFlowSpeakButton').hidden, true);
  assert.equal(formal.elements.get('godFlowReplayButton').hidden, true);
  const testMode = makeContext(true);
  testMode.context.renderGodFlowPanel();
  assert.equal(testMode.elements.get('godFlowNextButton').hidden, false);
  assert.equal(testMode.elements.get('godFlowSpeakButton').hidden, false);
  assert.equal(testMode.elements.get('godFlowReplayButton').hidden, false);
});


test('正式模式拒絕啟動含尚未實作主動夜間技能的板型，避免上帝流程卡住', () => {
  const { context, alerts } = makeContext(false);
  vm.runInContext(`
    roomState.isTestMode = false;
    roomState.isHost = true;
    roomState.gameStarted = false;
    roomState.gameOver = false;
    roomState.currentPhase = 'LOBBY';
    roomState.playerCount = 6;
    roomState.customRolePool = ['野孩子', '小狼', '小狼', '女巫', '預言家', '平民'];
    roomState.players = Array.from({ length: 6 }, (_, i) => new Player(i + 1, 'P' + (i + 1), '未發牌'));
    roomState.players.forEach(player => { player.isOccupied = true; });
  `, context);
  context.document.getElementById('setupPlayerCount').value = 'custom';
  context.startGameFlow();
  assert.equal(vm.runInContext('roomState.gameStarted', context), false);
  assert.ok(alerts.some(message => message.includes('正式模式尚不能開始')));
  assert.ok(alerts.some(message => message.includes('野孩子')));
});


test('正式模式若瀏覽器沒有語音合成，仍會依狀態自動推進無操作口白', () => {
  const { context, utterances, runNextTimer } = makeContext(false);
  delete context.speechSynthesis;
  context.speakCurrentModeratorLine();
  assert.equal(vm.runInContext('roomState.moderatorSpeechDone', context), true);
  assert.equal(utterances.length, 0);
  runNextTimer();
  assert.equal(vm.runInContext('roomState.moderatorStepIndex', context), 1);
});
