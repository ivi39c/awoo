/**
 * Gothic Crimson & Gold - 狼人殺上帝核心引擎
 */

// 1. 全局狀態宣告
let players = [];
let gameConfig = {
  totalPlayers: 12,
  boardMode: 'AUTO',
  winMode: 'KILL_SIDE' // KILL_SIDE (屠邊), KILL_ALL (屠城)
};

let gameState = {
  currentDay: 0,
  currentPhase: 'LOBBY', // LOBBY -> NIGHT_START -> [各角色輪次] -> NIGHT_SETTLE -> DAY_START -> VOTE -> WIN_CHECK
  sheriffId: null,
  cupidLoverIds: [],
  amorousTargetId: null,
  thiefBottomCards: [],
  
  // 夜間行動快取緩衝區
  nightActionBuffer: {
    wolfKillSeat: null,
    witchSaved: false,
    witchPoisonSeat: null,
    guardSeat: null,
    lastGuardedSeat: null,
    fearSeat: null,
    dreamerSeat: null,
    dreamerHistory: [] // 用於追蹤連續攝夢人狀態
  },
  
  // 神職特殊消耗品
  witchAntidoteUsed: false,
  witchPoisonUsed: false
};

// 角色輪次隊列定義 (有限狀態機)
const NIGHT_PHASES = [
  'STAGE_NIGHT_START',
  'STAGE_WAKE_EVIL_SHADOW', // 噩夢之影
  'STAGE_WAKE_GUARD',       // 守衛
  'STAGE_WAKE_WEREWOLVES',  // 狼人
  'STAGE_WAKE_WITCH',       // 女巫
  'STAGE_WAKE_SEER',        // 預言家
  'STAGE_WAKE_DREAMER',     // 攝夢人
  'STAGE_NIGHT_SETTLE'      // 夜晚結算
];

let currentPhaseIndex = 0;
let selectedTargetId = null; // 上帝當前點選的目標暫存

// 2. DOM 節點初始化監聽
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('startGameBtn').addEventListener('click', initGame);
  document.getElementById('panelHeader').addEventListener('click', togglePanel);
  document.getElementById('nextPhaseBtn').addEventListener('click', advancePhase);
  document.getElementById('submitActionBtn').addEventListener('click', submitGodAction);
  document.getElementById('skipActionBtn').addEventListener('click', () => { selectedTargetId = null; submitGodAction(); });
});

// 3. 核心：動態人數配置與陣營平衡公式 (Validator)
function initGame() {
  const countInput = parseInt(document.getElementById('playerCount').value);
  const boardSelect = document.getElementById('boardSelect').value;
  
  if (countInput < 6 || countInput > 20) {
    alert('因古老儀式限制，人數必須在 6 至 20 人之間。');
    return;
  }

  gameConfig.totalPlayers = countInput;
  gameConfig.boardMode = boardSelect;

  // 動態計算狼人總數 (萬能公式：四捨五入)
  const wolfCount = Math.round(countInput / 3);
  let godRoles = ['SEER', 'WITCH', 'HUNTER']; // 基礎三神
  
  if (countInput >= 10) godRoles.push('GUARD');
  if (countInput >= 12 && boardSelect === '12_STANDARD') godRoles.push('IDIOT');
  if (boardSelect === '15_CUPID') godRoles.push('CUPID');

  // 計算並填補普通平民 (自動填補機制)
  let villagerCount = countInput - wolfCount - godRoles.length;
  if (villagerCount < 0) {
    alert('神職牌位溢出！請減少人數或更換板型。');
    return;
  }

  // 建立隨機分配角色池
  let rolePool = [];
  for (let i = 0; i < wolfCount; i++) rolePool.push({ role: 'WEREWOLF', faction: 'EVIL_WEREWOLF' });
  for (let i = 0; i < godRoles.length; i++) rolePool.push({ role: godRoles[i], faction: 'GOOD_GOD' });
  for (let i = 0; i < villagerCount; i++) rolePool.push({ role: 'VILLAGER', faction: 'GOOD_VILLAGER' });

  // 洗牌 (Shuffle)
  rolePool.sort(() => Math.random() - 0.5);

  // 寫入玩家陣列
  players = [];
  for (let i = 1; i <= countInput; i++) {
    const assigned = rolePool[i - 1];
    players.push({
      id: i,
      currentRole: assigned.role,
      faction: assigned.faction,
      isAlive: true,
      deathReason: null,
      canShoot: (assigned.role === 'HUNTER' || assigned.role === 'WOLF_KING'),
      idiotFlipped: false
    });
  }

  // 關閉大廳，渲染戰場
  document.getElementById('lobbyOverlay').style.display = 'none';
  renderTable();
  
  // 啟動黑夜有限狀態機
  gameState.currentPhase = 'STAGE_NIGHT_START';
  currentPhaseIndex = 0;
  runPhaseLogic();
}

// 4. 渲染視訊座位區
function renderTable() {
  const container = document.getElementById('tableContainer');
  container.innerHTML = '';

  players.forEach(p => {
    const card = document.createElement('div');
    card.className = `seat-card ${p.isAlive ? '' : 'dead'}`;
    card.id = `seat-${p.id}`;
    
    card.innerHTML = `
      <div class="avatar-video-container">
        <div class="avatar-placeholder">[ 👁️ ${p.id}號 視訊連線 ]<br><span class="role-badge">（隱藏身份）</span></div>
      </div>
      <div class="seat-info">
        <span>座號: ${p.id}</span>
        <span style="color: ${p.isAlive ? '#00ff00' : '#ff0000'}">${p.isAlive ? '存活' : '亡魂'}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

// 5. 有限狀態機核心控制器
function advancePhase() {
  if (gameState.currentPhase.startsWith('STAGE_WAKE_') || gameState.currentPhase === 'STAGE_NIGHT_START') {
    currentPhaseIndex++;
    if (currentPhaseIndex < NIGHT_PHASES.length) {
      gameState.currentPhase = NIGHT_PHASES[currentPhaseIndex];
    } else {
      gameState.currentPhase = 'STAGE_DAY_START';
    }
  } else if (gameState.currentPhase === 'STAGE_DAY_START') {
    gameState.currentPhase = 'STAGE_DAY_DISCUSSION';
  } else if (gameState.currentPhase === 'STAGE_DAY_DISCUSSION') {
    gameState.currentPhase = 'STAGE_DAY_VOTE';
  } else if (gameState.currentPhase === 'STAGE_DAY_VOTE') {
    gameState.currentPhase = 'STAGE_WIN_CHECK';
  } else if (gameState.currentPhase === 'STAGE_WIN_CHECK') {
    gameState.currentDay++;
    gameState.currentPhase = 'STAGE_NIGHT_START';
    currentPhaseIndex = 0;
    
    // 清除昨晚臨時變數
    gameState.nightActionBuffer.wolfKillSeat = null;
    gameState.nightActionBuffer.witchSaved = false;
    gameState.nightActionBuffer.witchPoisonSeat = null;
    gameState.nightActionBuffer.lastGuardedSeat = gameState.nightActionBuffer.guardSeat;
    gameState.nightActionBuffer.guardSeat = null;
  }
  runPhaseLogic();
}

// 6. 處理各階段上帝引導與操作面板生成
function runPhaseLogic() {
  document.getElementById('phaseIndicator').innerText = gameState.currentPhase;
  const promptText = document.getElementById('godActionPrompt');
  const b1 = document.getElementById('bannerLine1');
  const b2 = document.getElementById('bannerLine2');
  
  b1.innerText = `第 ${gameState.currentDay} 天 - 階段: ${gameState.currentPhase}`;
  selectedTargetId = null;

  // 初始化上帝行動選擇面版
  generateTargetGrid();

  switch (gameState.currentPhase) {
    case 'STAGE_NIGHT_START':
      b2.innerText = '天黑請閉眼，狼人殺夜幕降臨...';
      promptText.innerText = '請點擊「推進階段」引導神職人員在黑夜行動。';
      disableActionButton(true);
      break;

    case 'STAGE_WAKE_GUARD':
      b2.innerText = '守衛請睜眼，今晚你要守護誰？';
      promptText.innerText = '請在下方面板點選要守護的玩家編號（不能與上一晚相同）：';
      enableAliveTargetsExcept(gameState.nightActionBuffer.lastGuardedSeat);
      break;

    case 'STAGE_WAKE_WEREWOLVES':
      b2.innerText = '狼人請睜眼，今晚你要殘害誰？';
      promptText.innerText = '請輸入狼人團隊最終統一刀殺的目標編號：';
      enableAliveTargetsExcept(null);
      break;

    case 'STAGE_WAKE_WITCH':
      b2.innerText = '女巫請睜眼，今晚死的是他...';
      let killed = gameState.nightActionBuffer.wolfKillSeat;
      promptText.innerText = `今晚被刀的是：${killed ? killed + ' 號' : '無人被刀'}。\n請選擇要救人（點選該號碼確認）或使用毒藥（點選其他號碼）：`;
      enableWitchOptions();
      break;

    case 'STAGE_WAKE_SEER':
      b2.innerText = '預言家請睜眼，今晚你要查驗誰？';
      promptText.innerText = '請點選查驗目標，系統將直接在後端完成判定。';
      enableAliveTargetsExcept(null);
      break;

    case 'STAGE_NIGHT_SETTLE':
      b2.innerText = '夜間行動結束，上帝正在翻閱生死簿...';
      promptText.innerText = '點擊「推進階段」將執行夜間核心演算法，結算玩家生死。';
      disableActionButton(true);
      settleNightActions(); // 自動觸發核心結算
      break;

    case 'STAGE_DAY_START':
      b2.innerText = '天亮了，昨晚死亡的名單公佈...';
      displayDayStartDeaths();
      break;

    case 'STAGE_DAY_VOTE':
      b2.innerText = '進入白天放逐公投階段！';
      promptText.innerText = '請在下方點選最高票被投出放逐的玩家座位：';
      enableAliveTargetsExcept(null);
      break;

    case 'STAGE_WIN_CHECK':
      b2.innerText = '正在核對遊戲勝負判定...';
      checkWinCondition();
      break;
  }
}

// 7. 核心演算法：夜晚核心結算演算法 (Night Settlement Algorithm)
function settleNightActions() {
  let deadList = [];
  const wolfKill = gameState.nightActionBuffer.wolfKillSeat;
  const witchSave = gameState.nightActionBuffer.witchSaved;
  const witchPoison = gameState.nightActionBuffer.witchPoisonSeat;
  const guardDef = gameState.nightActionBuffer.guardSeat;

  players.forEach(p => {
    if (!p.isAlive) return;

    // 1. 同守同救判定 (奶穿邏輯)
    if (p.id === wolfKill && p.id === guardDef && witchSave) {
      p.isAlive = false;
      p.deathReason = 'KILLED_BY_WOLF';
      deadList.push(p.id);
    }
    // 2. 正常狼刀成功 (無守護且無解藥)
    else if (p.id === wolfKill && p.id !== guardDef && !witchSave) {
      p.isAlive = false;
      p.deathReason = 'KILLED_BY_WOLF';
      deadList.push(p.id);
    }

    // 3. 女巫毒藥判定 (無視守衛與解藥，擁有最高優先權)
    if (p.id === witchPoison) {
      p.isAlive = false;
      p.deathReason = 'POISONED_BY_WITCH';
      if (!deadList.includes(p.id)) deadList.push(p.id);
      
      // 技能剝奪：若獵人被毒殺，不可開槍
      if (p.currentRole === 'HUNTER') p.canShoot = false;
    }
  });

  // 暫存死名單供白天宣讀
  gameState.lastNightDead = deadList;
}

// 8. 核心演算法：動態勝負檢查演算法 (Win Condition)
function checkWinCondition() {
  let wolves = players.filter(p => p.isAlive && p.faction === 'EVIL_WEREWOLF').length;
  let gods = players.filter(p => p.isAlive && p.faction === 'GOOD_GOD').length;
  let villagers = players.filter(p => p.isAlive && p.faction === 'GOOD_VILLAGER').length;

  const promptText = document.getElementById('godActionPrompt');

  if (wolves === 0) {
    document.getElementById('bannerLine2').innerText = '🎉 正義降臨！好人陣營獲勝！';
    promptText.innerText = '所有狼人已被全數驅逐，村莊恢復了和平。';
    disableGameProgress();
    return;
  }

  // 預設採屠邊局 (KILL_SIDE) 規則判定
  if (gameConfig.winMode === 'KILL_SIDE') {
    if (gods === 0 || villagers === 0) {
      document.getElementById('bannerLine2').innerText = '🐺 夜幕永存！狼人陣營獲勝！';
      promptText.innerText = '好人陣營的某一邊（神職或平民）已全滅，黑暗吞噬了村莊。';
      disableGameProgress();
      return;
    }
  }

  document.getElementById('bannerLine2').innerText = '遊戲尚未結束';
  promptText.innerText = `目前存活狀態：神職 ${gods}人 / 平民 ${villagers}人 / 狼人 ${wolves}人。\n點擊按鈕推進下一個夜晚。`;
}

// 9. 輔助 UI 函式庫
function generateTargetGrid() {
  const grid = document.getElementById('targetGrid');
  grid.innerHTML = '';
  for (let i = 1; i <= gameConfig.totalPlayers; i++) {
const btn = document.createElement('button');
btn.className = 'target-btn';
btn.id = tar-btn-${i};
btn.innerText = ${i} 號;
btn.disabled = true;
btn.onclick = () => selectTarget(i);
grid.appendChild(btn);
}
}
function selectTarget(id) {
selectedTargetId = id;
document.querySelectorAll('.target-btn').forEach(b => b.classList.remove('selected'));
document.getElementById(tar-btn-${id}).classList.add('selected');
document.getElementById('submitActionBtn').disabled = false;
}
function submitGodAction() {
// 將上帝面板點選的 ID 寫入對應的角色狀態快取
switch (gameState.currentPhase) {
case 'STAGE_WAKE_GUARD':
gameState.nightActionBuffer.guardSeat = selectedTargetId;
break;
case 'STAGE_WAKE_WEREWOLVES':
gameState.nightActionBuffer.wolfKillSeat = selectedTargetId;
break;
case 'STAGE_WAKE_WITCH':
if (selectedTargetId === gameState.nightActionBuffer.wolfKillSeat) {
gameState.nightActionBuffer.witchSaved = true;
gameState.witchAntidoteUsed = true;
} else if (selectedTargetId !== null) {
gameState.nightActionBuffer.witchPoisonSeat = selectedTargetId;
gameState.witchPoisonUsed = true;
}
break;
case 'STAGE_WAKE_SEER':
if (selectedTargetId) {
const p = players.find(x => x.id === selectedTargetId);
alert(${selectedTargetId} 號玩家的真實陣營為：${p.faction === 'EVIL_WEREWOLF' ? '🔴 狼人' : '🟢 好人'});
}
break;
case 'STAGE_DAY_VOTE':
if (selectedTargetId) {
let p = players.find(x => x.id === selectedTargetId);
// 白痴翻牌免死判定規則
if (p.currentRole === 'IDIOT' && !p.idiotFlipped) {
p.idiotFlipped = true;
alert('🚨 觸發白痴翻牌技能！該玩家免於被投票放逐，翻開身份牌並保持存活，但失去投票權。');
} else {
p.isAlive = false;
p.deathReason = 'VOTED_OUT';
}
renderTable();
}
break;
}
advancePhase();
}
function enableAliveTargetsExcept(exceptionId) {
players.forEach(p => {
if (p.isAlive && p.id !== exceptionId) {
document.getElementById(tar-btn-${p.id}).disabled = false;
}
});
}
function enableWitchOptions() {
players.forEach(p => {
if (p.isAlive) {
// 假如解藥沒用過，且是死者，允許解救
if (p.id === gameState.nightActionBuffer.wolfKillSeat && !gameState.witchAntidoteUsed) {
document.getElementById(tar-btn-${p.id}).disabled = false;
}
// 假如毒藥沒用過，且不是死者，允許毒殺
if (p.id !== gameState.nightActionBuffer.wolfKillSeat && !gameState.witchPoisonUsed) {
document.getElementById(tar-btn-${p.id}).disabled = false;
}
}
});
}
function displayDayStartDeaths() {
const promptText = document.getElementById('godActionPrompt');
renderTable(); // 重新整理死者模糊視覺
if (!gameState.lastNightDead || gameState.lastNightDead.length === 0) {
document.getElementById('bannerLine2').innerText = '☀️ 昨晚是個平安夜，無人死亡！';
promptText.innerText = '請引導玩家開始進行白天發言討論。';
} else {
document.getElementById('bannerLine2').innerText = ☀️ 昨晚死亡的玩家為：${gameState.lastNightDead.join(', ')} 號。;
promptText.innerText = '請主持死者發表遺言（若有），並點擊按鈕進入發言與公投階段。';
}
}
function disableActionButton(val) {
document.getElementById('submitActionBtn').disabled = val;
document.getElementById('skipActionBtn').disabled = val;
}
function disableGameProgress() {
document.getElementById('nextPhaseBtn').disabled = true;
disableActionButton(true);
}
function togglePanel() {
document.getElementById('godPanel').classList.toggle('collapsed');
document.getElementById('toggleIcon').innerText = document.getElementById('godPanel').classList.contains('collapsed') ? '▲' : '▼';
}
