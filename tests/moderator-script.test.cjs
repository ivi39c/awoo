const test = require('node:test');
const assert = require('node:assert/strict');
const RoleDB = require('../js/role-database.js');
const Moderator = require('../js/moderator-script.js');

test('首夜角色只在第一夜叫醒；第二夜不再出现盜賊或邱比特首夜設定', () => {
  const roles = ['盜賊', '邱比特', '小狼', '女巫', '預言家'];
  const nightOne = Moderator.buildNightScript(roles, 1).steps.map(step => step.text).join('\n');
  const nightTwo = Moderator.buildNightScript(roles, 2).steps.map(step => step.text).join('\n');
  assert.match(nightOne, /盜賊請睜眼/);
  assert.match(nightOne, /邱比特請睜眼/);
  assert.doesNotMatch(nightTwo, /盜賊請睜眼/);
  assert.doesNotMatch(nightTwo, /邱比特請睜眼/);
});

test('標準房規未指定順序時預設守衛先行，之後才是狼人、女巫與預言家', () => {
  const result = Moderator.buildNightScript(['小狼', '女巫', '預言家', '守衛'], 2);
  const texts = result.steps.map(step => step.text);
  const indexOf = (phrase) => texts.findIndex(text => text.includes(phrase));
  assert.ok(indexOf('守衛請睜眼') < indexOf('狼人現身，請睜眼'));
  assert.ok(indexOf('狼人現身，請睜眼') < indexOf('女巫請睜眼'));
  assert.ok(indexOf('女巫請睜眼') < indexOf('預言家請睜眼'));
});

test('標準房規固定守衛優先；特別角色會有專屬或明確標示的佔位口白', () => {
  const classic = Moderator.buildNightScript(['小狼', '女巫', '預言家', '守衛'], 2, {
    moderatorNightOrderPreset: 'classic',
  });
  const texts = classic.steps.map(step => step.text);
  assert.ok(texts.findIndex(text => text.includes('守衛請睜眼')) < texts.findIndex(text => text.includes('狼人現身，請睜眼')));
  const result = Moderator.buildNightScript(['小狼', '女巫', '石像鬼', '平民'], 2);
  assert.ok(result.steps.some(step => step.text.includes('石像鬼請睜眼')));
  assert.ok(result.notices.some(notice => notice.includes('石像鬼')) === false, '已知有專屬腳本的角色不應被標記成未知佔位口白');
});

test('所有角色資料均可進入建構器；未有專屬流程時會清楚標記缺口', () => {
  const names = RoleDB.ROLE_DATABASE.map(role => role.name);
  const result = Moderator.buildNightScript(names, 2);
  assert.ok(result.steps.length >= 2);
  assert.equal(result.steps[0].text, '天黑請閉眼。');
  assert.equal(result.steps.at(-1).text, '天亮請睜眼。');
  assert.ok(Array.isArray(result.notices));
});

test('需要角色操作的口白會帶有行動鎖定鍵', () => {
  const result = Moderator.buildNightScript(['小狼', '女巫', '預言家', '守衛'], 2);
  const stepFor = (phrase) => result.steps.find(step => step.text.includes(phrase));
  assert.equal(stepFor('狼人請選擇今晚要殺的對象').actionKey, 'wolfAttack');
  assert.equal(stepFor('你要救他嗎').actionKey, 'witchSaveDecision');
  assert.equal(stepFor('你要毒死誰嗎').actionKey, 'witchPoisonDecision');
  assert.equal(stepFor('今天晚上你要驗誰').actionKey, 'seerCheck');
  assert.equal(stepFor('你要守護誰').actionKey, 'guardProtect');
});

test('未實作的特殊角色選擇口白會標記手動確認，而不是允許直接越過', () => {
  const result = Moderator.buildNightScript(['野孩子', '小狼'], 1);
  const step = result.steps.find(item => item.text.includes('野孩子請選擇一名玩家'));
  assert.ok(step, '應該產生野孩子選擇口白');
  assert.equal(step.actionKey, 'manual:野孩子');
});


test('預女獵守板型包含獵人睜眼、開槍手勢與閉眼口白', () => {
  const result = Moderator.buildNightScript(['小狼', '女巫', '預言家', '守衛', '獵人'], 2);
  const texts = result.steps.map(step => step.text).join('\n');
  assert.match(texts, /獵人請睜眼/);
  assert.match(texts, /今晚開槍請比手勢/);
  assert.match(texts, /獵人請閉眼/);
  const hunterSteps = result.steps.filter(step => step.role === '獵人');
  assert.equal(hunterSteps.length, 3, '獵人應有睜眼、手勢提示、閉眼三句口白');
  assert.ok(hunterSteps.every(step => !step.actionKey),
    '手勢提示是主持口白，不得被誤判成夜間死亡技能行動或鎖住流程');
});


test('首夜配置狼王時新增比讚口白；沒有狼王時不叫醒狼王', () => {
  const withKing = Moderator.buildNightScript(['小狼', '狼王', '女巫', '預言家'], 1).steps;
  const withoutKing = Moderator.buildNightScript(['小狼', '女巫', '預言家'], 1).steps;
  const confirmIndex = withKing.findIndex(step => step.text.includes('狼人請相互確認身份'));
  const kingIndex = withKing.findIndex(step => step.text === '狼王請比讚。');
  const attackIndex = withKing.findIndex(step => step.actionKey === 'wolfAttack');
  assert.ok(confirmIndex >= 0 && kingIndex > confirmIndex && attackIndex > kingIndex);
  assert.equal(withKing[kingIndex].postSpeechPauseMs, 1800);
  assert.equal(withoutKing.some(step => step.text.includes('狼王請比讚')), false);
});
