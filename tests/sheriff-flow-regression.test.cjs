const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const scripts = ['js/role-database.js', 'js/ruleset.js', 'js/game-engine.js', 'js/ui.js', 'js/game-flow.js', 'js/moderator-script.js', 'js/compendium.js', 'js/app.js'];

function fakeElement() {
  const el = { style: {}, children: [], listeners: {}, textContent: '', innerText: '', value: '', disabled: false, hidden: false,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    append(...items) { this.children.push(...items); }, appendChild(item) { this.children.push(item); return item; },
    addEventListener(name, fn) { this.listeners[name] = fn; }, setAttribute() {}, remove() {} };
  let html = '';
  Object.defineProperty(el, 'innerHTML', { get: () => html, set: value => { html = String(value); } });
  return el;
}

function createContext() {
  const elements = new Map();
  const ensure = id => { if (!elements.has(id)) elements.set(id, fakeElement()); return elements.get(id); };
  let timerId = 0;
  const context = vm.createContext({ console, Math, Set, Map, Object, Array, Number, String, Error, TypeError, RangeError, JSON,
    setInterval: () => ++timerId, clearInterval: () => {}, setTimeout: () => ++timerId, clearTimeout: () => {}, alert: () => {}, prompt: () => null });
  context.window = context;
  context.document = { getElementById: ensure, createElement: fakeElement, querySelectorAll: () => [] };
  for (const file of scripts) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  const events = [];
  context.renderGodFlowPanel = () => {};
  context.renderTable = () => {};
  context.updateControlPanel = () => {};
  context.updateBanner = () => {};
  context.renderGameHistory = () => {};
  context.flushPendingDawnHistory = () => events.push('NIGHT_DEATHS_REVEALED');
  context.speakGod = (line, callback = null) => { events.push(String(line)); if (typeof callback === 'function') callback(); return true; };
  return { context, elements, events };
}

function players(context, definitions) {
  context.__definitions = definitions;
  const result = vm.runInContext("__definitions.map((d,i)=>{const p=new Player(i+1,'P'+(i+1),d.role);Object.assign(p,d);return p;})", context);
  delete context.__definitions;
  return result;
}

function setup(context, playerList, phase) {
  context.__players = playerList;
  context.__phase = phase;
  vm.runInContext("roomState.players=__players;roomState.playerCount=__players.length;roomState.gameStarted=true;roomState.gameOver=false;roomState.currentPhase=__phase;roomState.currentPerspective=1;roomState.sheriffMode='enabled';roomState.hasSheriffInGame=false;roomState.sheriffId=null;roomState.sheriffCandidates=[];roomState.sheriffVotes={};roomState.sheriffElectionRound=1;roomState.lastNightDeaths=[];roomState.firstNightDeathsHiddenUntilDawn=false;roomState.deathSkillQueue=[];roomState.deathSkillDeaths=[];roomState.guardLastTarget=null;roomState.ruleset=AwooRuleset.resolveRuleset();gameState.players=roomState.players;gameState.currentDay=1;gameState.currentPhase=__phase;gameState.sheriffId=null;", context);
  delete context.__players;
  delete context.__phase;
}

test('SFE-01 夜間角色行動未完成時不得推進主持流程', () => {
  const { context } = createContext();
  setup(context, players(context, [{ role: '小狼' }, { role: '平民' }]), 'NIGHT');
  vm.runInContext("roomState.moderatorScript=[{role:'狼人',actionKey:'wolfAttack'},{role:'全體',actionKey:null}];roomState.moderatorStepIndex=0;roomState.moderatorSpeechDone=true;roomState.wolfActionDecided=false;roomState.isTestMode=true;", context);
  assert.equal(context.advanceModeratorLine(), false);
  assert.equal(vm.runInContext('roomState.moderatorStepIndex', context), 0);
});

test('SFE-02 夜間行動完成後先進入警長競選', () => {
  const { context, events } = createContext();
  setup(context, players(context, [{ role: '小狼' }, { role: '平民' }]), 'NIGHT');
  vm.runInContext('roomState.nightVictim=2;', context);
  context.startSheriffCountdown = () => events.push('SHERIFF_ELECTION_STARTED');
  assert.equal(context.resolveNightNow(), true);
  assert.equal(vm.runInContext('roomState.currentPhase', context), 'SHERIFF_ELECTION');
  assert.ok(events.includes('SHERIFF_ELECTION_STARTED'));
  assert.ok(events.some(line => line.includes('天將破曉')));
});

test('SFE-03 待公布死亡者仍可上警，且不需要恢復 isAlive', () => {
  const { context } = createContext();
  setup(context, players(context, [{ role: '預言家', isAlive: false, lifeState: 'PENDING_DEATH' }, { role: '平民' }]), 'SHERIFF_ELECTION');
  assert.equal(context.candidateSheriff(1), true);
  assert.deepEqual([...vm.runInContext('roomState.sheriffCandidates', context)], [1]);
});

test('SFE-04 待公布死亡者上警後可保留在候選名單', () => {
  const { context } = createContext();
  setup(context, players(context, [{ role: '預言家', isAlive: false, lifeState: 'PENDING_DEATH' }, { role: '平民' }, { role: '小狼' }]), 'SHERIFF_ELECTION');
  vm.runInContext('roomState.sheriffCandidates=[1,2];', context);
  context.processSheriffCandidates();
  assert.deepEqual([...vm.runInContext('roomState.sheriffCandidates', context)], [1,2]);
});

test('SFE-05 待公布死亡候選人可以正常退水', () => {
  const { context } = createContext();
  setup(context, players(context, [{ role: '預言家', isAlive: false, lifeState: 'PENDING_DEATH' }, { role: '平民' }]), 'SHERIFF_ELECTION');
  vm.runInContext('roomState.sheriffCandidates=[1];', context);
  assert.equal(context.candidateSheriff(1), true);
  assert.deepEqual([...vm.runInContext('roomState.sheriffCandidates', context)], []);
});

test('SFE-06 待公布死亡且位於警下的玩家依一般資格仍可投票', () => {
  const { context } = createContext();
  setup(context, players(context, [{ role: '預言家' }, { role: '小狼' }, { role: '平民', isAlive: false, lifeState: 'PENDING_DEATH' }]), 'SHERIFF_VOTING');
  vm.runInContext('roomState.currentPerspective=3;roomState.sheriffCandidates=[1,2];', context);
  assert.equal(context.voteSheriff(1), true);
  assert.equal(vm.runInContext('roomState.sheriffVotes["3"]', context), 1);
});

test('SFE-07 多位警長候選人必須先進入逐位候選發言階段', () => {
  const { context } = createContext();
  setup(context, players(context, [{ role: '預言家' }, { role: '平民' }, { role: '小狼' }]), 'SHERIFF_ELECTION');
  vm.runInContext('roomState.sheriffCandidates=[1,2];', context);
  context.processSheriffCandidates();
  assert.equal(vm.runInContext('roomState.currentPhase', context), 'SHERIFF_CANDIDATE_SPEECH');
  assert.deepEqual([...vm.runInContext('roomState.sheriffSpeechQueue', context)], [1,2]);
});

test('SFE-08 警長競選未完成不得進入天亮或公布死訊', () => {
  const { context, events } = createContext();
  setup(context, players(context, [{ role: '預言家' }, { role: '平民' }]), 'SHERIFF_ELECTION');
  vm.runInContext('roomState.lastNightDeaths=[{id:2,reason:"KILLED_BY_WOLF"}];', context);
  assert.equal(context.announceDayDeath(), false);
  assert.equal(vm.runInContext('roomState.currentPhase', context), 'SHERIFF_ELECTION');
  assert.equal(events.length, 0);
});

test('SFE-09 競選完成後才播天亮口白並公布死訊', () => {
  const { context, events } = createContext();
  setup(context, players(context, [{ role: '預言家' }, { role: '平民' }]), 'SHERIFF_ELECTION');
  vm.runInContext('roomState.sheriffCandidates=[1];roomState.lastNightDeaths=[{id:2,reason:"KILLED_BY_WOLF"}];', context);
  context.electSheriff(1);
  const dawnIndex = events.findIndex(line => line.includes('天亮請睜眼'));
  const deathIndex = events.findIndex(line => line.includes('天亮了'));
  assert.ok(dawnIndex >= 0, '應播放「天亮請睜眼」');
  assert.ok(deathIndex > dawnIndex, '天亮口白必須早於昨夜死訊');
});

test('SFE-10 夜間死亡須保留 PENDING_DEATH，不得暫時恢復 isAlive', () => {
  const { context } = createContext();
  setup(context, players(context, [{ role: '小狼' }, { role: '平民' }]), 'NIGHT');
  vm.runInContext('roomState.nightVictim=2;', context);
  assert.equal(context.resolveNightNow(), true);
  assert.equal(vm.runInContext('roomState.players[1].lifeState', context), 'PENDING_DEATH');
  assert.equal(vm.runInContext('roomState.players[1].isAlive', context), false);
});

test('SFE-11 待公布死亡者當選警長後必須保留 sheriffId', () => {
  const { context } = createContext();
  setup(context, players(context, [{ role: '預言家', isAlive: false, lifeState: 'PENDING_DEATH' }, { role: '平民' }]), 'SHERIFF_ELECTION');
  context.electSheriff(1);
  assert.equal(vm.runInContext('roomState.sheriffId', context), 1);
  assert.equal(vm.runInContext('roomState.hasSheriffInGame', context), true);
});

test('SFE-12 當選警長天亮出局後須進入警徽處理', () => {
  const { context, events } = createContext();
  const list = players(context, [{ role: '預言家', isAlive: false, isSheriff: true, lifeState: 'PENDING_DEATH' }, { role: '平民' }]);
  setup(context, list, 'SHERIFF_ELECTION');
  vm.runInContext("roomState.sheriffId=1;roomState.hasSheriffInGame=true;gameState.sheriffId=1;roomState.players[0].isSheriff=true;roomState.lastNightDeaths=[{id:1,reason:'KILLED_BY_WOLF'}];", context);
  context.checkWinCondition = () => null;
  context.announceDayDeath();
  assert.ok(events.some(line => line.includes('天亮了')));
  assert.equal(vm.runInContext('roomState.currentPhase', context), 'SHERIFF_BADGE');
  assert.equal(vm.runInContext('roomState.sheriffId', context), 1);
});

test('SFE-13 無候選人時以無警長結束並繼續天亮', () => {
  const { context } = createContext();
  setup(context, players(context, [{ role: '預言家' }, { role: '平民' }]), 'SHERIFF_ELECTION');
  context.processSheriffCandidates();
  assert.equal(vm.runInContext('roomState.hasSheriffInGame', context), false);
  assert.equal(vm.runInContext('roomState.currentPhase', context), 'DAY_DEATH');
});

test('SFE-14 首輪警長票平票後進入第二輪並清空票箱', () => {
  const { context } = createContext();
  setup(context, players(context, [{ role: '預言家' }, { role: '平民' }, { role: '小狼' }, { role: '女巫' }]), 'SHERIFF_VOTING');
  vm.runInContext('roomState.sheriffCandidates=[1,2];roomState.sheriffVotes={"3":1,"4":2};', context);
  context.finalizeSheriffVote();
  assert.equal(vm.runInContext('roomState.sheriffElectionRound', context), 2);
  assert.deepEqual({ ...vm.runInContext('roomState.sheriffVotes', context) }, {});
});

test('SFE-15 第二輪仍平票時以無警長結束', () => {
  const { context } = createContext();
  setup(context, players(context, [{ role: '預言家' }, { role: '平民' }, { role: '小狼' }, { role: '女巫' }]), 'SHERIFF_VOTING');
  vm.runInContext('roomState.sheriffCandidates=[1,2];roomState.sheriffVotes={"3":1,"4":2};roomState.sheriffElectionRound=2;', context);
  context.finalizeSheriffVote();
  assert.equal(vm.runInContext('roomState.hasSheriffInGame', context), false);
  assert.equal(vm.runInContext('roomState.currentPhase', context), 'DAY_DEATH');
});

test('SFE-16 夜間死亡技能只能在基本死訊公告後觸發', () => {
  const { context, events } = createContext();
  setup(context, players(context, [{ role: '獵人', isAlive: false, deathReason: 'KILLED_BY_WOLF' }, { role: '平民' }]), 'SHERIFF_ELECTION');
  vm.runInContext('roomState.lastNightDeaths=[{id:1,reason:"KILLED_BY_WOLF"}];', context);
  context.startDeathSkillResolution = () => { events.push('DEATH_SKILL_STARTED'); return true; };
  context.announceDayDeath();
  const revealIndex = events.findIndex(line => line.includes('天亮了'));
  const skillIndex = events.indexOf('DEATH_SKILL_STARTED');
  assert.ok(revealIndex >= 0);
  assert.ok(skillIndex > revealIndex);
});
