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
  assert.match(scriptText, /今天晚上你要驗誰/);
  assert.doesNotMatch(scriptText, /預言家已出局|已出局，本夜略過行動/,
    '公開主持口白不可洩漏神職已出局');
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
  assert.equal(alerts.length, 0,
    '確認狼刀後不應再顯示會中斷主持流程的行動已記錄通知');
  assert.match(elements.get('actionControls').innerHTML, /已完成狼人行動：2號/,
    '狼人自己的控制台仍應保留行動確認資訊');

  const history = JSON.parse(vm.runInContext('JSON.stringify(roomState.actionHistory)', context));
  assert.ok(history.some(entry => entry.visibility === 'private' && /2\s*號/.test(entry.message)),
    '目標號碼仍需保存在私密行動紀錄中');
  assert.doesNotMatch(elements.get('gameHistoryLog').innerHTML, /狼人夜刀指定|2\s*號/,
    '全局可展開紀錄不得顯示狼人私密夜刀目標');
});


test('狼刀號碼只在女巫救人提示已播完後顯示於女巫控制台', () => {
  const { context, elements } = makeContext();
  vm.runInContext(`
    roomState.isTestMode = true;
    roomState.gameStarted = true;
    roomState.gameOver = false;
    roomState.currentPhase = 'NIGHT';
    roomState.currentPerspective = 3;
    roomState.players = [
      new Player(1, 'Wolf', '小狼'),
      new Player(2, 'Target', '平民'),
      new Player(3, 'Witch', '女巫')
    ];
    gameState.players = roomState.players;
    roomState.nightVictim = 2;
    roomState.witchElixirUsed = false;
    roomState.witchSaveDecisionMade = false;
    roomState.witchPoisonUsed = false;
    roomState.witchPoisonDecisionMade = false;
    roomState.moderatorScript = [{
      role: '狼人陣營', text: '狼人請閉眼。', speechText: '狼人請閉眼。', actionKey: null
    }];
    roomState.moderatorStepIndex = 0;
    roomState.moderatorSpeechDone = true;
  `, context);

  const controls = context.document.getElementById('actionControls');
  const witch = vm.runInContext('roomState.players[2]', context);
  context.renderNightPanel(witch, controls);
  assert.doesNotMatch(controls.innerHTML, /今晚狼刀目標/,
    '狼人完成選擇後、尚未進入女巫救人提示時，不可顯示狼刀號碼');

  vm.runInContext(`
    roomState.moderatorScript = [{
      role: '女巫', text: '今天晚上這位玩家死了，你要救他嗎？',
      speechText: '今天晚上這位玩家死了，你要救他嗎？',
      actionKey: 'witchSaveDecision', condition: 'antidote-available'
    }];
    roomState.moderatorStepIndex = 0;
    roomState.moderatorSpeechDone = false;
  `, context);
  context.renderNightPanel(witch, controls);
  assert.doesNotMatch(controls.innerHTML, /今晚狼刀目標/,
    '女巫救人提示尚未播完時仍不可顯示狼刀號碼');

  vm.runInContext('roomState.moderatorSpeechDone = true', context);
  context.renderNightPanel(witch, controls);
  assert.match(controls.innerHTML, /今晚狼刀目標：[\s\S]*?2號/,
    '女巫救人提示播完後，女巫控制台才顯示狼刀號碼');
});


test('測試模式跳過口白只跳過語音，不可略過尚未完成的角色行動', () => {
  const { context } = makeContext();
  setupWolfAction(context);
  vm.runInContext('roomState.moderatorSpeechDone = false', context);

  assert.equal(context.skipModeratorSpeech(), true);
  assert.equal(vm.runInContext('roomState.moderatorStepIndex', context), 0,
    '狼人尚未選擇目標時，跳過口白不能推進到下一句');
  assert.equal(vm.runInContext('roomState.moderatorSpeechDone', context), true);
  assert.equal(context.advanceModeratorLine(), false,
    '跳過語音後仍須等待狼人完成行動');

  assert.equal(context.wolfKillTarget(2), true);
  assert.equal(context.advanceModeratorLine(), true,
    '狼人完成合法行動後才可進入下一句口白');
  assert.equal(vm.runInContext('roomState.moderatorStepIndex', context), 1);
});


test('狼人控制台會列出所有其他狼人隊友並標示已出局狀態', () => {
  const { context } = makeContext();
  vm.runInContext(`
    roomState.isTestMode = true;
    roomState.gameStarted = true;
    roomState.gameOver = false;
    roomState.currentPhase = 'NIGHT';
    roomState.currentPerspective = 1;
    roomState.ruleset = window.AwooRuleset.resolveRuleset({ winMode: 'edge' });
    roomState.players = [
      new Player(1, 'Wolf A', '小狼'),
      new Player(2, 'Wolf B', '小狼'),
      new Player(3, 'Wolf C', '狼王'),
      new Player(4, 'Civilian', '平民')
    ];
    roomState.players[2].isAlive = false;
    gameState.players = roomState.players;
    roomState.rolesInGame = ['小狼', '狼王', '平民'];
    roomState.moderatorScript = [{
      role: '狼人陣營', text: '狼人現身，請睜眼。', speechText: '狼人現身，請睜眼。', actionKey: 'wolfAttack'
    }];
    roomState.moderatorStepIndex = 0;
    roomState.moderatorSpeechDone = true;
    roomState.nightVictim = null;
    roomState.wolfActionDecided = false;
  `, context);

  const controls = context.document.getElementById('actionControls');
  context.renderNightPanel(vm.runInContext('roomState.players[0]', context), controls);
  assert.match(controls.innerHTML, /狼隊隊友：<b>2號、3號（已出局）<\/b>/,
    '應顯示其他狼人隊友座位，並將已出局隊友明確標示');
  assert.doesNotMatch(controls.innerHTML, /1號（已出局）/,
    '不應把當前視角玩家當成自己的隊友列出');
});

test('共用目標格會禁用預言家自驗、已出局目標與守衛連守目標', () => {
  const { context } = makeContext();
  vm.runInContext(`
    roomState.isTestMode = true;
    roomState.gameStarted = true;
    roomState.gameOver = false;
    roomState.currentPhase = 'NIGHT';
    roomState.currentPerspective = 1;
    roomState.ruleset = window.AwooRuleset.resolveRuleset({ winMode: 'edge' });
    roomState.players = [
      new Player(1, 'Seer/Guard', '預言家'),
      new Player(2, 'Living', '平民'),
      new Player(3, 'Dead', '平民'),
      new Player(4, 'Living 2', '小狼')
    ];
    roomState.players[2].isAlive = false;
    gameState.players = roomState.players;
    roomState.moderatorScript = [{
      role: '預言家', text: '今天晚上你要驗誰？', speechText: '今天晚上你要驗誰？', actionKey: 'seerCheck'
    }];
    roomState.moderatorStepIndex = 0;
    roomState.moderatorSpeechDone = true;
    roomState.seerTargetId = null;
    roomState.guardTargetId = null;
    roomState.guardLastTarget = 2;
  `, context);

  const controls = context.document.getElementById('actionControls');
  context.renderNightPanel(vm.runInContext('roomState.players[0]', context), controls);
  assert.match(controls.innerHTML, /class="target-btn"\s+disabled onclick="seerCheck\(1\)"/,
    '預言家自驗必須禁用');
  assert.match(controls.innerHTML, /class="target-btn"\s+onclick="seerCheck\(2\)"/,
    '存活且合法的預言家目標必須可選');
  assert.match(controls.innerHTML, /class="target-btn is-dead"\s+disabled onclick="seerCheck\(3\)"/,
    '已出局目標必須反灰並禁用');

  vm.runInContext(`
    roomState.players[0].role = '守衛';
    roomState.moderatorScript = [{
      role: '守衛', text: '守衛請選擇守護目標。', speechText: '守衛請選擇守護目標。', actionKey: 'guardProtect'
    }];
    roomState.moderatorStepIndex = 0;
    roomState.guardTargetId = null;
  `, context);
  context.renderNightPanel(vm.runInContext('roomState.players[0]', context), controls);
  assert.match(controls.innerHTML, /class="target-btn"\s+disabled onclick="guardProtect\(2\)"/,
    '守衛上一晚守過的目標必須禁用');
  assert.match(controls.innerHTML, /class="target-btn is-dead"\s+disabled onclick="guardProtect\(3\)"/,
    '守衛不能選擇已出局的目標');
  assert.match(controls.innerHTML, /class="target-btn"\s+onclick="guardProtect\(4\)"/,
    '守衛仍可選擇其他合法存活目標');
});

test('全局行動紀錄預設收合，點擊後可展開並再次收合', () => {
  const { context } = makeContext();
  const panel = context.document.getElementById('gameHistoryPanel');
  const details = context.document.getElementById('gameHistoryLog');
  const button = context.document.getElementById('gameHistoryToggle');
  const label = { textContent: '查看紀錄' };
  let expanded = false;

  panel.classList.toggle = () => {
    expanded = !expanded;
    return expanded;
  };
  details.hidden = true;
  button.attributes = {};
  button.setAttribute = (name, value) => { button.attributes[name] = String(value); };
  button.querySelector = () => label;

  assert.equal(details.hidden, true);
  assert.equal(context.toggleGameHistory(), true);
  assert.equal(details.hidden, false);
  assert.equal(button.attributes['aria-expanded'], 'true');
  assert.equal(label.textContent, '收起紀錄');

  assert.equal(context.toggleGameHistory(), true);
  assert.equal(details.hidden, true);
  assert.equal(button.attributes['aria-expanded'], 'false');
  assert.equal(label.textContent, '查看紀錄');
});


test('全局紀錄收合時只渲染最新兩筆，展開後才渲染完整紀錄', () => {
  const { context, elements } = makeContext();
  const panel = context.document.getElementById('gameHistoryPanel');
  panel.classList.contains = () => false;
  vm.runInContext(`
    roomState.actionHistory = [
      { day: 1, visibility: 'public', phaseLabel: 'A', message: '紀錄一' },
      { day: 1, visibility: 'public', phaseLabel: 'B', message: '紀錄二' },
      { day: 2, visibility: 'public', phaseLabel: 'C', message: '紀錄三' },
      { day: 2, visibility: 'public', phaseLabel: 'D', message: '紀錄四' }
    ];
  `, context);
  context.renderGameHistory();
  assert.doesNotMatch(elements.get('gameHistoryLog').innerHTML, /紀錄一|紀錄二/);
  assert.match(elements.get('gameHistoryLog').innerHTML, /紀錄三/);
  assert.match(elements.get('gameHistoryLog').innerHTML, /紀錄四/);

  panel.classList.contains = () => true;
  context.renderGameHistory();
  for (const message of ['紀錄一', '紀錄二', '紀錄三', '紀錄四']) {
    assert.match(elements.get('gameHistoryLog').innerHTML, new RegExp(message));
  }
});


test('獵人死亡技能面板列出座位目標與不開槍，選擇不開槍後可繼續流程', () => {
  const { context, elements } = makeContext();
  vm.runInContext(`
    roomState.isTestMode = true;
    roomState.gameStarted = true;
    roomState.gameOver = false;
    roomState.currentPhase = 'DEATH_SKILL';
    roomState.currentPerspective = 1;
    roomState.playerCount = 6;
    roomState.sheriffMode = 'disabled';
    roomState.ruleset = window.AwooRuleset.resolveRuleset({ winMode: 'edge' });
    roomState.players = [
      new Player(1, 'Hunter', '獵人'),
      new Player(2, 'Wolf', '小狼'),
      new Player(3, 'Civilian 1', '平民'),
      new Player(4, 'Civilian 2', '平民'),
      new Player(5, 'Seer', '預言家'),
      new Player(6, 'Guard', '守衛')
    ];
    roomState.players[0].isAlive = false;
    roomState.players[0].deathReason = 'KILLED_BY_WOLF';
    gameState.players = roomState.players;
    roomState.lastNightDeaths = [{ id: 1, reason: 'KILLED_BY_WOLF' }];
    roomState.deathSkillQueue = [{ playerId: 1, deathReason: 'KILLED_BY_WOLF', skill: { type: 'hunter-shot', role: '獵人' } }];
    roomState.deathSkillReturnPhase = 'DAY_DEATH';
    roomState.deathSkillExecutedVictim = null;
    roomState.deathSkillDeaths = [];
  `, context);
  context.updateBanner = () => {};
  context.speakGod = () => {};
  context.renderTable = () => {};
  context.startNoSheriffSpeech = () => {};
  context.updateControlPanel = () => {};

  context.renderDeathSkillPanel(vm.runInContext('roomState.players[0]', context), elements.get('actionControls') || context.document.getElementById('actionControls'));
  const html = context.document.getElementById('actionControls').innerHTML;
  assert.match(html, /resolveCurrentDeathSkill\(2\)/);
  assert.match(html, /resolveCurrentDeathSkill\(3\)/);
  assert.match(html, /不開槍/);
  assert.equal(context.declineCurrentDeathSkill(), true);
  assert.equal(vm.runInContext('roomState.deathSkillQueue.length', context), 0);
  assert.equal(vm.runInContext('roomState.players[0].deathSkillUsed', context), true);
  assert.equal(vm.runInContext('roomState.currentPhase', context), 'DAY_DEATH');
});


test('夜間死亡紀錄需等上帝完成天亮公告後才寫入公開紀錄', () => {
  const { context, elements } = makeContext();
  vm.runInContext(`
    roomState.players = [
      new Player(1, 'Wolf', '小狼'),
      new Player(2, 'Target', '平民'),
      new Player(3, 'Seer', '預言家')
    ];
    gameState.players = roomState.players;
    gameState.currentDay = 2;
    roomState.ruleset = window.AwooRuleset.resolveRuleset({ winMode: 'edge' });
    roomState.guardLastTarget = null;
    roomState.actionHistory = [];
    roomState.pendingDawnHistory = null;
  `, context);

  context.settleNightActions(2, null, null, null);
  assert.equal(vm.runInContext('roomState.actionHistory.filter(item => item.visibility !== "private").length', context), 0,
    '結算死亡名單不應提前出現在全局紀錄');
  assert.equal(vm.runInContext('roomState.pendingDawnHistory.message', context), '2號');

  assert.equal(context.flushPendingDawnHistory(), true);
  assert.equal(vm.runInContext('roomState.pendingDawnHistory', context), null);
  assert.match(elements.get('gameHistoryLog').innerHTML, /2號/);
});


test('正式模式不顯示可能洩漏隱藏角色資訊的主持備註，測試模式仍可檢視', () => {
  const { context, elements } = makeContext();
  vm.runInContext(`
    roomState.gameStarted = true;
    roomState.gameOver = false;
    roomState.currentPhase = 'NIGHT';
    roomState.isTestMode = false;
    roomState.moderatorScript = [{
      role: '預言家', text: '預言家請睜眼。',
      speechText: '預言家請睜眼。',
      note: '私密測試備註',
      actionKey: null
    }];
    roomState.moderatorStepIndex = 0;
    roomState.moderatorNotices = ['預言家：測試用隱藏角色備註'];
    roomState.moderatorSpeechDone = true;
  `, context);
  context.renderGodFlowPanel();
  assert.equal(elements.get('godFlowNote').textContent, '');
  assert.equal(elements.get('godFlowNotices').textContent, '');

  vm.runInContext('roomState.isTestMode = true', context);
  context.renderGodFlowPanel();
  assert.equal(elements.get('godFlowNote').textContent, '私密測試備註');
  assert.match(elements.get('godFlowNotices').textContent, /預言家/);
});


test('遊戲結束後再開一局會保留房間與玩家，並清除上一局狀態', () => {
  const { context, elements } = makeContext();
  vm.runInContext(`
    roomState.isHost = true;
    roomState.roomId = 'AWOO-1234';
    roomState.playerCount = 3;
    roomState.currentPhase = 'GAME_OVER';
    roomState.gameStarted = true;
    roomState.gameOver = true;
    roomState.players = [
      new Player(1, 'Alice', '預言家'),
      new Player(2, 'Bob', '小狼'),
      new Player(3, 'Carol', '女巫')
    ];
    roomState.players[1].isAlive = false;
    roomState.players[1].deathReason = 'KILLED_BY_WOLF';
    roomState.players[2].isSheriff = true;
    roomState.actionHistory = [{ day: 1, visibility: 'public', phaseLabel: '白天出局', message: '2號' }];
    roomState.pendingDawnHistory = { message: '2號' };
    roomState.userVotes = { 1: 2 };
    roomState.sheriffCandidates = [3];
    roomState.deathSkillQueue = [{ playerId: 2 }];
    gameState.players = roomState.players;
    gameState.currentDay = 3;
  `, context);
  context.updatePerspectiveSelect = () => {};
  context.updateBanner = () => {};
  context.renderTable = () => {};
  context.renderGameHistory = () => {};
  context.renderGodFlowPanel = () => {};
  context.updateControlPanel = () => {};

  assert.equal(context.restartGame(), true);
  assert.equal(vm.runInContext('roomState.roomId', context), 'AWOO-1234');
  assert.deepEqual(Array.from(vm.runInContext('roomState.players.map(p => p.name)', context)), ['Alice', 'Bob', 'Carol']);
  assert.equal(vm.runInContext('roomState.currentPhase', context), 'LOBBY');
  assert.equal(vm.runInContext('roomState.gameStarted', context), false);
  assert.equal(vm.runInContext('roomState.gameOver', context), false);
  assert.equal(vm.runInContext('gameState.currentDay', context), 1);
  assert.equal(vm.runInContext('roomState.players.every(p => p.isAlive && p.role === "未發牌" && !p.isSheriff)', context), true);
  assert.equal(vm.runInContext('roomState.actionHistory.length', context), 0);
  assert.equal(vm.runInContext('roomState.pendingDawnHistory', context), null);
  assert.equal(vm.runInContext('Object.keys(roomState.userVotes).length', context), 0);
  assert.equal(vm.runInContext('roomState.deathSkillQueue.length', context), 0);
});

test('非房主或非遊戲結束狀態不能呼叫再開一局', () => {
  const { context } = makeContext();
  vm.runInContext(`
    roomState.isHost = false;
    roomState.currentPhase = 'GAME_OVER';
    roomState.gameOver = true;
  `, context);
  assert.equal(context.restartGame(), false);
  vm.runInContext('roomState.isHost = true; roomState.currentPhase = "NIGHT"; roomState.gameOver = false', context);
  assert.equal(context.restartGame(), false);
});
