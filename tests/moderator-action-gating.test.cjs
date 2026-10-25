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
  const ensure = (id) => { if (!elements.has(id)) elements.set(id, fakeElement()); return elements.get(id); };
  const context = vm.createContext({
    console, Math, Set, Map, Object, Array, Number, String, Error, TypeError, RangeError, JSON,
    setInterval: () => 123, clearInterval: () => {}, setTimeout: () => 456,
    alert: () => {}, prompt: () => { throw new Error('不應用 prompt 取得行動目標'); },
  });
  context.window = context;
  context.document = { getElementById: ensure, createElement: tag => fakeElement(tag), querySelectorAll: () => [], body: fakeElement('body') };
  for (const relative of [
    'js/role-database.js', 'js/ruleset.js', 'js/game-engine.js', 'js/ui.js',
    'js/game-flow.js', 'js/moderator-script.js', 'js/compendium.js', 'js/app.js',
  ]) vm.runInContext(fs.readFileSync(path.join(root, relative), 'utf8'), context, { filename: relative });
  return { context, elements };
}
function setupWolfAction(context) {
  vm.runInContext(`
    roomState.isTestMode = true;
    roomState.isHost = true;
    roomState.gameStarted = true;
    roomState.gameOver = false;
    roomState.currentPhase = 'NIGHT';
    roomState.currentPerspective = 1;
    roomState.ruleset = window.AwooRuleset.resolveRuleset({ winMode: 'edge' });
    roomState.players = [new Player(1, 'Wolf', '小狼'), new Player(2, 'Civilian', '平民'), new Player(3, 'Witch', '女巫')];
    gameState.players = roomState.players;
    roomState.rolesInGame = ['小狼', '平民', '女巫'];
    roomState.nightVictim = null;
    roomState.wolfActionDecided = false;
    roomState.moderatorScript = [
      { role: '狼人陣營', text: '狼人請殺人，請統一意見。', speechText: '狼人請殺人，請統一意見。', actionKey: 'wolfAttack' },
      { role: '狼人陣營', text: '狼人請閉眼。', speechText: '狼人請閉眼。', actionKey: null },
    ];
    roomState.moderatorStepIndex = 0;
    roomState.moderatorSpeechDone = true;
    roomState.moderatorManualCompletedStepIndex = null;
  `, context);
}

test('上帝唸完狼人殺人指令後，未選擇目標時不能推進下一句', () => {
  const { context, elements } = makeContext();
  setupWolfAction(context);
  context.renderGodFlowPanel();
  assert.equal(elements.get('godFlowNextButton').disabled, true);
  assert.equal(context.advanceModeratorLine(), false);
  assert.equal(vm.runInContext('roomState.moderatorStepIndex', context), 0);
});

test('狼人完成選擇後才解鎖下一句；下一句口白播完後可繼續', () => {
  const { context, elements } = makeContext();
  setupWolfAction(context);
  context.renderGodFlowPanel();
  assert.equal(context.wolfKillTarget(2), true);
  assert.equal(vm.runInContext('roomState.nightVictim', context), 2);
  assert.equal(vm.runInContext('roomState.wolfActionDecided', context), true);
  assert.equal(elements.get('godFlowNextButton').disabled, false);
  assert.equal(context.advanceModeratorLine(), true);
  assert.equal(vm.runInContext('roomState.moderatorStepIndex', context), 1);
  assert.equal(elements.get('godFlowNextButton').disabled, false, '測試環境沒有語音引擎時，步驟應可手動推進');
});

test('正在播放口白時，角色操作和下一句都會被鎖住', () => {
  const { context, elements } = makeContext();
  setupWolfAction(context);
  vm.runInContext('roomState.moderatorSpeechDone = false', context);
  context.renderGodFlowPanel();
  assert.equal(elements.get('godFlowNextButton').disabled, true);
  assert.equal(context.wolfKillTarget(2), false);
  assert.equal(vm.runInContext('roomState.nightVictim', context), null);
});

test('女巫明確選擇不使用毒藥後，才可繼續主持流程且不消耗藥劑', () => {
  const { context, elements } = makeContext();
  vm.runInContext(`
    roomState.isTestMode = true; roomState.isHost = true; roomState.gameStarted = true;
    roomState.gameOver = false; roomState.currentPhase = 'NIGHT'; roomState.currentPerspective = 1;
    roomState.players = [new Player(1, 'Witch', '女巫'), new Player(2, 'Civilian', '平民'), new Player(3, 'Wolf', '小狼')];
    gameState.players = roomState.players;
    roomState.ruleset = window.AwooRuleset.resolveRuleset({ winMode: 'edge' });
    roomState.witchPoisonUsed = false; roomState.witchPoisonDecisionMade = false; roomState.witchPoisonTargetId = null;
    roomState.moderatorScript = [
      { role: '女巫', text: '你有一瓶毒藥，你要毒死誰嗎？請選擇目標。', speechText: '你有一瓶毒藥，你要毒死誰嗎？請選擇目標。', actionKey: 'witchPoisonDecision' },
      { role: '女巫', text: '女巫請閉眼。', speechText: '女巫請閉眼。', actionKey: null },
    ];
    roomState.moderatorStepIndex = 0; roomState.moderatorSpeechDone = true;
  `, context);
  context.renderGodFlowPanel();
  assert.equal(elements.get('godFlowNextButton').disabled, true);
  assert.equal(context.declineWitchPoison(), true);
  assert.equal(vm.runInContext('roomState.witchPoisonUsed', context), false);
  assert.equal(vm.runInContext('roomState.witchPoisonDecisionMade', context), true);
  assert.equal(elements.get('godFlowNextButton').disabled, false);
  assert.equal(context.advanceModeratorLine(), true);
  assert.equal(vm.runInContext('roomState.moderatorStepIndex', context), 1);
});

test('每晚保留已出局神職的主持提示，但略過技能行動', () => {
  const { context } = makeContext();
  vm.runInContext(`
    roomState.gameStarted = true; roomState.gameOver = false; roomState.currentPhase = 'NIGHT';
    roomState.players = [new Player(1, 'Dead Seer', '預言家'), new Player(2, 'Wolf', '小狼'), new Player(3, 'Civilian', '平民')];
    roomState.players[0].isAlive = false;
    roomState.rolesInGame = ['預言家', '小狼', '平民'];
    gameState.players = roomState.players; gameState.currentDay = 2;
    roomState.ruleset = window.AwooRuleset.resolveRuleset({ winMode: 'edge' });
  `, context);
  context.refreshModeratorScriptForCurrentNight();
  const scriptText = vm.runInContext('roomState.moderatorScript.map(step => step.text).join("\\n")', context);
  assert.match(scriptText, /預言家請睜眼/);
  assert.match(scriptText, /預言家已出局，本夜略過行動/);
  assert.match(scriptText, /狼人現身，請睜眼/);
  const deadSeerSteps = vm.runInContext('roomState.moderatorScript.filter(step => step.role === \'預言家\')', context);
  assert.equal(deadSeerSteps.some(step => step.actionKey), false, '已出局角色不得保留可提交技能的 actionKey');
});

test('語音合成的 onend 回呼完成前，下一句保持鎖定；唸完後才解鎖', () => {
  const { context, elements } = makeContext();
  setupWolfAction(context);
  const utterances = [];
  context.SpeechSynthesisUtterance = function (text) { this.text = text; utterances.push(this); };
  context.speechSynthesis = {
    cancel() {},
    getVoices() { return [{ lang: 'zh-TW' }]; },
    speak(utterance) { utterances.push(utterance); },
  };
  const controls = context.document.getElementById('actionControls');
  context.renderNightPanel(vm.runInContext('roomState.players[0]', context), controls);
  context.speakCurrentModeratorLine();
  assert.equal(vm.runInContext('roomState.moderatorSpeechDone', context), false);
  assert.equal(elements.get('godFlowNextButton').disabled, true);
  assert.match(controls.innerHTML, /class=\"target-btn\" disabled onclick=\"wolfKillTarget/);
  const latest = utterances.at(-1);
  latest.onend();
  assert.equal(vm.runInContext('roomState.moderatorSpeechDone', context), true);
  assert.equal(elements.get('godFlowNextButton').disabled, true, '狼人行動尚未完成，口白唸完仍不能直接推進');
  assert.match(controls.innerHTML, /class=\"target-btn\" onclick=\"wolfKillTarget\(2\)/, '口白結束後應啟用可攻擊的存活目標');
  assert.equal(context.wolfKillTarget(2), true);
  assert.equal(elements.get('godFlowNextButton').disabled, false);
});

test('測試用手動步驟需切換到對應角色後確認', () => {
  const { context, elements } = makeContext();
  vm.runInContext(`
    roomState.isTestMode = true; roomState.isHost = true; roomState.gameStarted = true;
    roomState.gameOver = false; roomState.currentPhase = 'NIGHT'; roomState.currentPerspective = 1;
    roomState.players = [new Player(1, 'Civilian', '平民'), new Player(2, 'Wild Child', '野孩子')];
    gameState.players = roomState.players;
    roomState.moderatorScript = [{ role: '野孩子', text: '野孩子請選擇一名玩家作為你的榜樣。', speechText: '野孩子請選擇一名玩家作為你的榜樣。', actionKey: 'manual:野孩子' }];
    roomState.moderatorStepIndex = 0; roomState.moderatorSpeechDone = true;
  `, context);
  context.renderGodFlowPanel();
  assert.equal(context.completeModeratorManualAction(), false);
  assert.equal(vm.runInContext('roomState.moderatorManualCompletedStepIndex', context), null);
  vm.runInContext('roomState.currentPerspective = 2', context);
  assert.equal(context.completeModeratorManualAction(), true);
  assert.equal(vm.runInContext('roomState.moderatorManualCompletedStepIndex', context), 0);
  assert.equal(elements.get('godFlowNextButton').disabled, false);
});


test('女巫確認使用毒藥後才解鎖下一句，目標會保留給夜晚結算', () => {
  const { context, elements } = makeContext();
  vm.runInContext(`
    roomState.isTestMode = true; roomState.isHost = true; roomState.gameStarted = true;
    roomState.gameOver = false; roomState.currentPhase = 'NIGHT'; roomState.currentPerspective = 1;
    roomState.players = [new Player(1, 'Witch', '女巫'), new Player(2, 'Civilian', '平民'), new Player(3, 'Wolf', '小狼')];
    gameState.players = roomState.players;
    roomState.ruleset = window.AwooRuleset.resolveRuleset({ winMode: 'edge' });
    roomState.witchPoisonUsed = false; roomState.witchPoisonDecisionMade = false; roomState.witchPoisonTargetId = null;
    roomState.moderatorScript = [
      { role: '女巫', text: '你有一瓶毒藥，你要毒死誰嗎？請選擇目標。', speechText: '你有一瓶毒藥，你要毒死誰嗎？請選擇目標。', actionKey: 'witchPoisonDecision' },
      { role: '女巫', text: '女巫請閉眼。', speechText: '女巫請閉眼。', actionKey: null },
    ];
    roomState.moderatorStepIndex = 0; roomState.moderatorSpeechDone = true;
  `, context);
  context.renderGodFlowPanel();
  assert.equal(context.useWitchPoison(), true);
  assert.equal(context.selectWitchPoisonTarget(2), true);
  assert.equal(elements.get('godFlowNextButton').disabled, true, '只選目標不應完成技能');
  assert.equal(context.confirmWitchPoison(), true);
  assert.equal(vm.runInContext('roomState.witchPoisonTargetId', context), 2);
  assert.equal(vm.runInContext('roomState.witchPoisonUsed', context), true);
  assert.equal(elements.get('godFlowNextButton').disabled, false);
});


test('角色操作控制項會在輪到該角色且口白播放完成前保持停用', () => {
  const { context, elements } = makeContext();
  setupWolfAction(context);
  vm.runInContext('roomState.moderatorSpeechDone = false', context);
  const controls = context.document.getElementById('actionControls');
  context.renderNightPanel(vm.runInContext('roomState.players[0]', context), controls);
  assert.match(controls.innerHTML, /class=\"target-btn\" disabled onclick=\"wolfKillTarget/);
  assert.match(controls.innerHTML, /confirmWolfNoKill\(\)\" disabled/);
  vm.runInContext("roomState.moderatorScript[0].actionKey = 'witchPoisonDecision'; roomState.moderatorSpeechDone = true", context);
  context.renderNightPanel(vm.runInContext('roomState.players[0]', context), controls);
  assert.match(controls.innerHTML, /class=\"target-btn\" disabled onclick=\"wolfKillTarget/, '未輪到狼人行動時也應保持停用');
  vm.runInContext("roomState.moderatorScript[0].actionKey = 'wolfAttack'; roomState.moderatorSpeechDone = false", context);
  context.renderNightPanel(vm.runInContext('roomState.players[0]', context), controls);
  assert.match(controls.innerHTML, /class=\"target-btn\" disabled onclick=\"wolfKillTarget/);
  vm.runInContext('roomState.moderatorSpeechDone = true', context);
  context.renderNightPanel(vm.runInContext('roomState.players[0]', context), controls);
  assert.match(controls.innerHTML, /class=\"target-btn\" onclick=\"wolfKillTarget\(2\)/, '口白完成後可選擇合法目標；隊友仍反灰');
});


test('女巫兩瓶藥都已使用時，解藥與毒藥口白仍依序保留且流程可繼續', () => {
  const { context } = makeContext();
  vm.runInContext(`
    roomState.isTestMode = true;
    roomState.gameStarted = true;
    roomState.gameOver = false;
    roomState.currentPhase = 'NIGHT';
    roomState.currentPerspective = 1;
    roomState.players = [
      new Player(1, 'Witch', '女巫'),
      new Player(2, 'Wolf', '小狼'),
      new Player(3, 'Civilian', '平民')
    ];
    gameState.players = roomState.players;
    roomState.nightVictim = 2;
    roomState.witchElixirUsed = true;
    roomState.witchPoisonUsed = true;
    roomState.witchSaveDecisionMade = false;
    roomState.witchPoisonDecisionMade = false;
    roomState.moderatorScript = [
      { role: '女巫', text: '今天晚上這位玩家死了，你要救他嗎？', speechText: '今天晚上這位玩家死了，你要救他嗎？', actionKey: 'witchSaveDecision', condition: 'antidote-available' },
      { role: '女巫', text: '你有一瓶毒藥，你要毒死誰嗎？', speechText: '你有一瓶毒藥，你要毒死誰嗎？', actionKey: 'witchPoisonDecision', condition: 'poison-available' },
      { role: '女巫', text: '女巫請閉眼。', speechText: '女巫請閉眼。', actionKey: null },
    ];
    roomState.moderatorStepIndex = 0;
    roomState.moderatorSpeechDone = true;
    roomState.moderatorManualCompletedStepIndex = null;
  `, context);

  assert.equal(context.shouldSkipModeratorStep(vm.runInContext('roomState.moderatorScript[0]', context)), false,
    '存活的狼刀目標存在時，不能因解藥已用而刪掉女巫救人提示');
  assert.equal(context.shouldSkipModeratorStep(vm.runInContext('roomState.moderatorScript[1]', context)), false,
    '毒藥口白不能因毒藥已用而被跳過');
  assert.equal(context.advanceModeratorLine(), true);
  assert.equal(vm.runInContext('roomState.moderatorStepIndex', context), 1,
    '解藥已用時仍應能通過該行動步驟並播放毒藥口白');
  assert.equal(context.advanceModeratorLine(), true);
  assert.equal(vm.runInContext('roomState.moderatorStepIndex', context), 2,
    '毒藥已用時仍應能通過該行動步驟並播放女巫閉眼口白');
});


test('狼人確認夜刀後，全局通知與行動紀錄不會提前洩漏目標號碼', () => {
  const { context, elements } = makeContext();
  setupWolfAction(context);
  const alerts = [];
  context.alert = (message) => alerts.push(String(message));

  assert.equal(context.wolfKillTarget(2), true);
  assert.ok(alerts.length > 0);
  assert.doesNotMatch(alerts.join(' '), /2\s*號|2號/,
    '狼刀目標不能透過全局 alert 提前曝光');
  assert.match(elements.get('actionControls').innerHTML, /已完成狼人行動：2號/,
    '狼人自己的控制台仍應保留行動確認資訊');

  const history = JSON.parse(vm.runInContext('JSON.stringify(roomState.actionHistory)', context));
  assert.ok(history.some(entry => entry.visibility === 'private' && /2\s*號/.test(entry.message)),
    '目標號碼仍需保存在私密行動紀錄中');
  assert.doesNotMatch(elements.get('gameHistoryLog').innerHTML, /狼人夜刀指定|2\s*號/,
    '全局可展開紀錄不得顯示狼人私密夜刀目標');
});
