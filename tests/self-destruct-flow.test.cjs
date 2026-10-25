const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const browserScripts = [
  'js/role-database.js',
  'js/ruleset.js',
  'js/game-engine.js',
  'js/ui.js',
  'js/game-flow.js',
  'js/moderator-script.js',
  'js/compendium.js',
  'js/app.js',
];

function makeElement(tagName) {
  return {
    tagName,
    className: '',
    textContent: '',
    type: '',
    children: [],
    listeners: {},
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); },
    addEventListener(name, callback) { this.listeners[name] = callback; },
  };
}

function createContext() {
  const context = vm.createContext({
    console,
    Math,
    Set,
    Map,
    Object,
    Array,
    Number,
    String,
    Error,
    TypeError,
    RangeError,
    JSON,
    setInterval: () => 123,
    clearInterval: () => {},
    setTimeout: () => 456,
    alert: () => {},
  });
  context.window = context;
  context.document = {
    getElementById: () => null,
    createElement: makeElement,
  };
  for (const relativePath of browserScripts) {
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    vm.runInContext(source, context, { filename: relativePath });
  }
  return context;
}

test('點擊小狼自爆會中止白天、清除當輪投票並立即進入下一夜', () => {
  const context = createContext();
  const result = vm.runInContext(`
    (() => {
      const players = [
        { id: 1, name: '1號', role: '小狼', isAlive: true, deathReason: null, isProtected: false, isSheriff: false },
        { id: 2, name: '2號', role: '小狼', isAlive: true, deathReason: null, isProtected: false, isSheriff: false },
        { id: 3, name: '3號', role: '預言家', isAlive: true, deathReason: null, isProtected: false, isSheriff: false },
        { id: 4, name: '4號', role: '平民', isAlive: true, deathReason: null, isProtected: false, isSheriff: false },
      ];
      roomState.players = players;
      roomState.playerCount = players.length;
      roomState.currentPhase = 'DAY_SPEECH';
      roomState.currentPerspective = 1;
      roomState.isSpectator = false;
      roomState.gameStarted = true;
      roomState.gameOver = false;
      roomState.speechQueue = [1, 2, 3, 4];
      roomState.currentQueueIndex = 0;
      roomState.userVotes = { 3: 4 };
      roomState.ruleset = AwooRuleset.resolveRuleset();
      gameState.players = players;
      gameState.currentDay = 1;
      renderTable = () => {};
      updateControlPanel = () => {};
      updateBanner = () => {};
      speakGod = () => {};
      wolfSelfDestruct(1);
      return {
        phase: roomState.currentPhase,
        day: gameState.currentDay,
        alive: players[0].isAlive,
        deathReason: players[0].deathReason,
        voteCount: Object.keys(roomState.userVotes).length,
        queueLength: roomState.speechQueue.length,
        nightVictim: roomState.nightVictim,
        gameOver: roomState.gameOver,
      };
    })()
  `, context);

  assert.equal(result.phase, 'NIGHT');
  assert.equal(result.day, 2);
  assert.equal(result.alive, false);
  assert.equal(result.deathReason, 'WOLF_SELF_DESTRUCT');
  assert.equal(result.voteCount, 0);
  assert.equal(result.queueLength, 0);
  assert.equal(result.nightVictim, null);
  assert.equal(result.gameOver, false);
});

test('白天面板只為可自爆的存活小狼顯示自爆按鈕', () => {
  const context = createContext();
  const cases = vm.runInContext(`
    (() => {
      roomState.ruleset = AwooRuleset.resolveRuleset();
      roomState.currentPhase = 'DAY_SPEECH';
      roomState.isSpectator = false;
      const controlsFor = (role, alive = true) => {
        const player = { id: 1, role, isAlive: alive };
        roomState.players = [player];
        const controls = { children: [], appendChild(child) { this.children.push(child); } };
        appendWolfSelfDestructAction(player, controls);
        return controls.children.length;
      };
      return {
        littleWolf: controlsFor('小狼'),
        wolfKing: controlsFor('狼王'),
        deadLittleWolf: controlsFor('小狼', false),
      };
    })()
  `, context);
  assert.deepEqual({ ...cases }, { littleWolf: 1, wolfKing: 0, deadLittleWolf: 0 });
});
