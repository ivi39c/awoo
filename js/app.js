class Player {
      constructor(id, name, role = '未發牌') {
        this.id = id;
        this.name = name;
        this.role = role;
        this.isAlive = true;
        this.deathReason = null;
        this.isProtected = false; 
        this.isAntidoteUsed = false; 
        this.canShoot = true; 
        this.isSheriff = false;
        this.micOn = false;
        this.camOn = false;
        this.stream = null;
        this.isOccupied = true;
      }
    }

    let gameState = {
      currentDay: 1,
      currentPhase: 'NIGHT_START',
      witchAntidote: true,
      witchPoison: true,
      lastGuardedId: null,
      sheriffId: null,
      players: []
    };

    function recordGameHistory(entry) {
      if (!Array.isArray(roomState.actionHistory)) roomState.actionHistory = [];
      roomState.actionHistory.push({ day: Number(gameState.currentDay) || 1, ...entry });
      renderGameHistory();
      updateControlPanel();
    }
    function renderGameHistory() {
      const log = document.getElementById('gameHistoryLog');
      if (!log) return;
      const entries = (roomState.actionHistory || []).filter(entry => entry.visibility !== 'private');
      const expanded = document.getElementById('gameHistoryPanel')?.classList.contains('is-expanded');
      const visibleEntries = (expanded ? entries : entries.slice(-2)).slice().reverse();
      log.innerHTML = visibleEntries.length
        ? visibleEntries.map(entry => {
            const detail = [entry.phaseLabel, entry.message].map(value => String(value || '').trim()).filter(Boolean).join(' ');
            return `<li><b>D${AwooUI.escapeHtml(entry.day)}, ${AwooUI.escapeHtml(detail)}</b></li>`;
          }).join('')
        : '<li class="history-empty">尚無行動紀錄。</li>';
      const summary = document.getElementById('gameHistorySummaryText');
      if (summary) summary.textContent = entries.length ? entries[entries.length - 1].message : '尚無紀錄';
    }
    function getPerspectiveActionHistory(playerId) {
      return (roomState.actionHistory || [])
        .filter(entry => entry.visibility === 'private' && Number(entry.actorId) === Number(playerId))
        .map(entry => entry.roleActionLabel ? `D${entry.day}, ${entry.roleActionLabel}` : `D${entry.day}, ${entry.message || ''}`);
    }

    function renderPerspectiveActionHistory(playerId) {
      const entries = getPerspectiveActionHistory(playerId);
      if (!entries.length) return '';
      const renderItems = items => items.map(item => `<li>${AwooUI.escapeHtml(item)}</li>`).join('');
      const recent = entries.slice(-2).reverse();
      return `<div class="role-action-history">
        <div class="role-action-history-heading"><b>本局技能紀錄</b><details><summary>查看紀錄</summary><ul>${renderItems(entries.slice().reverse())}</ul></details></div>
        <ul>${renderItems(recent)}</ul>
      </div>`;
    }
    function toggleGameHistory() {
      const panel = document.getElementById('gameHistoryPanel'), details = document.getElementById('gameHistoryLog'), button = document.getElementById('gameHistoryToggle');
      if (!panel || !details || !button) return false;
      const expanded = panel.classList.toggle('is-expanded');
      details.hidden = !expanded;
      renderGameHistory();
      button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      const label = button.querySelector ? button.querySelector('.history-toggle-label') : null;
      if (label) label.textContent = expanded ? '收起紀錄' : '查看紀錄';
      return true;
    }
    function renderPlayerTargetGrid({ onSelect, isAllowed = () => true, selectedId = null, isDisabled = () => false, showDead = true, dataAttribute = null } = {}) {
      return `<div class="target-grid">${roomState.players.map(target => {
        const dead = !target.isAlive, allowed = isAllowed(target), selected = selectedId != null && Number(selectedId) === Number(target.id);
        const disabled = !allowed || isDisabled(target) || (dead && !showDead);
        const dataAttr = dataAttribute ? ` ${dataAttribute}="${Number(target.id)}"` : '';
        return `<button class="target-btn${dead ? ' is-dead' : ''}${selected ? ' selected' : ''}"${dataAttr} ${disabled ? 'disabled ' : ''}onclick="${onSelect}(${Number(target.id)})" type="button" aria-disabled="${disabled ? 'true' : 'false'}" aria-pressed="${selected ? 'true' : 'false'}">${target.id}號${dead && showDead ? '（已出局）' : ''}</button>`;
      }).join('')}</div>`;
    }
    function formatNightDeathSummary(deaths, emptyText = '平安夜') {
      if (!Array.isArray(deaths) || deaths.length === 0) return emptyText;
      // Public dawn narration must reveal seat numbers only, never the cause of death.
      return `昨夜出局 ${deaths.map(death => `${Number(death.id)}號`).join('、')}`;
    }
    function settleNightActions(wolfTargetId, witchSaveTargetId, witchPoisonTargetId, guardTargetId) {
      const result = AwooGameEngine.resolveNight({
        players: gameState.players,
        wolfTargetId,
        witchSaveTargetId,
        witchPoisonTargetId,
        guardTargetId,
        previousGuardTargetId: roomState.guardLastTarget,
        rules: roomState.ruleset
      });
      gameState.lastGuardedId = result.lastGuardedId;
      roomState.guardLastTarget = result.lastGuardedId;
      roomState.lastNightDeaths = result.deaths;
      // Keep the public death log pending until God finishes the dawn announcement.
      roomState.pendingDawnHistory = {
        visibility: 'public',
        phaseLabel: result.deaths.length ? '昨夜出局' : '平安夜',
        message: result.deaths.length ? result.deaths.map(death => `${Number(death.id)}號`).join('、') : '',
      };
      if (result.warnings.length) console.warn('[Awoo] 夜晚結算提醒：', result.warnings);
      return result.deaths;
    }

    // Role data and alias/camp helpers live in js/role-database.js.
    const { ROLE_DATABASE, getRoleDefinition, getRoleCamp } = window.AwooRoleDatabase;

    function checkWinCondition() {
      return AwooGameEngine.checkWinCondition(gameState.players, { winMode: roomState.ruleset.winMode || roomState.winMode || 'edge' });
    }

    function restartGame() {
      if (!roomState.isHost || roomState.currentPhase !== 'GAME_OVER' || !roomState.gameOver) {
        return false;
      }
      clearModeratorAutoAdvance();
      clearInterval(roomState.timerInterval);
      roomState.timerInterval = null;
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      currentVoteTarget = null;

      // Keep the current room, seats, player names, spectators and media streams.
      // Reset only match-specific state before the host deals a fresh game.
      roomState.players.forEach(player => {
        player.role = '未發牌';
        player.isAlive = true;
        player.deathReason = null;
        player.deathSkillUsed = false;
        player.isProtected = false;
        player.isAntidoteUsed = false;
        player.canShoot = true;
        player.isSheriff = false;
      });
      gameState.players = roomState.players;
      gameState.currentDay = 1;
      gameState.currentPhase = 'LOBBY';
      gameState.witchAntidote = true;
      gameState.witchPoison = true;
      gameState.lastGuardedId = null;
      gameState.sheriffId = null;

      Object.assign(roomState, {
        currentPhase: 'LOBBY',
        gameStarted: false,
        gameOver: false,
        currentPerspective: roomState.mySeatId || roomState.currentPerspective || 1,
        rolesInGame: [],
        actionHistory: [],
        pendingDawnHistory: null,
        lastNightDeaths: [],
        nightVictim: null,
        executedVictim: null,
        witchSaveTargetId: null,
        witchPoisonTargetId: null,
        guardTargetId: null,
        seerTargetId: null,
        wolfActionDecided: false,
        witchSaveDecisionMade: false,
        witchPoisonDecisionMade: false,
        witchElixirUsed: false,
        witchPoisonUsed: false,
        showWitchPoisonTargets: false,
        witchPoisonDraftTargetId: null,
        sheriffCandidates: [],
        sheriffVotes: {},
        sheriffElectionRound: 0,
        sheriffId: null,
        hasSheriffInGame: false,
        deathSkillQueue: [],
        deathSkillReturnPhase: null,
        deathSkillExecutedVictim: null,
        deathSkillDeaths: [],
        sheriffBadgeReturnPhase: null,
        sheriffBadgeExecutedVictim: null,
        speechQueue: [],
        currentQueueIndex: 0,
        activeSpeakerId: null,
        userVotes: {},
        moderatorScript: [],
        moderatorNotices: [],
        moderatorStepIndex: 0,
        moderatorSpeechDone: true,
        moderatorManualCompletedStepIndex: null,
        guardLastTarget: null,
      });
      roomState.sheriffTimer = 30;
      roomState.speechTimer = 60;
      roomState.votingTimer = 15;
      roomState.testedRoles = new Set();

      updatePerspectiveSelect();
      updateBanner('【等待開局】', '上一局已重置，房間與玩家保留。', '房主可重新開始遊戲並發牌。');
      renderTable();
      renderGameHistory();
      renderGodFlowPanel();
      updateControlPanel();
      return true;
    }

    function returnToLobby() {
      if (roomState.currentPhase !== 'GAME_OVER' || !roomState.gameOver) return false;
      // The current prototype has no server-side room membership, so this only resets
      // the local client to a fresh lobby state; it cannot remotely remove other players.
      clearModeratorAutoAdvance();
      clearInterval(roomState.timerInterval);
      roomState.timerInterval = null;
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      roomState.players.forEach(player => {
        if (player.stream && typeof player.stream.getTracks === 'function') {
          player.stream.getTracks().forEach(track => track.stop());
        }
      });
      roomState.roomId = 'AWOO-' + Math.floor(1000 + Math.random() * 9000);
      roomState.isSpectator = false;
      roomState.isHost = true;
      roomState.mySeatId = 1;
      roomState.spectators = [];
      roomState.players = [];
      gameState.players = [];
      initPlayers(roomState.playerCount || 12);
      return restartLobbyState();
    }

    function restartLobbyState() {
      currentVoteTarget = null;
      gameState.currentDay = 1;
      gameState.currentPhase = 'LOBBY';
      gameState.witchAntidote = true;
      gameState.witchPoison = true;
      gameState.lastGuardedId = null;
      gameState.sheriffId = null;

      Object.assign(roomState, {
        gameStarted: false,
        gameOver: false,
        currentPhase: 'LOBBY',
        currentPerspective: roomState.mySeatId || 1,
        actionHistory: [],
        pendingDawnHistory: null,
        lastNightDeaths: [],
        rolesInGame: [],
        nightVictim: null,
        executedVictim: null,
        witchSaveTargetId: null,
        witchPoisonTargetId: null,
        guardTargetId: null,
        guardLastTarget: null,
        seerTargetId: null,
        wolfActionDecided: false,
        witchSaveDecisionMade: false,
        witchPoisonDecisionMade: false,
        witchElixirUsed: false,
        witchPoisonUsed: false,
        showWitchPoisonTargets: false,
        witchPoisonDraftTargetId: null,
        moderatorScript: [],
        moderatorNotices: [],
        moderatorStepIndex: 0,
        moderatorSpeechDone: true,
        moderatorManualCompletedStepIndex: null,
        sheriffCandidates: [],
        sheriffVotes: {},
        sheriffElectionRound: 0,
        sheriffId: null,
        hasSheriffInGame: false,
        deathSkillQueue: [],
        deathSkillReturnPhase: null,
        deathSkillExecutedVictim: null,
        deathSkillDeaths: [],
        sheriffBadgeReturnPhase: null,
        sheriffBadgeExecutedVictim: null,
        speechQueue: [],
        currentQueueIndex: 0,
        activeSpeakerId: null,
        userVotes: {},
      });
      roomState.sheriffTimer = 30;
      roomState.speechTimer = 60;
      roomState.votingTimer = 15;
      roomState.testedRoles = new Set();

      roomState.players.forEach(player => {
        player.role = '未發牌';
        player.isAlive = true;
        player.deathReason = null;
        player.deathSkillUsed = false;
        player.isProtected = false;
        player.isAntidoteUsed = false;
        player.canShoot = true;
        player.isSheriff = false;
      });

      updateSpectatorUI();
      updatePerspectiveSelect();
      updateBanner('【大廳】', '已返回新的大廳。', '目前為本機原型，尚未建立真正的多人房間服務。');
      renderTable();
      renderGameHistory();
      renderGodFlowPanel();
      updateControlPanel();
      return true;
    }

    function finishGame(winner, precedingAnnouncement = '') {
      if (roomState.gameOver) return;
      clearModeratorAutoAdvance();
      roomState.gameOver = true;
      setCurrentPhase('GAME_OVER');
      clearInterval(roomState.timerInterval);
      roomState.timerInterval = null;
      const wolvesWon = winner === 'WEREWOLF_WIN';
      const message = wolvesWon ? '狼人陣營獲勝！' : '好人陣營獲勝！';
      // If an elimination happens at night and immediately ends the game, include the
      // resolved death list in the same announcement. Otherwise the UI would jump to
      // GAME_OVER before players ever hear which seat was eliminated.
      const fullAnnouncement = precedingAnnouncement ? `${precedingAnnouncement}${message}` : message;
      updateBanner('【遊戲結束】', fullAnnouncement, `遊戲共進行 ${gameState.currentDay} 天`);
      speakGod(precedingAnnouncement ? `天亮了。${fullAnnouncement}` : `遊戲結束，${message}`, flushPendingDawnHistory);
      renderTable();
      updateControlPanel();
    }

    let godVoiceCache = [];

    function getGodChineseVoice(voices) {
      const available = Array.isArray(voices) ? voices : [];
      // Prefer Traditional Chinese voices, then other Chinese voices. Prefer Google
      // only when the browser actually exposes one; voice availability is device-dependent.
      return available.find(v => /^zh[-_]TW$/i.test(v.lang) && /google/i.test(v.name))
        || available.find(v => /^zh[-_]TW$/i.test(v.lang))
        || available.find(v => /^zh[-_]/i.test(v.lang) && /google/i.test(v.name))
        || available.find(v => /^zh[-_]/i.test(v.lang))
        || available.find(v => /chinese|中文|mandarin/i.test(v.name))
        || null;
    }

    function flushPendingDawnHistory() {
      const pending = roomState.pendingDawnHistory;
      if (!pending) return false;
      roomState.pendingDawnHistory = null;
      recordGameHistory(pending);
      return true;
    }

    function speakGod(text, onComplete = null) {
      if (!text || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
        console.warn('[Awoo] 上帝語音目前不可用；口白文字仍會正常顯示。');
        if (typeof onComplete === 'function') onComplete();
        return false;
      }
      try {
        const synth = window.speechSynthesis;
        synth.cancel();
        const msg = new SpeechSynthesisUtterance(String(text));
        msg.lang = 'zh-TW';
        msg.rate = 0.92;
        msg.pitch = 1.0;
        const voices = synth.getVoices();
        if (voices.length) godVoiceCache = voices;
        const voice = getGodChineseVoice(godVoiceCache.length ? godVoiceCache : voices);
        if (voice) {
          msg.voice = voice;
          // Use the selected voice's actual locale to avoid locale/voice mismatch.
          msg.lang = voice.lang || msg.lang;
        }
        let completed = false;
        const completeOnce = () => {
          if (completed) return;
          completed = true;
          if (typeof onComplete === 'function') onComplete();
        };
        msg.onend = completeOnce;
        msg.onerror = event => {
          console.warn('[Awoo] 上帝語音播放失敗：', event && event.error ? event.error : 'unknown');
          completeOnce();
        };
        synth.speak(msg);
        // Some browsers suspend synthesis after backgrounding or a prior interruption.
        if (synth.paused) synth.resume();
        return true;
      } catch (error) {
        console.warn('[Awoo] 無法播放上帝語音；口白文字仍會正常顯示。', error);
        if (typeof onComplete === 'function') onComplete();
        return false;
      }
    }

    // Voice lists can arrive asynchronously. Refreshing is intentionally automatic:
    // players do not choose a voice and no separate voice-test button is needed.
    if ('speechSynthesis' in window) {
      const refreshGodVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length) godVoiceCache = voices;
      };
      refreshGodVoices();
      if (typeof window.speechSynthesis.addEventListener === 'function') {
        window.speechSynthesis.addEventListener('voiceschanged', refreshGodVoices);
      } else {
        window.speechSynthesis.onvoiceschanged = refreshGodVoices;
      }
    }

    let roomState = {
      roomId: 'AWOO-' + Math.floor(1000 + Math.random() * 9000),
      isHost: true,
      isTestMode: false,
      testedRoles: new Set(),
      rolesInGame: [],
      moderatorScript: [],
      moderatorNotices: [],
      moderatorStepIndex: 0,
      moderatorSpeechDone: true,
      moderatorSpeechToken: 0,
      moderatorAutoAdvanceTimer: null,
      moderatorAutoAdvanceToken: 0,
      moderatorManualCompletedStepIndex: null,
      showWitchPoisonTargets: false,
      witchPoisonDraftTargetId: null,
      playerCount: 12,
      isSpectator: false,
      mySeatId: 1,
      sheriffMode: 'enabled',
      winMode: 'edge',
      ruleset: window.AwooRuleset.resolveRuleset(),
      hasSheriffInGame: false,
      currentPhase: 'LOBBY',
      currentPerspective: 1,
      gameStarted: false,
      gameOver: false,
      lastNightDeaths: [],
      actionHistory: [],
      witchSaveTargetId: null,
      witchPoisonTargetId: null,
      guardTargetId: null,
      seerTargetId: null,
      wolfActionDecided: false,
      witchSaveDecisionMade: false,
      witchPoisonDecisionMade: false,
      players: [],
      spectators: [],
      activeSpeakerId: null,
      speechTimer: 60,
      sheriffTimer: 30,
      votingTimer: 15,
      timerInterval: null,
      sheriffCandidates: [],
      sheriffVotes: {},
      sheriffElectionRound: 0,
      deathSkillQueue: [],
      deathSkillReturnPhase: null,
      deathSkillExecutedVictim: null,
      sheriffBadgeReturnPhase: null,
      sheriffBadgeExecutedVictim: null,
      sheriffId: null,
      guardLastTarget: null,
      nightVictim: null,
      executedVictim: null,
      witchElixirUsed: false,
      witchPoisonUsed: false,
      speechQueue: [],
      currentQueueIndex: 0,
      userVotes: {},
      isTieRunoff: false,
      runoffCandidates: [],
      customRolePool: []
    };

    function setCurrentPhase(nextPhase) {
      const result = AwooGameFlow.transitionPhase(roomState, nextPhase);
      if (!result.ok) {
        console.error(`[Awoo] 非法階段轉換：${result.from} -> ${result.to}（${result.reason}）`);
        return false;
      }
      // Keep the moderator panel and test-mode quick actions in sync with phase changes.
      if (typeof renderGodFlowPanel === 'function') renderGodFlowPanel();
      if (typeof updateTestModeUI === 'function') updateTestModeUI();
      return true;
    }

    // 標準配置規則表 (12人局更正為 4狼 4神 4民)
    const STANDARD_CONFIGS = {
      6:  { wolf: 2, god: 2, villager: 2, pool: ["小狼", "小狼", "預言家", "女巫", "平民", "平民"] },
      7:  { wolf: 2, god: 3, villager: 2, pool: ["小狼", "小狼", "預言家", "女巫", "獵人", "平民", "平民"] },
      8:  { wolf: 2, god: 3, villager: 3, pool: ["小狼", "小狼", "預言家", "女巫", "獵人", "平民", "平民", "平民"] },
      9:  { wolf: 3, god: 3, villager: 3, pool: ["小狼", "小狼", "小狼", "預言家", "女巫", "獵人", "平民", "平民", "平民"] },
      10: { wolf: 3, god: 4, villager: 3, pool: ["小狼", "小狼", "小狼", "預言家", "女巫", "守衛", "獵人", "平民", "平民", "平民"] },
      11: { wolf: 3, god: 4, villager: 4, pool: ["小狼", "小狼", "小狼", "預言家", "女巫", "守衛", "獵人", "平民", "平民", "平民", "平民"] },
      12: { wolf: 4, god: 4, villager: 4, pool: ["小狼", "小狼", "小狼", "狼王", "預言家", "女巫", "守衛", "獵人", "平民", "平民", "平民", "平民"] },
      13: { wolf: 4, god: 5, villager: 4, pool: ["小狼", "小狼", "小狼", "狼王", "預言家", "女巫", "守衛", "獵人", "白痴", "平民", "平民", "平民", "平民"] },
      14: { wolf: 4, god: 5, villager: 5, pool: ["小狼", "小狼", "小狼", "狼王", "預言家", "女巫", "守衛", "獵人", "白痴", "平民", "平民", "平民", "平民", "平民"] },
      15: { wolf: 5, god: 5, villager: 5, pool: ["小狼", "小狼", "小狼", "小狼", "狼王", "預言家", "女巫", "守衛", "獵人", "白痴", "平民", "平民", "平民", "平民", "平民"] },
      16: { wolf: 5, god: 6, villager: 5, pool: ["白狼王", "狼王", "小狼", "小狼", "小狼", "預言家", "女巫", "守衛", "獵人", "白痴", "騎士", "平民", "平民", "平民", "平民", "平民"] }
    };

    window.onload = () => {
      AwooCompendium.open();
      handlePresetChange();
      document.getElementById('roomCodeDisplay').innerText = `[房號: ${roomState.roomId}] 複製邀請`;
    };

    function openRoleSelection(isHost) {
      roomState.isHost = isHost;
      document.getElementById('createRoomModal').style.display = 'flex';
    }

    function openJoinModal() {
      document.getElementById('joinModal').style.display = 'flex';
    }

    function handlePresetChange() {
      const val = document.getElementById('setupPlayerCount').value;
      const customSection = document.getElementById('customConfigSection');
      const presetBox = document.getElementById('presetDetailBox');

      if (val === 'custom') {
        customSection.style.display = 'block';
        presetBox.innerHTML = `<b style="color:var(--gold-primary);">自由配置模式：</b>請調整總人數，下方將自動套用對應狼、神、民數量比例。`;
        handleCustomCountChange();
      } else {
        customSection.style.display = 'none';
        const count = parseInt(val);
        const config = STANDARD_CONFIGS[count];
        if (config) {
          presetBox.innerHTML = `
            <b style="color:var(--gold-primary);">${count} 人標準局配置：</b><br>
            • <b>陣營比例：</b> ${config.wolf} 狼、${config.god} 神、${config.villager} 民<br>
            • <b>具體角色：</b> ${config.pool.join(', ')}
          `;
        }
        checkSheriffEligibility(count);
      }
    }

    function handleCustomCountChange() {
      const countInput = document.getElementById('customTotalCount');
      let count = parseInt(countInput.value) || 12;
      if (count < 6) count = 6;
      if (count > 16) count = 16;
      countInput.value = count;

      const config = STANDARD_CONFIGS[count] || STANDARD_CONFIGS[12];
      document.getElementById('customWolfCount').value = config.wolf;
      document.getElementById('customGodCount').value = config.god;
      document.getElementById('customVillagerCount').value = config.villager;

      checkSheriffEligibility(count);
    }

    function checkSheriffEligibility(count) {
      const sheriffCheck = document.getElementById('enableSheriffMode');
      const notice = document.getElementById('sheriffModeNotice');
      if (count < 12) {
        sheriffCheck.checked = false;
        sheriffCheck.disabled = true;
        notice.style.color = 'var(--crimson-bright)';
        notice.innerText = `當前總人數 (${count}人) 低於 12 人，強制關閉警長競選模式。`;
      } else {
        sheriffCheck.disabled = false;
        notice.style.color = '#aaa';
        notice.innerText = `12人（含）以上板型可啟用警長競選。`;
      }
    }

    function confirmCreateRoom() {
      roomState.isTestMode = false;
      roomState.testedRoles = new Set();
      updateTestModeUI();
      const val = document.getElementById('setupPlayerCount').value;
      let count = 12;

      if (val === 'custom') {
        count = parseInt(document.getElementById('customTotalCount').value) || 12;
        const checkedBoxes = document.querySelectorAll('input[name="customRole"]:checked');
        roomState.customRolePool = Array.from(checkedBoxes).map(cb => cb.value);
        if (roomState.customRolePool.length === 0) {
          alert("請至少勾選一個自由配置角色！");
          return;
        }
      } else {
        count = parseInt(val);
      }

      const entryType = document.getElementById('entryRoleType').value;
      roomState.isSpectator = (entryType === 'spectator');
      roomState.mySeatId = roomState.isSpectator ? null : 1;
      roomState.sheriffMode = document.getElementById('enableSheriffMode').checked ? 'enabled' : 'disabled';
      roomState.ruleset = AwooRuleset.resolveRuleset({
        witchCanSelfSaveFirstNight: document.getElementById('witchCanSelfSaveFirstNight')?.checked !== false,
      });

      closeModal('createRoomModal');
      document.getElementById('lobbyScreen').style.display = 'none';

      initBgmAudio();
      initPlayers(count);
      speakGod("歡迎來到 Awoo 狼人殺房間，等待所有玩家滿席後由房主開始遊戲。");
    }

    function confirmJoinRoom() {
      roomState.isTestMode = false;
      roomState.testedRoles = new Set();
      updateTestModeUI();
      const code = document.getElementById('joinRoomCodeInput').value;
      if (!code) { alert("請輸入房間代碼！"); return; }
      const entryType = document.getElementById('joinRoleType').value;
      roomState.isHost = false;
      roomState.isSpectator = (entryType === 'spectator');
      roomState.mySeatId = roomState.isSpectator ? null : 2;

      closeModal('joinModal');
      document.getElementById('lobbyScreen').style.display = 'none';

      initBgmAudio();
      initPlayers(12);
      speakGod("成功加入房間！");
    }

    function startQuickBotTest() {
      // Explicit local-only test mode: perspective switching and role overrides are allowed here.
      roomState.isTestMode = true;
      roomState.testedRoles = new Set();
      roomState.isHost = true;
      roomState.isSpectator = false;
      roomState.mySeatId = 1;
      roomState.sheriffMode = 'enabled';
      roomState.ruleset = AwooRuleset.resolveRuleset();
      roomState.currentPhase = 'LOBBY';
      roomState.gameStarted = false;
      roomState.gameOver = false;
      document.getElementById('lobbyScreen').style.display = 'none';
      updateTestModeUI();
      initBgmAudio();
      initPlayers(12);
      updateBanner('【測試模式】', '', '');
    }

    function updateTestModeUI() {
      const selector = document.getElementById('perspectiveSelect');
      const banner = document.getElementById('testModeBanner');
      if (selector) {
        selector.style.display = roomState.isTestMode ? '' : 'none';
        selector.disabled = !roomState.isTestMode;
        selector.setAttribute?.('aria-hidden', roomState.isTestMode ? 'false' : 'true');
      }
      if (banner) banner.style.display = roomState.isTestMode ? 'flex' : 'none';
      ['spectatorCountBtn', 'mediaTopBtn', 'compendiumTopBtn', 'settingsTopBtn'].forEach(id => {
        const control = document.getElementById(id);
        if (control) control.style.display = roomState.isTestMode ? 'none' : '';
      });
      const skipSpeechButton = document.getElementById('testModeSkipSpeechButton');
      if (skipSpeechButton) skipSpeechButton.hidden = !roomState.isTestMode || !roomState.gameStarted || roomState.currentPhase !== 'DAY_SPEECH' || roomState.gameOver;
      const resolveButton = document.getElementById('testModeResolveNightButton');
      if (resolveButton) {
        resolveButton.hidden = !roomState.isTestMode || !roomState.gameStarted || roomState.currentPhase !== 'NIGHT' || roomState.gameOver;
      }
      const coverage = document.getElementById('testRoleCoverage');
      if (coverage) {
        const total = ROLE_DATABASE.length;
        const seen = roomState.testedRoles instanceof Set ? roomState.testedRoles.size : 0;
        coverage.textContent = `角色控制台巡檢：${seen} / ${total}`;
      }
    }

    function recordTestedRole(roleName) {
      if (!roomState.isTestMode || !roomState.gameStarted || roomState.currentPhase === 'GAME_OVER' || !roleName) return;
      const definition = getRoleDefinition(roleName);
      if (!definition) return;
      if (!(roomState.testedRoles instanceof Set)) roomState.testedRoles = new Set();
      roomState.testedRoles.add(definition.name);
      updateTestModeUI();
    }

    function getTestRoleControlStatus(roleName) {
      const canonical = getRoleDefinition(roleName)?.name || String(roleName || '');
      const wired = new Set(['小狼', '預言家', '女巫', '守衛', '平民']);
      if (wired.has(canonical)) {
        return '目前已有對應控制項或基礎操作；仍需依角色技能測試具體結算。';
      }
      if (getRoleCamp(canonical) === '狼人') {
        return '已提供共通狼隊夜刀控制項；此角色的專屬技能仍需另外實作與驗證。';
      }
      return '圖鑑資料已收錄；此角色的專屬操作／觸發技能尚未接入遊戲引擎，請標記為待實作。';
    }

    function assignTestRole(playerId, roleName) {
      if (!roomState.isTestMode) {
        alert('角色覆蓋功能僅限測試模式使用。');
        return false;
      }
      if (!roomState.gameStarted) {
        alert('請先開始測試局並完成發牌，再替換測試角色。');
        return false;
      }
      const player = roomState.players.find(item => item.id === Number(playerId));
      const definition = getRoleDefinition(roleName);
      if (!player || !definition) {
        alert('找不到指定座位或角色資料。');
        return false;
      }

      player.role = definition.name;
      player.isAlive = true;
      player.deathReason = null;
      player.deathSkillUsed = false;
      player.isProtected = false;
      player.canShoot = true;
      if (player.isSheriff) {
        player.isSheriff = false;
        if (roomState.sheriffId === player.id) roomState.sheriffId = null;
        if (gameState.sheriffId === player.id) gameState.sheriffId = null;
        roomState.hasSheriffInGame = roomState.players.some(item => item.isSheriff && item.isAlive);
      }
      // Clear pending actions so changing the test actor cannot accidentally keep another role's action.
      roomState.nightVictim = null;
      roomState.witchSaveTargetId = null;
      roomState.witchPoisonTargetId = null;
      roomState.guardTargetId = null;
      roomState.seerTargetId = null;
      roomState.wolfActionDecided = false;
      roomState.witchSaveDecisionMade = false;
      roomState.witchPoisonDecisionMade = false;
      roomState.moderatorManualCompletedStepIndex = null;
      roomState.moderatorSpeechDone = true;
      roomState.witchElixirUsed = false;
      roomState.witchPoisonUsed = false;
      roomState.showWitchPoisonTargets = false;
      roomState.witchPoisonDraftTargetId = null;
      gameState.players = roomState.players;
      roomState.rolesInGame = [...new Set(roomState.players.map(item => item.role))];
      if (roomState.currentPhase === 'NIGHT') refreshModeratorScriptForCurrentNight();
      updatePerspectiveSelect();
      renderTable();
      updateControlPanel();
      return true;
    }

    function resetTestGame() {
      if (!roomState.isTestMode) return;
      clearModeratorAutoAdvance();
      clearInterval(roomState.timerInterval);
      roomState.timerInterval = null;
      roomState.players.forEach(player => {
        if (player.stream && typeof player.stream.getTracks === 'function') player.stream.getTracks().forEach(track => track.stop());
      });
      currentVoteTarget = null;
      roomState.currentPhase = 'LOBBY';
      roomState.gameStarted = false;
      roomState.gameOver = false;
      roomState.testedRoles = new Set();
      roomState.sheriffCandidates = [];
      roomState.sheriffId = null;
      roomState.hasSheriffInGame = false;
      roomState.guardLastTarget = null;
      roomState.nightVictim = null;
      roomState.executedVictim = null;
      roomState.userVotes = {};
      roomState.speechQueue = [];
      roomState.currentQueueIndex = 0;
      roomState.activeSpeakerId = null;
      roomState.lastNightDeaths = [];
      roomState.rolesInGame = [];
      roomState.moderatorScript = [];
      roomState.moderatorNotices = [];
      roomState.moderatorStepIndex = 0;
      roomState.moderatorSpeechDone = true;
      roomState.moderatorManualCompletedStepIndex = null;
      roomState.wolfActionDecided = false;
      roomState.witchSaveDecisionMade = false;
      roomState.witchPoisonDecisionMade = false;
      roomState.showWitchPoisonTargets = false;
      roomState.witchPoisonDraftTargetId = null;
      roomState.witchSaveTargetId = null;
      roomState.witchPoisonTargetId = null;
      roomState.guardTargetId = null;
      roomState.seerTargetId = null;
      roomState.witchElixirUsed = false;
      roomState.witchPoisonUsed = false;
      gameState.currentDay = 1;
      gameState.sheriffId = null;
      initPlayers(12);
      updateTestModeUI();
      updateBanner('【測試模式】', '', '');
    }

    function exitTestMode() {
      clearModeratorAutoAdvance();
      clearInterval(roomState.timerInterval);
      roomState.timerInterval = null;
      roomState.players.forEach(player => {
        if (player.stream && typeof player.stream.getTracks === 'function') player.stream.getTracks().forEach(track => track.stop());
      });
      roomState.isTestMode = false;
      roomState.testedRoles = new Set();
      roomState.gameStarted = false;
      roomState.gameOver = false;
      roomState.currentPhase = 'LOBBY';
      roomState.players = [];
      gameState.players = [];
      // Ensure test-only perspective controls are hidden immediately on exit.
      const perspectiveSelect = document.getElementById('perspectiveSelect');
      if (perspectiveSelect) {
        perspectiveSelect.style.display = 'none';
        perspectiveSelect.disabled = true;
        perspectiveSelect.setAttribute('aria-hidden', 'true');
      }
      updateTestModeUI();
      document.getElementById('lobbyScreen').style.display = 'flex';
    }

    function initBgmAudio() {
  const bgm = document.getElementById('googleDriveBgm');
  if (!bgm) return;

  bgm.volume = 0.5;
  bgm.loop = true;

  bgm.play().catch(error => {
    console.warn('BGM 自動播放失敗：', error);
    showBgmPlayButton();
  });
}

function showBgmPlayButton() {
  let btn = document.getElementById('bgmPlayFallback');

  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'bgmPlayFallback';
    btn.className = 'btn-gothic btn-crimson';
    btn.textContent = '♫ 點擊啟動背景音樂';

    btn.style.position = 'fixed';
    btn.style.top = '90px';
    btn.style.right = '15px';
    btn.style.zIndex = '1500';

    btn.addEventListener('click', async () => {
      const bgm = document.getElementById('googleDriveBgm');

      try {
        await bgm.play();
        btn.remove();
      } catch (error) {
        alert('音樂無法播放，請確認檔案分享權限或音訊網址。');
        console.error(error);
      }
    });

    document.body.appendChild(btn);
  }
}

    function copyInviteLink() {
      const dummyUrl = window.location.href.split('?')[0] + `?room=${roomState.roomId}`;
      navigator.clipboard.writeText(dummyUrl).then(() => {
        alert(`已成功複製房間邀請連結！\n房間代碼：${roomState.roomId}\n快分享給朋友加入吧！`);
      });
    }

    function initPlayers(count) {
      roomState.playerCount = count;
      roomState.players = [];
      gameState.players = [];
      roomState.spectators = [];

      if (roomState.isSpectator) {
        roomState.spectators.push({ id: 'sp-1', name: (document.getElementById('playerNameInput').value || '觀戰者1') });
      }

      for (let i = 1; i <= count; i++) {
        let name = `${i}號 Bot`;
        let isOccupied = true;

        if (i === 1 && roomState.isHost && !roomState.isSpectator) {
          name = (document.getElementById('playerNameInput').value || '房主');
        } else if (i === roomState.mySeatId) {
          name = (document.getElementById('playerNameInput').value || '玩家');
        }

        const p = new Player(i, name, '未發牌');
        p.isOccupied = isOccupied;
        roomState.players.push(p);
        gameState.players.push(p);
      }

      if (roomState.isSpectator) {
        roomState.currentPerspective = 1;
      } else if (roomState.mySeatId) {
        roomState.currentPerspective = roomState.mySeatId;
      }

      updateSpectatorUI();
      renderTable();
      updatePerspectiveSelect();
      updateControlPanel();
    }

    function updateSpectatorUI() {
      document.getElementById('spectatorCountBtn').innerText = `觀眾席 (${roomState.spectators.length})`;
    }

    function openSpectatorModal() {
      const body = document.getElementById('spectatorListBody');
      if (roomState.spectators.length === 0) {
        body.innerHTML = `<p style="color:#aaa; font-size:0.85rem;">目前觀眾席無人觀戰...</p>`;
      } else {
        let html = `<ul style="list-style:none;">`;
        roomState.spectators.forEach((sp, idx) => {
          html += `<li style="padding:8px; border-bottom:1px solid rgba(212,175,55,0.2); font-size:0.9rem;">${idx + 1}. <b>${sp.name}</b> (旁聽觀戰中)</li>`;
        });
        html += `</ul>`;
        body.innerHTML = html;
      }
      document.getElementById('spectatorListModal').style.display = 'flex';
    }

    function moveToSpectator() {
      if (roomState.currentPhase !== 'LOBBY') {
        alert("遊戲已開始，無法變更位子！");
        return;
      }
      const myName = (document.getElementById('playerNameInput').value || '觀戰者');
      if (roomState.mySeatId) {
        const p = roomState.players.find(x => x.id === roomState.mySeatId);
        if (p) {
          p.name = `${p.id}號 空位`;
          p.isOccupied = false;
        }
      }
      roomState.isSpectator = true;
      roomState.mySeatId = null;
      roomState.spectators.push({ id: 'sp-' + Date.now(), name: myName });

      updateSpectatorUI();
      renderTable();
      updateControlPanel();
    }

    function moveToSeat() {
      if (roomState.currentPhase !== 'LOBBY') {
        alert("遊戲已開始，無法變更位子！");
        return;
      }
      const emptySeat = roomState.players.find(x => !x.isOccupied);
      if (!emptySeat) {
        alert("目前座位已滿，無法入座！");
        return;
      }
      const myName = (document.getElementById('playerNameInput').value || '玩家');
      emptySeat.name = myName;
      emptySeat.isOccupied = true;
      roomState.isSpectator = false;
      roomState.mySeatId = emptySeat.id;
      roomState.currentPerspective = emptySeat.id;

      roomState.spectators = roomState.spectators.filter(s => s.name !== myName);

      updateSpectatorUI();
      renderTable();
      updatePerspectiveSelect();
      updateControlPanel();
    }

    function renderTable() {
      const table = document.getElementById('seatTable');
      table.innerHTML = '';
      roomState.players.forEach(p => {
        const isCurrentSpeaker = (p.id === roomState.activeSpeakerId);
        const card = document.createElement('div');
        card.className = `seat-card ${!p.isOccupied ? 'empty' : ''} ${!p.isAlive ? 'dead' : ''} ${isCurrentSpeaker ? 'active-speaker' : ''}`;
        card.id = `seat-${p.id}`;
        
        card.innerHTML = `
          ${p.isSheriff ? '<div class="badge-sheriff">👑</div>' : ''}
          <div class="avatar-video-container" id="video-container-${p.id}">
            ${p.camOn && p.stream ? '' : '<span class="avatar-placeholder">' + (p.isOccupied ? '鏡頭關閉' : '待入座') + '</span>'}
          </div>
          <div class="seat-info">
            <span>${p.id}. ${p.name}</span>
          </div>
        `;
        table.appendChild(card);

        if (p.camOn && p.stream) {
          const container = document.getElementById(`video-container-${p.id}`);
          const video = document.createElement('video');
          video.className = 'avatar-video';
          video.autoplay = true;
          video.playsInline = true;
          video.muted = (p.id === roomState.currentPerspective);
          video.srcObject = p.stream;
          container.appendChild(video);
        }
      });
    }

    function updatePerspectiveSelect() {
      const select = document.getElementById('perspectiveSelect');
      if (!select) return;
      select.innerHTML = '';
      roomState.players.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        const roleName = getRoleDefinition(p.role)?.name || p.role || '未發牌';
        opt.textContent = `視角：${p.id}號（${roleName}）`;
        if (Number(p.id) === Number(roomState.currentPerspective)) opt.selected = true;
        select.appendChild(opt);
      });
      updateTestModeUI();
    }

    function switchPerspective(id) {
      if (!roomState.isTestMode) {
        roomState.currentPerspective = roomState.mySeatId || 1;
        updatePerspectiveSelect();
        return false;
      }
      const nextId = Number(id);
      if (!roomState.players.some(player => player.id === nextId)) return false;
      roomState.currentPerspective = nextId;
      // Rebuild the selector from the current dealt roles so its label and panel perspective stay aligned.
      updatePerspectiveSelect();
      updateControlPanel();
      renderTable();
      return true;
    }

    function updateControlPanel() {
      const p = roomState.players.find(x => x.id === roomState.currentPerspective);
      if (!p) return;
      recordTestedRole(p.role);

      document.getElementById('roleIdentityInfo').innerHTML = `
        當前檢視：<b>${AwooUI.escapeHtml(p.id)}號 ${AwooUI.escapeHtml(p.name)}</b> ${roomState.isSpectator ? '<span style="color:var(--gold-primary);">[觀眾席]</span>' : ''}<br>
        身分牌：<b style="color:var(--gold-primary);">${AwooUI.escapeHtml(p.role)}</b> (${p.isAlive ? '存活' : '已出局'})
      `;

      const controls = document.getElementById('actionControls');
      controls.innerHTML = '';

      if (roomState.currentPhase === 'GAME_OVER') {
        controls.innerHTML = `
          <p style="text-align:center; color:var(--gold-primary);">本局已結束。</p>
          ${roomState.isHost ? '<button class="btn-gothic btn-crimson" style="width:100%;margin-bottom:8px;" onclick="restartGame()">再開一局</button>' : ''}
          <button class="btn-gothic" style="width:100%;" onclick="returnToLobby()">返回大廳</button>
        `;
      }
      else if (roomState.currentPhase === 'LOBBY') {
        let actionButtons = '';
        if (roomState.isSpectator) {
          actionButtons += `<button class="btn-gothic" style="width:100%; margin-bottom:10px;" onclick="moveToSeat()">入座遊戲</button>`;
        } else {
          actionButtons += `<button class="btn-gothic" style="width:100%; margin-bottom:10px;" onclick="moveToSpectator()">移至觀眾席</button>`;
        }

        if (roomState.isHost) {
          actionButtons += `<button class="btn-gothic btn-crimson" style="width:100%;" onclick="startGameFlow()">開始遊戲流程 (抽卡發牌)</button>`;
        } else {
          actionButtons += `<p style="font-size:0.8rem; color:#aaa; text-align:center;">等待房主開始遊戲...</p>`;
        }
        controls.innerHTML = actionButtons;
      } 
      else if (roomState.currentPhase === 'NIGHT') {
        renderNightPanel(p, controls);
      }
      else if (roomState.currentPhase === 'SHERIFF_ELECTION') {
        const hasRaisedHand = roomState.sheriffCandidates.includes(Number(p.id));
        controls.innerHTML = `
          <div style="text-align:center; margin-bottom:8px;">
            <span style="color:var(--gold-light); font-size:0.9rem;">競選舉手倒數：<b style="color:var(--crimson-bright); font-size:1.1rem;"><span id="sheriffTimerSec">${roomState.sheriffTimer}</span>s</b></span>
          </div>
          ${p.isAlive ? `<button class="btn-gothic" style="width:100%; margin-bottom:8px;" onclick="candidateSheriff(${p.id})">${hasRaisedHand ? '退出警長競選' : '舉手競選警長'}</button>` : '<p style="color:#888;">出局玩家不能參與警長競選。</p>'}
          <p style="font-size:0.8rem;color:#aaa;">目前候選人：${roomState.sheriffCandidates.length ? roomState.sheriffCandidates.join('、') + ' 號' : '尚無人'}</p>
        `;
      }
      else if (roomState.currentPhase === 'SHERIFF_VOTING') {
        renderSheriffVotingPanel(p, controls);
      }
      else if (roomState.currentPhase === 'DEATH_SKILL') {
        renderDeathSkillPanel(p, controls);
      }
      else if (roomState.currentPhase === 'SHERIFF_BADGE') {
        renderSheriffBadgePanel(p, controls);
      }
      else if (roomState.currentPhase === 'DAY_DEATH') {
        if (p.isSheriff) {
          const hasDeath = Array.isArray(roomState.lastNightDeaths) && roomState.lastNightDeaths.length > 0;
          controls.innerHTML = `
            <div style="margin-bottom:10px;">
              <p style="font-size:0.85rem; color:var(--gold-primary); margin-bottom:8px;">請警長選擇今日發言順序：</p>
              ${hasDeath ? `
                <button class="btn-gothic" style="width:100%; margin-bottom:6px;" onclick="chooseSpeechDirection('死左')">死左 (逆時針)</button>
                <button class="btn-gothic" style="width:100%;" onclick="chooseSpeechDirection('死右')">死右 (順時針)</button>
              ` : `
                <button class="btn-gothic" style="width:100%; margin-bottom:6px;" onclick="chooseSpeechDirection('警左')">警左 (逆時針)</button>
                <button class="btn-gothic" style="width:100%;" onclick="chooseSpeechDirection('警右')">警右 (順時針)</button>
              `}
            </div>
          `;
        } else {
          controls.innerHTML = `<p style="font-size:0.85rem; color:#aaa;">等待警長決定發言順序...</p>`;
        }
      }
      else if (roomState.currentPhase === 'DAY_SPEECH') {
        const isMyTurn = (p.id === roomState.activeSpeakerId);
        const isLastSpeaker = (roomState.currentQueueIndex === roomState.speechQueue.length - 1);

        controls.innerHTML = `
          <div style="text-align:center; margin-bottom:10px;">
            <span style="font-size:1rem; color:var(--gold-light);">當前發言玩家：<b style="color:var(--gold-primary);">${roomState.activeSpeakerId} 號</b></span><br>
            <span style="font-size:1.1rem; color:var(--crimson-bright); font-weight:bold;">倒數：<span id="timerSec">${roomState.speechTimer}</span>s</span>
          </div>
          ${isMyTurn ? `
            <div style="display:flex; gap:8px; margin-bottom:10px;">
              <button class="btn-gothic" style="flex:1;" onclick="addSpeechTime()">+60s 加時</button>
              <button class="btn-gothic btn-crimson" style="flex:1;" onclick="endSpeech()">結束發言</button>
            </div>
          ` : `<p style="font-size:0.75rem; color:#888; text-align:center;">目前為 ${roomState.activeSpeakerId} 號發言時間。</p>`}

          ${(p.isSheriff || (!roomState.hasSheriffInGame && isLastSpeaker)) && isMyTurn ? `
            <div style="border-top:1px solid #444; padding-top:8px; margin-top:8px;">
              <label style="font-size:0.80rem; color:var(--gold-primary);">
                <input type="checkbox" id="sheriffSummaryCheck" onchange="toggleSheriffSummary(this.checked)"> 進行歸票發言
              </label>
              <div id="sheriffTargetBox" style="display:none; margin-top:6px;">
                <select id="sheriffTargetSelect" style="width:100%;">
                  ${roomState.players.filter(x=>x.isAlive).map(x=>`<option value="${x.id}">${x.id}號玩家</option>`).join('')}
                </select>
              </div>
            </div>
          ` : ''}
        `;
      }
      else if (roomState.currentPhase === 'VOTING') {
        renderVotingPanel(p, controls);
      }
      else if (roomState.currentPhase === 'LAST_WORDS') {
        const isMyTurn = (p.id === roomState.executedVictim);
        controls.innerHTML = `
          <div style="text-align:center; margin-bottom:10px;">
            <span style="font-size:1rem; color:var(--gold-light);">發表遺言玩家：<b style="color:var(--crimson-bright);">${roomState.executedVictim} 號</b></span><br>
            <span style="font-size:1.1rem; color:var(--crimson-bright); font-weight:bold;">倒數：<span id="timerSec">${roomState.speechTimer}</span>s</span>
          </div>
          ${isMyTurn ? `
            <div style="display:flex; gap:8px;">
              <button class="btn-gothic" style="flex:1;" onclick="addSpeechTime()">+60s 加時</button>
              <button class="btn-gothic btn-crimson" style="flex:1;" onclick="endLastWords()">結束遺言</button>
            </div>
          ` : `<p style="font-size:0.75rem; color:#888; text-align:center;">目前為 ${roomState.executedVictim} 號發表遺言時間。</p>`}
        `;
      }

      if ((p.role === '女巫' || p.role === 'WITCH') && roomState.currentPhase !== 'NIGHT') {
        const witchDaySummary = document.createElement('div');
        witchDaySummary.className = 'witch-day-summary';
        witchDaySummary.textContent = `本局藥劑紀錄｜解藥：${roomState.witchSaveTargetId != null ? `${roomState.witchSaveTargetId}號` : roomState.witchElixirUsed ? '已使用' : '未使用'}；毒藥：${roomState.witchPoisonTargetId != null ? `${roomState.witchPoisonTargetId}號` : roomState.witchPoisonUsed ? '已使用' : '未使用'}`;
        controls.appendChild(witchDaySummary);
        const witchHistory = renderPerspectiveActionHistory(p.id);
        if (witchHistory) {
          const history = document.createElement('div');
          history.innerHTML = witchHistory;
          controls.appendChild(history);
        }
      }
      if (p.role !== '女巫' && p.role !== 'WITCH') {
        const perspectiveHistory = renderPerspectiveActionHistory(p.id);
        if (perspectiveHistory) {
          const history = document.createElement('div');
          history.innerHTML = perspectiveHistory;
          controls.appendChild(history);
        }
      }
      // The panel belongs to the selected player's perspective in the local prototype.
      // Perspective switching and role overrides are intentionally isolated to test mode.
      appendWolfSelfDestructAction(p, controls);
    }

    function appendWolfSelfDestructAction(player, container) {
      if (!player || roomState.isSpectator || !container) return;
      const validation = AwooGameEngine.validateWolfSelfDestruct({
        players: roomState.players,
        actorId: player.id,
        phase: roomState.currentPhase,
        rules: roomState.ruleset,
      });
      if (!validation.valid) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'wolf-self-destruct-action';
      const note = document.createElement('p');
      note.className = 'wolf-self-destruct-note';
      const isWhiteWolfKing = getRoleDefinition(player.role)?.name === '白狼王';
      note.textContent = isWhiteWolfKing
        ? '白狼王只能在白天發言階段自爆，並選擇一名存活玩家一同出局。'
        : '小狼自爆會立即中止白天、公投與遺言流程，直接進入下一夜。';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn-gothic btn-crimson';
      button.textContent = isWhiteWolfKing ? '💥 白狼王自爆並帶走一人' : '💥 小狼自爆（立即入夜）';
      button.addEventListener('click', () => wolfSelfDestruct(player.id));
      wrapper.append(note, button);
      container.appendChild(wrapper);
    }

    function wolfSelfDestruct(playerId) {
      if (roomState.isSpectator) {
        alert('觀眾不能發動角色技能。');
        return;
      }
      const previousPhase = roomState.currentPhase;
      const result = AwooGameEngine.resolveWolfSelfDestruct({
        players: roomState.players,
        actorId: playerId,
        phase: previousPhase,
        rules: roomState.ruleset,
      });
      if (!result.valid) {
        alert(result.reason);
        updateControlPanel();
        return;
      }

      clearInterval(roomState.timerInterval);
      roomState.timerInterval = null;
      roomState.activeSpeakerId = null;
      roomState.speechQueue = [];
      roomState.currentQueueIndex = 0;
      roomState.userVotes = {};
      currentVoteTarget = null;
      roomState.executedVictim = null;

      // If the first-day sheriff election is interrupted, that election ends without a sheriff.
      if (previousPhase === 'SHERIFF_ELECTION' || previousPhase === 'SHERIFF_VOTING') {
        roomState.sheriffCandidates = [];
        roomState.hasSheriffInGame = false;
        roomState.sheriffId = null;
        gameState.sheriffId = null;
      }

      recordGameHistory({
        visibility: 'public',
        phaseLabel: '白天出局',
        message: `${result.actor.id}號`,
      });

      renderTable();
      if (result.requiresTargetSelection) {
        if (startDeathSkillResolution([result.death], 'WHITE_WOLF_KING_SELF_DESTRUCT', null)) return;
      }
      const winner = roomState.ruleset.wolfSelfDestructEnabled ? checkWinCondition() : null;
      if (winner) {
        finishGame(winner);
        return;
      }

      startNextNight({
        announcement: `${result.actor.id} 號小狼自爆，白天流程立即中止。`,
        voiceMessage: `${result.actor.id} 號小狼自爆，白天立即結束。天黑請閉眼。`,
      });
    }

    function renderNightPanel(p, container) {
      if (!p.isAlive) {
        container.innerHTML = `<p style="color:#888; font-size:0.8rem;">您已出局，請靜觀局勢...</p>`;
        return;
      }

      if (p.role === '預言家' || p.role === 'SEER') {
        const canSeerAct = isModeratorActionStep('seerCheck') && roomState.moderatorSpeechDone;
        let html = `<p style="font-size:0.8rem; color:var(--gold-light);">選擇今晚查驗目標：</p>`;
        html += renderPlayerTargetGrid({ onSelect: 'seerCheck', isAllowed: t => t.isAlive && Number(t.id) !== Number(p.id), isDisabled: () => !canSeerAct || roomState.seerTargetId != null, showDead: true });
        const checkedTarget = roomState.seerTargetId == null ? null : roomState.players.find(t => Number(t.id) === Number(roomState.seerTargetId));
        const resultText = checkedTarget
          ? `查驗結果：${checkedTarget.id}號 是 ${getRoleCamp(checkedTarget.role) === '狼人' ? '狼人陣營（查殺）' : '好人陣營（金水）'}`
          : '';
        const resultColor = checkedTarget && getRoleCamp(checkedTarget.role) === '狼人' ? 'var(--crimson-bright)' : 'var(--gold-primary)';
        html += `<div id="seerResult" style="margin-top:10px; font-weight:bold; color:${resultColor};">${resultText}</div>`;
        container.innerHTML = html;
      }
      else if (p.role === '女巫' || p.role === 'WITCH') {
        const canWitchSave = isModeratorActionStep('witchSaveDecision') && roomState.moderatorSpeechDone;
        const canWitchPoison = isModeratorActionStep('witchPoisonDecision') && roomState.moderatorSpeechDone;
        const poisonSelection = roomState.showWitchPoisonTargets && canWitchPoison && !roomState.witchPoisonUsed
          ? `<div class="witch-poison-picker" role="group" aria-label="選擇毒藥目標">
              <p class="witch-poison-heading">選擇毒殺目標（已出局玩家反灰且不可選）</p>
              ${renderPlayerTargetGrid({ onSelect: 'selectWitchPoisonTarget', isAllowed: t => t.isAlive, selectedId: roomState.witchPoisonDraftTargetId, isDisabled: () => !canWitchPoison, showDead: true, dataAttribute: 'data-poison-target' })}
              <div class="witch-poison-confirm-row">
                <p class="witch-poison-selection">${roomState.witchPoisonDraftTargetId ? `目前選擇：${roomState.witchPoisonDraftTargetId}號` : '請選擇一位存活玩家。'}</p>
                <button type="button" class="btn-gothic btn-crimson" onclick="confirmWitchPoison()" ${roomState.witchPoisonDraftTargetId == null || !canWitchPoison ? 'disabled' : ''}>確認使用毒藥</button>
                <button type="button" class="btn-gothic" onclick="cancelWitchPoisonSelection()">取消</button>
              </div>
            </div>`
          : '';
        const poisonStatus = roomState.witchPoisonUsed
          ? `<p class="witch-poison-status">毒藥已使用${roomState.witchPoisonTargetId ? `：${roomState.witchPoisonTargetId}號，等待本夜結算` : ''}。</p>`
          : '';
        const witchHistoryPanel = renderPerspectiveActionHistory(p.id);
        container.innerHTML = `
          ${isModeratorActionStep('witchSaveDecision') && roomState.moderatorSpeechDone && !roomState.witchElixirUsed ? `<p style="font-size:0.8rem;">今晚狼刀目標：<b style="color:var(--crimson-bright);">${roomState.nightVictim != null ? roomState.nightVictim + '號' : '狼人選擇空刀'}</b></p>` : (roomState.witchElixirUsed ? '<p style="font-size:0.8rem;color:#999;">解藥已使用。</p>' : '')}
          <div class="witch-action-row">
            <button type="button" class="btn-gothic" ${!canWitchSave || roomState.witchElixirUsed || roomState.witchSaveDecisionMade || !roomState.nightVictim || (gameState.currentDay === 1 && roomState.witchPoisonUsed) ? 'disabled' : ''} onclick="useWitchElixir()">${roomState.witchElixirUsed ? '解藥（已用）' : '解藥救人'}</button>
            <button type="button" class="btn-gothic btn-crimson" ${!canWitchPoison || roomState.witchPoisonUsed || roomState.witchPoisonDecisionMade || (gameState.currentDay === 1 && roomState.witchElixirUsed) ? 'disabled' : ''} onclick="useWitchPoison()">${roomState.witchPoisonUsed ? '毒藥（已用）' : '毒藥毒人'}</button>
            ${isModeratorActionStep('witchSaveDecision') && !roomState.witchElixirUsed && !roomState.witchSaveDecisionMade ? `<button type="button" class="btn-gothic" ${!roomState.moderatorSpeechDone ? 'disabled' : ''} onclick="declineWitchElixir()">不救，保留解藥</button>` : ''}
            ${isModeratorActionStep('witchPoisonDecision') && !roomState.witchPoisonUsed && !roomState.witchPoisonDecisionMade ? `<button type="button" class="btn-gothic" ${!roomState.moderatorSpeechDone ? 'disabled' : ''} onclick="declineWitchPoison()">不使用毒藥</button>` : ''}
          </div>
          ${poisonStatus}
          ${poisonSelection}
          ${witchHistoryPanel}


        `;
      }
      else if (p.role === '守衛' || p.role === 'GUARD') {
        const canGuardAct = isModeratorActionStep('guardProtect') && roomState.moderatorSpeechDone;
        let html = `<p style="font-size:0.8rem;">選擇守護目標（不可連守）：</p>`;
        html += renderPlayerTargetGrid({ onSelect: 'guardProtect', isAllowed: t => t.isAlive, isDisabled: t => !canGuardAct || Number(t.id) === Number(roomState.guardLastTarget) || roomState.guardTargetId != null, showDead: true });
        container.innerHTML = html;
      }
      else if (getRoleCamp(p.role) === '狼人') {
        const canWolfAct = isModeratorActionStep('wolfAttack') && roomState.moderatorSpeechDone;
        const teammates = roomState.players.filter(t => getRoleCamp(t.role) === '狼人' && Number(t.id) !== Number(p.id));
        let html = `<p style="font-size:0.8rem; color:var(--crimson-bright);">狼隊隊友：<b>${teammates.length ? teammates.map(t => `${t.id}號${t.isAlive ? '' : '（已出局）'}`).join('、') : '沒有其他隊友'}</b></p><p style="font-size:0.8rem; color:var(--crimson-bright);">狼隊討論夜刀標靶：</p>`;
        html += renderPlayerTargetGrid({ onSelect: 'wolfKillTarget', isAllowed: t => t.isAlive && getRoleCamp(t.role) !== '狼人', isDisabled: t => !canWolfAct || roomState.wolfActionDecided || getRoleCamp(t.role) === '狼人', showDead: true });
        html += `<button type="button" class="btn-gothic" style="width:100%; margin-top:8px;" onclick="confirmWolfNoKill()" ${!canWolfAct || roomState.wolfActionDecided ? 'disabled' : ''}>確認空刀（本夜不襲擊）</button>`;
        if (roomState.wolfActionDecided) html += `<p class="test-action-confirmation">已完成狼人行動${roomState.nightVictim != null ? `：${roomState.nightVictim}號` : '：空刀'}，可繼續上帝流程。</p>`;
        container.innerHTML = html;
      }
      else {
        const baseMessage = '天黑請閉眼，請靜候天亮...';
        const testNotice = roomState.isTestMode
          ? `<p style="font-size:0.75rem; color:var(--gold-light); margin-top:8px;">測試提示：此角色目前沒有專屬夜間操作項；請查看下方控制項狀態，確認是被動角色或技能尚待實作。</p>`
          : '';
        container.innerHTML = `<p style="font-size:0.85rem; color:#aaa; text-align:center; padding:15px 0;">${baseMessage}</p>${testNotice}`;
      }
    }

    function seerCheck(targetId) {
      if (!canSubmitModeratorAction('seerCheck')) return false;
      if (roomState.seerTargetId != null) { alert('預言家本夜已完成查驗。'); return false; }
      const target = roomState.players.find(p => p.id === Number(targetId));
      const result = document.getElementById('seerResult');
      const validation = AwooGameEngine.validateNightAction({
        players: roomState.players, actorId: roomState.currentPerspective,
        action: 'seerCheck', targetId, state: { phase: roomState.currentPhase }
      });
      if (!validation.valid) {
        if (result) result.textContent = validation.reason;
        return;
      }
      roomState.seerTargetId = validation.target.id;
      recordGameHistory({ visibility: 'private', phaseLabel: '夜間技能', actorId: roomState.currentPerspective, message: `預言家查驗 ${validation.target.id} 號。` });
      const isWolf = getRoleCamp(target.role) === '狼人';
      if (result) {
        result.textContent = `查驗結果：${targetId}號 是 ${isWolf ? '狼人陣營（查殺）' : '好人陣營（金水）'}`;
        result.style.color = isWolf ? 'var(--crimson-bright)' : 'var(--gold-primary)';
      }
      renderGodFlowPanel();
      notifyModeratorActionCompleted();
      return true;
    }

    function useWitchElixir() {
      if (!canSubmitModeratorAction('witchSaveDecision')) return false;
      if (roomState.witchSaveDecisionMade || roomState.witchElixirUsed) return false;
      const validation = AwooGameEngine.validateNightAction({
        players: roomState.players, actorId: roomState.currentPerspective,
        action: 'witchSave', state: {
          phase: roomState.currentPhase, currentDay: gameState.currentDay, nightVictim: roomState.nightVictim,
          witchElixirUsed: roomState.witchElixirUsed, witchPoisonUsed: roomState.witchPoisonUsed,
          witchCanSelfSaveFirstNight: roomState.ruleset.witchCanSelfSaveFirstNight,
        }
      });
      if (!validation.valid) { alert(validation.reason); return; }
      roomState.witchElixirUsed = true;
      roomState.witchSaveDecisionMade = true;
      roomState.witchSaveTargetId = Number(validation.target.id);
      recordGameHistory({ visibility: 'private', phaseLabel: '夜間技能', actorId: roomState.currentPerspective, roleActionLabel: `解救 ${roomState.witchSaveTargetId}號`, message: `解救 ${roomState.witchSaveTargetId}號` });
      alert('已使用解藥；目標已記錄在女巫私密面板。');
      updateControlPanel();
      renderGodFlowPanel();
      notifyModeratorActionCompleted();
      return true;
    }

    function declineWitchElixir() {
      if (!canSubmitModeratorAction('witchSaveDecision')) return false;
      if (roomState.witchSaveDecisionMade || roomState.witchElixirUsed) return false;
      roomState.witchSaveDecisionMade = true;
      roomState.witchSaveTargetId = null;
      updateControlPanel();
      renderGodFlowPanel();
      notifyModeratorActionCompleted();
      return true;
    }

    function useWitchPoison() {
      if (!canSubmitModeratorAction('witchPoisonDecision')) return false;
      if (roomState.currentPhase !== 'NIGHT' || roomState.witchPoisonUsed || roomState.witchPoisonDecisionMade) return false;
      // Opening the picker is not the same as spending the poison. Only confirmation commits it.
      roomState.showWitchPoisonTargets = true;
      roomState.witchPoisonDraftTargetId = null;
      updateControlPanel();
      renderGodFlowPanel();
      return true;
    }

    function selectWitchPoisonTarget(targetId) {
      if (!canSubmitModeratorAction('witchPoisonDecision')) return false;
      if (roomState.currentPhase !== 'NIGHT' || roomState.witchPoisonUsed || roomState.witchPoisonDecisionMade) return false;
      const validation = AwooGameEngine.validateNightAction({
        players: roomState.players,
        actorId: roomState.currentPerspective,
        action: 'witchPoison',
        targetId,
        state: { phase: roomState.currentPhase, currentDay: gameState.currentDay, witchPoisonUsed: roomState.witchPoisonUsed, witchElixirUsed: roomState.witchElixirUsed },
      });
      if (!validation.valid) {
        alert(validation.reason);
        return false;
      }
      roomState.witchPoisonDraftTargetId = Number(validation.target.id);
      updateControlPanel();
      return true;
    }

    function confirmWitchPoison() {
      if (!canSubmitModeratorAction('witchPoisonDecision')) return false;
      const targetId = roomState.witchPoisonDraftTargetId;
      const validation = AwooGameEngine.validateNightAction({
        players: roomState.players,
        actorId: roomState.currentPerspective,
        action: 'witchPoison',
        targetId,
        state: {
          phase: roomState.currentPhase,
          currentDay: gameState.currentDay,
          witchPoisonUsed: roomState.witchPoisonUsed,
          witchElixirUsed: roomState.witchElixirUsed,
        },
      });
      if (!validation.valid) {
        alert(validation.reason || '請先選擇一位存活玩家。');
        return false;
      }
      roomState.witchPoisonUsed = true;
      roomState.witchPoisonDecisionMade = true;
      roomState.witchPoisonTargetId = Number(validation.target.id);
      recordGameHistory({ visibility: 'private', phaseLabel: '夜間技能', actorId: roomState.currentPerspective, roleActionLabel: `毒殺 ${roomState.witchPoisonTargetId}號`, message: `毒殺 ${roomState.witchPoisonTargetId}號` });
      roomState.showWitchPoisonTargets = false;
      roomState.witchPoisonDraftTargetId = null;
      updateControlPanel();
      renderGodFlowPanel();
      if (roomState.isTestMode) updateBanner('【女巫行動已記錄】', '女巫已記錄毒藥行動。', '毒藥目標只顯示在女巫私密面板；實際死亡名單以夜晚結算結果為準。');
      notifyModeratorActionCompleted();
      return true;
    }

    function declineWitchPoison() {
      if (!canSubmitModeratorAction('witchPoisonDecision')) return false;
      if (roomState.witchPoisonUsed || roomState.witchPoisonDecisionMade) return false;
      roomState.witchPoisonDecisionMade = true;
      roomState.witchPoisonTargetId = null;
      roomState.showWitchPoisonTargets = false;
      roomState.witchPoisonDraftTargetId = null;
      updateControlPanel();
      renderGodFlowPanel();
      notifyModeratorActionCompleted();
      return true;
    }

    function cancelWitchPoisonSelection() {
      roomState.showWitchPoisonTargets = false;
      roomState.witchPoisonDraftTargetId = null;
      updateControlPanel();
    }

    function guardProtect(targetId) {
      if (!canSubmitModeratorAction('guardProtect')) return false;
      if (roomState.guardTargetId != null) { alert('守衛本夜已完成守護。'); return false; }
      const validation = AwooGameEngine.validateNightAction({
        players: roomState.players, actorId: roomState.currentPerspective,
        action: 'guardProtect', targetId, state: {
          phase: roomState.currentPhase, previousGuardTargetId: roomState.guardLastTarget
        }
      });
      if (!validation.valid) { alert(validation.reason); return; }
      roomState.guardTargetId = Number(validation.target.id);
      recordGameHistory({ visibility: 'private', phaseLabel: '夜間技能', actorId: roomState.currentPerspective, message: `守衛守護 ${validation.target.id} 號。` });
      alert('守衛行動已記錄；目標保存在守衛的私密技能紀錄中。');
      updateControlPanel();
      renderGodFlowPanel();
      notifyModeratorActionCompleted();
      return true;
    }

    function wolfKillTarget(targetId) {
      if (!canSubmitModeratorAction('wolfAttack')) return false;
      if (roomState.wolfActionDecided || roomState.nightVictim != null) { alert('狼人本夜已確認襲擊目標。'); return false; }
      const validation = AwooGameEngine.validateNightAction({
        players: roomState.players, actorId: roomState.currentPerspective,
        action: 'wolfAttack', targetId, state: { phase: roomState.currentPhase }
      });
      if (!validation.valid) { alert(validation.reason); return; }
      roomState.nightVictim = Number(validation.target.id);
      recordGameHistory({ visibility: 'private', phaseLabel: '夜間技能', actorId: roomState.currentPerspective, message: `狼人夜刀指定 ${roomState.nightVictim} 號。` });
      roomState.wolfActionDecided = true;
      // Avoid interrupting the God narration with a blocking browser alert.
      updateControlPanel();
      renderGodFlowPanel();
      notifyModeratorActionCompleted();
      return true;
    }

    function confirmWolfNoKill() {
      if (!canSubmitModeratorAction('wolfAttack')) return false;
      if (roomState.wolfActionDecided) return false;
      roomState.nightVictim = null;
      roomState.wolfActionDecided = true;
      updateControlPanel();
      renderGodFlowPanel();
      notifyModeratorActionCompleted();
      return true;
    }

    function renderVotingPanel(p, container) {
      if (!p.isAlive) {
        container.innerHTML = `<p style="color:#888; font-size:0.8rem;">您已出局，無投票權。</p>`;
        return;
      }

      const runoff = roomState.isTieRunoff === true && Array.isArray(roomState.runoffCandidates) && roomState.runoffCandidates.length > 0;
      const prompt = runoff ? '平票加賽：只能選擇平票玩家或棄票' : '請選擇公投處決目標';
      let html = `<p style="font-size:0.8rem; color:var(--gold-light);">${prompt} (倒數 ${roomState.votingTimer}s)：</p><div class="target-grid">`;
      roomState.players.forEach(t => {
        const blockedByRunoff = runoff && !roomState.runoffCandidates.includes(Number(t.id));
        html += `<button class="target-btn" id="voteBtn-${t.id}" ${!t.isAlive || blockedByRunoff ? 'disabled' : ''} onclick="selectVoteTarget(${t.id})">${t.id}號</button>`;
      });
      html += `</div>
        <button class="target-btn" id="voteBtn-0" style="width:100%; margin-top:8px;" onclick="selectVoteTarget(0)">棄票 (不投票)</button>
        <button class="btn-gothic btn-crimson" style="width:100%; margin-top:10px;" onclick="confirmVote()">確認投票</button>
      `;
      container.innerHTML = html;
    }

    let currentVoteTarget = null;
    function selectVoteTarget(id) {
      const targetId = Number(id);
      if (roomState.isTieRunoff && targetId !== 0 && !roomState.runoffCandidates.includes(targetId)) return false;
      currentVoteTarget = targetId;
      document.querySelectorAll('.target-btn').forEach(b => b.classList.remove('selected'));
      const btn = document.getElementById(`voteBtn-${id}`);
      if (btn) btn.classList.add('selected');
    }

    function confirmVote() {
      const voterId = Number(roomState.currentPerspective);
      const validation = AwooGameEngine.validateVoteSelection({
        players: roomState.players, voterId, targetId: currentVoteTarget,
        votes: roomState.userVotes, phase: roomState.currentPhase
      });
      if (!validation.valid) { alert(validation.reason); return; }
      roomState.userVotes[voterId] = validation.targetId;
      alert(currentVoteTarget === 0 ? '已確認棄票！' : `已確認投票處決 ${currentVoteTarget} 號！`);
      updateControlPanel();
    }

    function startGameFlow() {
      // This function is only for the initial deal. Later nights must call startNextNight().
      if (roomState.gameStarted || roomState.currentPhase !== 'LOBBY') {
        alert('本局已經開始，不能重新發牌。');
        return;
      }
      if (!roomState.isHost) { alert('只有房主可以開始遊戲。'); return; }
      const hasEmptySeat = roomState.players.some(p => !p.isOccupied);
      if (hasEmptySeat) {
        alert('房間尚未滿席！必須等待所有座位皆有玩家入座，才可開始遊戲。');
        return;
      }

      let rolePool = [];
      const preset = document.getElementById('setupPlayerCount')?.value;
      if (preset === 'custom') {
        rolePool = [...roomState.customRolePool];
        if (rolePool.length > roomState.playerCount) {
          alert(`已勾選 ${rolePool.length} 個角色，超過目前 ${roomState.playerCount} 人，請減少角色。`);
          return;
        }
        while (rolePool.length < roomState.playerCount) rolePool.push('平民');
      } else {
        const config = STANDARD_CONFIGS[roomState.playerCount];
        if (!config) { alert('找不到對應人數的標準板型。'); return; }
        rolePool = [...config.pool];
      }

      let dealtRoles;
      try {
        dealtRoles = AwooGameEngine.dealRoles(rolePool, roomState.playerCount);
      } catch (error) {
        alert(error.message || '角色配置有誤，請檢查角色數量與陣營資料。');
        return;
      }

      // A formal game must not silently pass a role whose active night ability is only a placeholder.
      // Test mode keeps these roles selectable for control-panel/script inspection.
      if (!roomState.isTestMode && window.AwooModeratorScript) {
        const preview = AwooModeratorScript.buildNightScript(dealtRoles, 1, roomState.ruleset);
        const unsupported = [...new Set(preview.steps
          .filter(step => typeof step.actionKey === 'string' && step.actionKey.startsWith('manual:'))
          .map(step => step.role))];
        if (unsupported.length) {
          alert(`正式模式尚不能開始：以下角色的主動技能尚未接入遊戲引擎：${unsupported.join('、')}。請先在測試模式巡檢，或將這些角色替換為已實作的角色。`);
          return;
        }
      }

      roomState.players.forEach((p, idx) => {
        p.role = dealtRoles[idx];
        p.isAlive = true;
        p.deathReason = null;
        p.deathSkillUsed = false;
        p.isProtected = false;
        p.canShoot = true;
        p.isSheriff = false;
      });
      gameState.players = roomState.players;
      roomState.rolesInGame = [...new Set(dealtRoles)];
      roomState.actionHistory = [];
      gameState.currentDay = 1;
      gameState.sheriffId = null;
      gameState.lastGuardedId = null;
      roomState.gameStarted = true;
      roomState.gameOver = false;
      updatePerspectiveSelect();
      roomState.hasSheriffInGame = false;
      roomState.sheriffId = null;
      roomState.sheriffCandidates = [];
      roomState.sheriffVotes = {};
      roomState.sheriffElectionRound = 0;
      roomState.deathSkillQueue = [];
      roomState.deathSkillReturnPhase = null;
      roomState.deathSkillExecutedVictim = null;
      roomState.deathSkillDeaths = [];
      roomState.sheriffBadgeReturnPhase = null;
      roomState.sheriffBadgeExecutedVictim = null;
      roomState.guardLastTarget = null;
      roomState.witchElixirUsed = false;
      roomState.witchPoisonUsed = false;
      beginNight();
    }

    function beginNight(entry = {}) {
      if (!roomState.gameStarted || roomState.gameOver) return;
      clearModeratorAutoAdvance();
      clearInterval(roomState.timerInterval);
      roomState.timerInterval = null;
      if (!setCurrentPhase('NIGHT')) return;
      AwooGameEngine.resetNightActions(roomState);
      roomState.wolfActionDecided = false;
      roomState.witchSaveDecisionMade = false;
      roomState.witchPoisonDecisionMade = false;
      roomState.moderatorManualCompletedStepIndex = null;
      roomState.moderatorSpeechDone = true;
      roomState.showWitchPoisonTargets = false;
      roomState.witchPoisonDraftTargetId = null;
      refreshModeratorScriptForCurrentNight(entry);
      // Rebuild the perspective labels after role assignment and night-state initialization.
      updatePerspectiveSelect();

      const nightAnnouncement = entry.announcement || `第 ${gameState.currentDay} 夜：上帝將依本局角色自動主持。`;
      const nightDuration = Math.max(90, (roomState.moderatorScript || []).length * 5);
      const timerHint = roomState.isTestMode
        ? `測試模式逐句主持倒數：${nightDuration}s；你可手動推進並巡檢角色。`
        : `系統上帝自動主持；若需要角色操作，會等待該操作完成後自動繼續。提醒倒數：${nightDuration}s。`;
      updateBanner('【夜間行動】', nightAnnouncement, timerHint);
      renderTable();
      updateControlPanel();

      // A timeout must never bypass a role's pending action. Once the reminder expires,
      // stop the reminder timer and leave the current moderator step waiting for explicit input.
      let secondsLeft = nightDuration;
      roomState.timerInterval = setInterval(() => {
        secondsLeft--;
        updateBanner('【夜間行動】', nightAnnouncement, roomState.isTestMode
          ? `測試模式提醒倒數：${secondsLeft}s；角色操作不會被倒數略過。`
          : `系統上帝自動主持；等待角色操作時不會跳過。提醒倒數：${secondsLeft}s。`);
        if (secondsLeft <= 0) {
          clearInterval(roomState.timerInterval);
          roomState.timerInterval = null;
          updateBanner('【等待角色操作】', roomState.isTestMode
            ? '測試模式仍在等待當前口白／操作，可手動檢查流程。'
            : '系統上帝正在等待目前角色完成行動；完成後會自動繼續，不需要主持人按下一句。',
            roomState.isTestMode ? '測試模式保留手動推進。' : '不會因提醒倒數結束而略過技能或提前結算。');
        }
      }, 1000);
    }

    function clearModeratorAutoAdvance() {
      if (roomState.moderatorAutoAdvanceTimer != null && typeof clearTimeout === 'function') {
        clearTimeout(roomState.moderatorAutoAdvanceTimer);
      }
      roomState.moderatorAutoAdvanceTimer = null;
      roomState.moderatorAutoAdvanceToken = (roomState.moderatorAutoAdvanceToken || 0) + 1;
    }

    function getModeratorAutoAdvanceDelay(step = getCurrentModeratorStep()) {
      const configured = step && Number(step.postSpeechPauseMs);
      return Number.isFinite(configured) && configured >= 0 ? configured : 700;
    }

    function scheduleModeratorAutoAdvance(delayMs = getModeratorAutoAdvanceDelay()) {
      // Test mode intentionally keeps manual stepping and role-perspective inspection.
      if (roomState.isTestMode || roomState.gameOver || roomState.currentPhase !== 'NIGHT') return false;
      const step = getCurrentModeratorStep();
      if (!canAdvanceModeratorStep(step)) return false;
      clearModeratorAutoAdvance();
      const token = roomState.moderatorAutoAdvanceToken;
      const expectedIndex = Number(roomState.moderatorStepIndex || 0);
      roomState.moderatorAutoAdvanceTimer = setTimeout(() => {
        roomState.moderatorAutoAdvanceTimer = null;
        if (token !== roomState.moderatorAutoAdvanceToken) return;
        if (roomState.isTestMode || roomState.gameOver || roomState.currentPhase !== 'NIGHT') return;
        if (Number(roomState.moderatorStepIndex || 0) !== expectedIndex) return;
        const currentStep = getCurrentModeratorStep();
        if (!canAdvanceModeratorStep(currentStep)) {
          renderGodFlowPanel();
          return;
        }
        advanceModeratorLine({ automatic: true });
      }, Math.max(0, Number(delayMs) || 0));
      return true;
    }

    function notifyModeratorActionCompleted() {
      renderGodFlowPanel();
      if (roomState.currentPhase === 'NIGHT' && !roomState.isTestMode && canAdvanceModeratorStep()) {
        scheduleModeratorAutoAdvance(650);
      }
    }

    function refreshModeratorScriptForCurrentNight(entry = {}) {
      clearModeratorAutoAdvance();
      if (!window.AwooModeratorScript || !roomState.gameStarted) {
        roomState.moderatorScript = [];
        roomState.moderatorNotices = [];
        roomState.moderatorStepIndex = 0;
        renderGodFlowPanel();
        return;
      }
      // Build narration from the roles dealt into the game, not only the living players.
      // Eliminated roles still receive their wake/close narration cue, but never an actionable prompt.
      const configuredRoleNames = [...new Set(roomState.players
        .filter(player => player.role && player.role !== '未發牌')
        .map(player => player.role))];
      const livingRoleNames = new Set(roomState.players
        .filter(player => player.isAlive && player.role && player.role !== '未發牌')
        .map(player => player.role));
      roomState.rolesInGame = configuredRoleNames;
      const result = AwooModeratorScript.buildNightScript(configuredRoleNames, gameState.currentDay, roomState.ruleset);
      roomState.moderatorScript = result.steps.map(step => {
        if (!step.role || step.role === '全體' || step.role === '狼人陣營' || livingRoleNames.has(step.role) || !step.actionKey) return step;
        // Keep the role's normal narration line, but never announce that the role is eliminated.
        // Removing the action key prevents a dead role from submitting an action.
        return { ...step, actionKey: null };
      });
      roomState.moderatorNotices = result.notices;
      roomState.moderatorStepIndex = 0;
      roomState.moderatorManualCompletedStepIndex = null;
      roomState.moderatorSpeechDone = true;
      if (entry.voiceMessage && roomState.moderatorScript.length) {
        roomState.moderatorScript[0] = {
          ...roomState.moderatorScript[0],
          text: entry.voiceMessage,
          speechText: entry.voiceMessage,
        };
      }
      renderGodFlowPanel();
      // Always start with the first cue. Formal mode advances automatically after each cue/action;
      // test mode preserves manual controls so all role panels can be inspected.
      speakCurrentModeratorLine();
    }

    function getCurrentModeratorStep() {
      const steps = roomState.moderatorScript || [];
      return steps[roomState.moderatorStepIndex || 0] || null;
    }

    function isModeratorActionStep(actionKey) {
      const step = getCurrentModeratorStep();
      return !!(step && step.actionKey === actionKey);
    }

    function isCurrentPerspectiveRole(roleName) {
      const player = roomState.players.find(item => Number(item.id) === Number(roomState.currentPerspective));
      if (!player || !player.isAlive) return false;
      if (roleName === '狼人陣營') return getRoleCamp(player.role) === '狼人';
      const actual = getRoleDefinition(player.role);
      const expected = getRoleDefinition(roleName);
      return actual ? actual.name === (expected ? expected.name : roleName) : player.role === roleName;
    }

    function canSubmitModeratorAction(actionKey, showAlert = true) {
      if (roomState.currentPhase !== 'NIGHT') return false;
      // Keep direct unit/integration testing and legacy isolated skill tests possible when no script exists.
      if (!Array.isArray(roomState.moderatorScript) || roomState.moderatorScript.length === 0) return true;
      const step = getCurrentModeratorStep();
      if (!step || step.actionKey !== actionKey) {
        if (showAlert) alert('請先讓上帝唸到此角色的行動口白，再進行操作。');
        return false;
      }
      if (!roomState.moderatorSpeechDone) {
        if (showAlert) alert('請先聽完目前這句上帝口白，再進行角色操作。');
        return false;
      }
      return true;
    }

    function isModeratorStepActionComplete(step = getCurrentModeratorStep()) {
      if (!step || !step.actionKey) return true;
      switch (step.actionKey) {
        case 'wolfAttack':
          return roomState.wolfActionDecided === true;
        case 'witchSaveDecision':
          return roomState.witchSaveDecisionMade === true || roomState.witchElixirUsed === true;
        case 'witchPoisonDecision':
          return roomState.witchPoisonDecisionMade === true || roomState.witchPoisonUsed === true;
        case 'seerCheck':
          return roomState.seerTargetId != null;
        case 'guardProtect':
          return roomState.guardTargetId != null;
        default:
          if (step.actionKey.startsWith('manual:')) {
            return roomState.moderatorManualCompletedStepIndex === Number(roomState.moderatorStepIndex);
          }
          return true;
      }
    }

    function canAdvanceModeratorStep(step = getCurrentModeratorStep()) {
      return !!step && roomState.moderatorSpeechDone === true && isModeratorStepActionComplete(step);
    }

    function completeModeratorManualAction() {
      const step = getCurrentModeratorStep();
      if (!step || !step.actionKey || !step.actionKey.startsWith('manual:')) return false;
      if (!canSubmitModeratorAction(step.actionKey, true)) return false;
      if (!isCurrentPerspectiveRole(step.role) && step.role !== '情侶') {
        alert(`請先切換到 ${step.role} 的座位，再確認此操作完成。`);
        return false;
      }
      roomState.moderatorManualCompletedStepIndex = Number(roomState.moderatorStepIndex);
      renderGodFlowPanel();
      updateControlPanel();
      return true;
    }

    function renderGodFlowPanel() {
      const panel = document.getElementById('godFlowPanel');
      if (!panel) return;
      const visible = roomState.gameStarted && !roomState.gameOver && roomState.currentPhase === 'NIGHT' && Array.isArray(roomState.moderatorScript) && roomState.moderatorScript.length > 0;
      panel.hidden = !visible;
      if (!visible) return;

      const steps = roomState.moderatorScript;
      const index = Math.min(Math.max(0, roomState.moderatorStepIndex || 0), steps.length - 1);
      const step = steps[index];
      const title = document.getElementById('godFlowStepTitle');
      const count = document.getElementById('godFlowCounter');
      const currentLine = document.getElementById('godFlowCurrentLine');
      const note = document.getElementById('godFlowNote');
      const notices = document.getElementById('godFlowNotices');
      const status = document.getElementById('godFlowStatus');
      const playButton = document.getElementById('godFlowSpeakButton');
      const nextButton = document.getElementById('godFlowNextButton');
      const replayButton = document.getElementById('godFlowReplayButton');
      const resolveButton = document.getElementById('godFlowResolveButton');
      const manualButton = document.getElementById('godFlowManualCompleteButton');

      if (title) title.textContent = `${step.role || '上帝'}｜當前口白`;
      if (count) count.textContent = `第 ${index + 1} / ${steps.length} 句`;
      if (currentLine) currentLine.textContent = step.text || '';
      let noteText = step.note || '';
      if (step.condition === 'antidote-available' && roomState.nightVictim != null) {
        noteText = '操作提示：在女巫私密控制台顯示狼刀目標；不要透過公開語音或公共面板讀出號碼。';
      }
      // Detailed role notes/notices are useful in local QA, but must not leak hidden-role metadata in a live game.
      if (note) note.textContent = roomState.isTestMode ? noteText : '';
      if (notices) {
        notices.textContent = roomState.isTestMode
          ? ((roomState.moderatorNotices || []).length
            ? `需核對的角色流程：${roomState.moderatorNotices.join('；')}`
            : '本局配置角色都有對應的流程口白。')
          : '';
      }
      const speechReady = roomState.moderatorSpeechDone === true;
      const actionComplete = isModeratorStepActionComplete(step);
      const testMode = roomState.isTestMode === true;
      if (status) {
        if (!speechReady) status.textContent = testMode
          ? '測試模式：上帝正在朗讀，播放完畢後可手動檢查下一步。'
          : '系統上帝正在朗讀；語音結束後會自動等待該角色行動。';
        else if (!actionComplete && step.actionKey && step.actionKey.startsWith('manual:')) status.textContent = `測試模式：等待 ${step.role} 手動確認。此角色可能尚未接入專屬技能；確認流程不代表技能已實作。`;
        else if (!actionComplete) status.textContent = testMode
          ? `測試模式：等待 ${step.role || '對應角色'} 完成操作，再手動推進。`
          : `系統上帝正在等待 ${step.role || '對應角色'} 完成操作；完成後會自動播放下一句。`;
        else status.textContent = testMode
          ? '測試模式：本句已完成，可以手動繼續。'
          : '本句已完成，系統上帝即將自動繼續。';
      }
      // The formal game has no human moderator: manual script controls are strictly test-only.
      if (playButton) { playButton.hidden = !testMode; playButton.disabled = !step.speechText; }
      if (nextButton) {
        nextButton.hidden = !testMode;
        nextButton.disabled = !canAdvanceModeratorStep(step);
        nextButton.textContent = !speechReady ? '口白播放中…' : (!actionComplete ? '等待角色完成操作' : (index >= steps.length - 1 ? '天亮並結算本夜' : '下一句並播放'));
      }
      if (replayButton) { replayButton.hidden = !testMode; replayButton.disabled = steps.length === 0; }
      if (resolveButton) resolveButton.hidden = !testMode;
      if (manualButton) {
        const isManualStep = !!(step.actionKey && step.actionKey.startsWith('manual:'));
        manualButton.hidden = !isManualStep || actionComplete || !testMode;
        manualButton.disabled = !speechReady;
      }
    }

    function speakCurrentModeratorLine() {
      const steps = roomState.moderatorScript || [];
      const step = steps[roomState.moderatorStepIndex || 0];
      if (!step) return false;

      // Invalidate callbacks from a prior utterance before cancelling/replaying it.
      clearModeratorAutoAdvance();
      roomState.moderatorSpeechToken = (roomState.moderatorSpeechToken || 0) + 1;
      const token = roomState.moderatorSpeechToken;
      const finishSpeech = () => {
        if (token !== roomState.moderatorSpeechToken) return;
        roomState.moderatorSpeechDone = true;
        renderGodFlowPanel();
        if (roomState.currentPhase === 'NIGHT') updateControlPanel();
        // Formal mode runs as an autonomous moderator. Non-action cues move on by themselves;
        // action cues stop here until the role commits a valid decision.
        if (!roomState.isTestMode && canAdvanceModeratorStep(step)) {
          scheduleModeratorAutoAdvance(getModeratorAutoAdvanceDelay(step));
        }
      };

      if (!step.speechText || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
        roomState.moderatorSpeechDone = true;
        renderGodFlowPanel();
        if (roomState.currentPhase === 'NIGHT') updateControlPanel();
        if (!step.speechText) {
          updateBanner('【上帝私密操作提示】', step.text || '此步驟不公開播報。', step.note || '請在角色私密控制台完成操作。');
        }
        // Browsers without speech synthesis still follow the same automated state machine.
        if (!roomState.isTestMode && canAdvanceModeratorStep(step)) {
          scheduleModeratorAutoAdvance(getModeratorAutoAdvanceDelay(step));
        }
        return !!step.speechText;
      }

      roomState.moderatorSpeechDone = false;
      renderGodFlowPanel();
      if (roomState.currentPhase === 'NIGHT') updateControlPanel();
      try {
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance(step.speechText);
        msg.lang = 'zh-TW';
        msg.rate = 0.95;
        msg.volume = 1;
        const voices = window.speechSynthesis.getVoices();
        if (voices.length) godVoiceCache = voices;
        const zhVoice = getGodChineseVoice(godVoiceCache.length ? godVoiceCache : voices);
        if (zhVoice) {
          msg.voice = zhVoice;
          msg.lang = zhVoice.lang || 'zh-TW';
        }
        msg.onend = finishSpeech;
        msg.onerror = event => {
          console.warn('[Awoo] 上帝語音播放錯誤：', event && event.error ? event.error : 'unknown');
          finishSpeech();
        };
        window.speechSynthesis.speak(msg);
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      } catch (error) {
        roomState.moderatorSpeechDone = true;
        console.warn('[Awoo] 上帝口白語音播放失敗，改由自動流程依狀態推進：', error);
        renderGodFlowPanel();
        if (roomState.currentPhase === 'NIGHT') updateControlPanel();
        if (!roomState.isTestMode && canAdvanceModeratorStep(step)) {
          scheduleModeratorAutoAdvance(getModeratorAutoAdvanceDelay(step));
        }
      }
      return true;
    }

    function shouldSkipModeratorStep(step) {
      if (!step || !step.condition) return false;
      // Keep the Witch's narration even when a potion has already been spent.
      // Only omit the antidote prompt when the wolf target does not exist or is already dead.
      if (step.condition === 'antidote-available') {
        const target = roomState.players.find(player => Number(player.id) === Number(roomState.nightVictim));
        return !target || !target.isAlive;
      }
      if (step.condition === 'poison-available') return false;
      return false;
    }

    function advanceModeratorLine(options = {}) {
      const automatic = !!(options && options.automatic);
      if (!roomState.isTestMode && !automatic) return false;
      if (roomState.currentPhase !== 'NIGHT' || !roomState.moderatorScript.length) return false;
      clearModeratorAutoAdvance();
      const currentStep = getCurrentModeratorStep();
      if (!canAdvanceModeratorStep(currentStep)) {
        renderGodFlowPanel();
        return false;
      }
      const lastIndex = roomState.moderatorScript.length - 1;
      if (roomState.moderatorStepIndex >= lastIndex) {
        return resolveNightNow();
      }
      let nextIndex = roomState.moderatorStepIndex + 1;
      while (nextIndex <= lastIndex && shouldSkipModeratorStep(roomState.moderatorScript[nextIndex])) nextIndex++;
      if (nextIndex > lastIndex) return resolveNightNow();
      roomState.moderatorStepIndex = nextIndex;
      roomState.moderatorManualCompletedStepIndex = null;
      roomState.moderatorSpeechDone = true;
      renderGodFlowPanel();
      updateControlPanel();
      speakCurrentModeratorLine();
      return true;
    }

    function skipModeratorSpeech() {
      if (!roomState.isTestMode || roomState.currentPhase !== 'NIGHT') return false;
      const step = getCurrentModeratorStep(); if (!step) return false;
      clearModeratorAutoAdvance(); roomState.moderatorSpeechToken = (roomState.moderatorSpeechToken || 0) + 1;
      if ('speechSynthesis' in window && window.speechSynthesis && typeof window.speechSynthesis.cancel === 'function') window.speechSynthesis.cancel();
      roomState.moderatorSpeechDone = true; renderGodFlowPanel(); updateControlPanel();
      if (isModeratorStepActionComplete(step)) return advanceModeratorLine();
      return true;
    }

    // Test-mode shortcut: skip the entire player-by-player daytime speech phase.
    // This deliberately does not skip moderator narration during the night.
    function skipDaySpeech() {
      if (!roomState.isTestMode || !roomState.gameStarted || roomState.currentPhase !== 'DAY_SPEECH' || roomState.gameOver) return false;
      clearInterval(roomState.timerInterval);
      roomState.timerInterval = null;
      roomState.activeSpeakerId = null;
      roomState.currentQueueIndex = Array.isArray(roomState.speechQueue) ? roomState.speechQueue.length : 0;
      enterVotingPhase();
      return roomState.currentPhase === 'VOTING';
    }

    function replayModeratorScript() {
      if (!roomState.isTestMode || roomState.currentPhase !== 'NIGHT' || !roomState.moderatorScript.length) return false;
      clearModeratorAutoAdvance();
      roomState.moderatorStepIndex = 0;
      roomState.moderatorManualCompletedStepIndex = null;
      roomState.moderatorSpeechDone = true;
      renderGodFlowPanel();
      updateControlPanel();
      speakCurrentModeratorLine();
      return true;
    }

    function resolveNightNow() {
      if (roomState.currentPhase !== 'NIGHT' || !roomState.gameStarted || roomState.gameOver) return false;
      clearInterval(roomState.timerInterval);
      roomState.timerInterval = null;
      renderGodFlowPanel();
      settleNightActions(
        roomState.nightVictim,
        roomState.witchSaveTargetId,
        roomState.witchPoisonTargetId,
        roomState.guardTargetId
      );
      if (startDeathSkillResolution(roomState.lastNightDeaths, 'DAY_DEATH', null)) return true;
      const winner = checkWinCondition();
      if (winner) {
        const deaths = Array.isArray(roomState.lastNightDeaths) ? roomState.lastNightDeaths : [];
        finishGame(winner, formatNightDeathSummary(deaths));
        return true;
      }
      if (startSheriffBadgeDecision('DAY_DEATH')) return true;

      if (roomState.sheriffMode === 'enabled' && gameState.currentDay === 1 && !roomState.hasSheriffInGame) {
        if (!setCurrentPhase('SHERIFF_ELECTION')) return false;
        startSheriffCountdown();
      } else {
        announceDayDeath();
      }
      return true;
    }

    function startNextNight(entry = {}) {
      if (roomState.gameOver) return;
      gameState.currentDay += 1;
      beginNight(entry);
    }

    function startSheriffCountdown() {
      roomState.sheriffTimer = 30;
      updateBanner("【警長競選】", "天將破曉，請競選警長的玩家舉手...", `舉手倒數：30s`);
      speakGod("天將破曉，請競選警長的玩家舉手。");
      updateControlPanel();

      clearInterval(roomState.timerInterval);
      roomState.timerInterval = setInterval(() => {
        roomState.sheriffTimer--;
        updateBanner("【警長競選】", "天將破曉，請競選警長的玩家舉手...", `舉手倒數：${roomState.sheriffTimer}s`);
        if (roomState.sheriffTimer <= 0) {
          clearInterval(roomState.timerInterval);
          processSheriffCandidates();
        }
      }, 1000);
    }

    function candidateSheriff(id) {
      const candidate = roomState.players.find(p => p.id === Number(id));
      if (roomState.currentPhase !== 'SHERIFF_ELECTION' || !candidate || !candidate.isAlive) return false;
      const candidateId = Number(id);
      const existingIndex = roomState.sheriffCandidates.indexOf(candidateId);
      if (existingIndex >= 0) {
        roomState.sheriffCandidates.splice(existingIndex, 1);
      } else {
        roomState.sheriffCandidates.push(candidateId);
      }
      renderTable();
      updateControlPanel();
      return true;
    }

    function processSheriffCandidates() {
      roomState.sheriffCandidates = roomState.sheriffCandidates.filter(id => {
        const candidate = roomState.players.find(player => Number(player.id) === Number(id));
        return candidate && candidate.isAlive;
      });
      if (roomState.sheriffCandidates.length === 0) {
        finishSheriffElectionWithoutWinner('本局無人競選警長，本局無警長！進入白天發言。');
        return;
      }
      if (roomState.sheriffCandidates.length === 1) {
        electSheriff(roomState.sheriffCandidates[0]);
        return;
      }
      roomState.sheriffVotes = {};
      roomState.sheriffElectionRound = 1;
      startSheriffVoting();
    }

    function finishSheriffElectionWithoutWinner(message) {
      roomState.hasSheriffInGame = false;
      roomState.sheriffId = null;
      gameState.sheriffId = null;
      roomState.players.forEach(player => { player.isSheriff = false; });
      speakGod(message);
      announceDayDeath();
    }

    function electSheriff(winnerId) {
      const winner = roomState.players.find(player => Number(player.id) === Number(winnerId) && player.isAlive);
      if (!winner) {
        finishSheriffElectionWithoutWinner('警長候選人已出局，本局無警長。');
        return;
      }
      roomState.hasSheriffInGame = true;
      roomState.sheriffId = Number(winner.id);
      gameState.sheriffId = Number(winner.id);
      roomState.players.forEach(player => { player.isSheriff = Number(player.id) === Number(winner.id); });
      renderTable();
      speakGod(`${winner.id} 號玩家當選警長！`);
      announceDayDeath();
    }

    function startSheriffVoting() {
      if (!setCurrentPhase('SHERIFF_VOTING')) return;
      roomState.votingTimer = 15;
      roomState.sheriffVotes = {};
      updateBanner('【警長競選投票】', `候選人：${roomState.sheriffCandidates.join('、')} 號。請存活玩家投票。`, `投票倒數：${roomState.votingTimer}s`);
      speakGod('警長候選人發言結束，請存活玩家投票選出警長。');
      renderTable();
      updateControlPanel();
      clearInterval(roomState.timerInterval);
      roomState.timerInterval = setInterval(() => {
        roomState.votingTimer--;
        updateBanner('【警長競選投票】', `候選人：${roomState.sheriffCandidates.join('、')} 號。請存活玩家投票。`, `投票倒數：${roomState.votingTimer}s`);
        if (roomState.votingTimer <= 0) {
          clearInterval(roomState.timerInterval);
          roomState.timerInterval = null;
          finalizeSheriffVote();
        }
      }, 1000);
    }

    function renderSheriffVotingPanel(player, container) {
      if (!player.isAlive) {
        container.innerHTML = '<p style="color:#888;">出局玩家沒有警長投票權。</p>';
        return;
      }
      const alreadyVoted = Object.prototype.hasOwnProperty.call(roomState.sheriffVotes, String(player.id));
      const candidates = roomState.sheriffCandidates.filter(id => {
        const candidate = roomState.players.find(item => Number(item.id) === Number(id));
        return candidate && candidate.isAlive;
      });
      container.innerHTML = `
        <p style="font-size:0.85rem;color:var(--gold-light);">警長競選投票（第 ${roomState.sheriffElectionRound} 輪，剩餘 ${roomState.votingTimer}s）</p>
        ${alreadyVoted ? `<p>已投票給 ${roomState.sheriffVotes[String(player.id)]} 號。</p>` : `
          <div class="target-grid">${candidates.map(id => `<button class="target-btn" onclick="voteSheriff(${id})">${id}號候選人</button>`).join('')}</div>
          <button class="target-btn" style="width:100%;margin-top:8px;" onclick="voteSheriff(0)">棄票</button>
        `}
      `;
    }

    function voteSheriff(candidateId) {
      if (roomState.currentPhase !== 'SHERIFF_VOTING') return false;
      const voterId = Number(roomState.currentPerspective);
      const voter = roomState.players.find(player => Number(player.id) === voterId);
      if (!voter || !voter.isAlive) { alert('出局玩家沒有警長投票權。'); return false; }
      const key = String(voterId);
      if (Object.prototype.hasOwnProperty.call(roomState.sheriffVotes, key)) { alert('本輪已經投過警長票。'); return false; }
      const targetId = Number(candidateId);
      if (targetId !== 0 && !roomState.sheriffCandidates.some(id => Number(id) === targetId && roomState.players.some(player => Number(player.id) === targetId && player.isAlive))) {
        alert('請選擇仍存活的警長候選人。');
        return false;
      }
      roomState.sheriffVotes[key] = targetId;
      updateControlPanel();
      return true;
    }

    function finalizeSheriffVote() {
      if (roomState.currentPhase !== 'SHERIFF_VOTING') return false;
      clearInterval(roomState.timerInterval);
      roomState.timerInterval = null;
      const counts = new Map();
      Object.values(roomState.sheriffVotes).forEach(target => {
        const id = Number(target);
        if (id > 0) counts.set(id, (counts.get(id) || 0) + 1);
      });
      const candidates = roomState.sheriffCandidates.filter(id => {
        const player = roomState.players.find(item => Number(item.id) === Number(id));
        return player && player.isAlive;
      });
      const highest = counts.size ? Math.max(...counts.values()) : 0;
      const leaders = [...counts.entries()].filter(([, count]) => count === highest).map(([id]) => id);
      if (!leaders.length || leaders.length === candidates.length || leaders.length > 1) {
        if (leaders.length > 1 && roomState.sheriffElectionRound === 1) {
          roomState.sheriffCandidates = leaders;
          roomState.sheriffElectionRound = 2;
          roomState.sheriffVotes = {};
          speakGod('警長競選平票，進入平票候選人的第二輪投票。');
          startSheriffVoting();
          return true;
        }
        finishSheriffElectionWithoutWinner('警長競選未能決出唯一當選者，本局無警長。');
        return true;
      }
      electSheriff(leaders[0]);
      return true;
    }

    function announceDayDeath() {
      renderGodFlowPanel();
      const deaths = Array.isArray(roomState.lastNightDeaths) ? roomState.lastNightDeaths : [];
      const text = formatNightDeathSummary(deaths);

      const sheriff = roomState.players.find(p => p.id === roomState.sheriffId);
      if (roomState.hasSheriffInGame && (!sheriff || !sheriff.isAlive)) {
        roomState.hasSheriffInGame = false;
        roomState.sheriffId = null;
        gameState.sheriffId = null;
      }

      renderTable();
      if (roomState.hasSheriffInGame) {
        if (!setCurrentPhase('DAY_DEATH')) return;
        updateBanner('【天亮死訊】', `天亮了！${text}`, '請警長指定白天發言方向');
        speakGod(`天亮了。${text} 請警長選擇發言順序。`, flushPendingDawnHistory);
        updateControlPanel();
      } else {
        if (!setCurrentPhase('DAY_DEATH')) return;
        const alivePlayers = roomState.players.filter(p => p.isAlive).map(p => p.id);
        if (!alivePlayers.length) { finishGame(checkWinCondition() || 'WEREWOLF_WIN'); return; }
        const randomStart = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        speakGod(`天亮了。${text} 本日由 ${randomStart} 號玩家開始發言。`, flushPendingDawnHistory);
        startNoSheriffSpeech(randomStart);
      }
    }

    function chooseSpeechDirection(dir) {
      updateBanner("【白天輪流發言】", `警長指定發言順序：【${dir}】`, "每人發言 60s，自動跳過出局玩家");
      speakGod(`警長指定發言順序為 ${dir}。`);
      
      let startId = 1;
      const lastDeathId = Array.isArray(roomState.lastNightDeaths) && roomState.lastNightDeaths.length
        ? Number(roomState.lastNightDeaths[roomState.lastNightDeaths.length - 1].id)
        : null;
      if (lastDeathId) {
        startId = dir.includes('左') ? (lastDeathId - 1 || roomState.playerCount) : (lastDeathId % roomState.playerCount + 1);
      } else {
        startId = dir.includes('左') ? (roomState.sheriffId - 1 || roomState.playerCount) : (roomState.sheriffId % roomState.playerCount + 1);
      }

      buildSpeechQueue(startId, dir.includes('右'));
      startNextSpeaker();
    }

    function startNoSheriffSpeech(startId) {
      updateBanner("【白天輪流發言】", `無警長模式：由 ${startId} 號玩家開始順時針發言`, "末位發言者進行歸票");
      buildSpeechQueue(startId, true);
      startNextSpeaker();
    }

    function buildSpeechQueue(startId, isClockwise) {
      roomState.speechQueue = AwooGameFlow.buildSpeechQueue(
        roomState.players, roomState.playerCount, startId, isClockwise
      );
      roomState.currentQueueIndex = -1;
    }

    function startNextSpeaker() {
      const next = AwooGameFlow.getNextSpeaker(roomState.speechQueue, roomState.currentQueueIndex);
      roomState.currentQueueIndex = next.index;
      if (next.done) {
        enterVotingPhase();
        return;
      }

      if (!setCurrentPhase('DAY_SPEECH')) return;
      roomState.activeSpeakerId = next.playerId;
      renderTable();
      startSpeechTimer();
      updateControlPanel();
    }

    function startSpeechTimer() {
      roomState.speechTimer = 60;
      clearInterval(roomState.timerInterval);
      updateBanner("【白天輪流發言】", `當前輪到 ${roomState.activeSpeakerId} 號玩家發言`, `發言時間剩餘：${roomState.speechTimer}s`);
      
      roomState.timerInterval = setInterval(() => {
        roomState.speechTimer--;
        updateBanner("【白天輪流發言】", `當前輪到 ${roomState.activeSpeakerId} 號玩家發言`, `發言時間剩餘：${roomState.speechTimer}s`);
        if (roomState.speechTimer <= 0) {
          endSpeech();
        }
      }, 1000);
    }

    function addSpeechTime() {
      roomState.speechTimer += 60;
      updateControlPanel();
    }

    function endSpeech() {
      clearInterval(roomState.timerInterval);
      startNextSpeaker();
    }

    function toggleSheriffSummary(checked) {
      document.getElementById('sheriffTargetBox').style.display = checked ? 'block' : 'none';
    }

    function enterVotingPhase() {
      if (!setCurrentPhase('VOTING')) return;
      roomState.votingTimer = 15;
      currentVoteTarget = null;
      roomState.userVotes = {};

      updateBanner("【公投處決階段】", "請所有人於 15 秒內選擇處決目標並點擊『確認投票』...", "未投票者自動判定為棄票");
      speakGod("發言結束，進入公投處決階段。請全體玩家於十五秒內選擇目標並點擊確認投票。");
      renderTable();
      updateControlPanel();

      clearInterval(roomState.timerInterval);
      roomState.timerInterval = setInterval(() => {
        roomState.votingTimer--;
        updateBanner("【公投處決階段】", "請所有人於 15 秒內選擇處決目標並點擊『確認投票』...", `公投倒數：${roomState.votingTimer}s`);
        if (roomState.votingTimer <= 0) {
          clearInterval(roomState.timerInterval);
          finalizePublicVote();
        }
      }, 1000);
    }

    function finalizePublicVote() {
      clearInterval(roomState.timerInterval);
      roomState.timerInterval = null;
      const voteResult = AwooGameEngine.resolveVotes(roomState.players, roomState.userVotes, {
        sheriffWeight: roomState.ruleset.sheriffWeight
      });

      if (voteResult.status === 'no-votes') {
        roomState.executedVictim = null;
        if (roomState.isTieRunoff) {
          roomState.isTieRunoff = false;
          roomState.runoffCandidates = [];
        }
        speakGod('公投結束，本輪無有效票，無人出局。準備進入下一夜。');
        updateBanner('【公投結束】', '本輪無有效票，無人出局。', '4 秒後進入下一夜');
        setTimeout(startNextNight, 4000);
        return;
      }

      if (voteResult.status === 'tie') {
        roomState.executedVictim = null;
        if (roomState.isTieRunoff) {
          roomState.isTieRunoff = false;
          roomState.runoffCandidates = [];
          speakGod('再次公投仍然平票，本輪無人出局。準備進入下一夜。');
          updateBanner('【再次公投平票】', '再次平票，本輪無人出局。', '4 秒後進入下一夜');
          setTimeout(startNextNight, 4000);
          return;
        }
        roomState.isTieRunoff = true;
        roomState.runoffCandidates = voteResult.leaders.map(Number);
        roomState.userVotes = {};
        roomState.speechQueue = roomState.runoffCandidates.slice();
        roomState.currentQueueIndex = -1;
        roomState.activeSpeakerId = null;
        const tiedSeats = roomState.runoffCandidates.map(id => `${id}號`).join('、');
        const announcement = `${tiedSeats}平票，請以上玩家再次發表，每人60秒。`;
        updateBanner('【公投平票】', announcement, '平票玩家依序各有 60 秒發言，結束後重新投票');
        speakGod(announcement);
        renderTable();
        updateControlPanel();
        startNextSpeaker();
        return;
      }

      roomState.isTieRunoff = false;
      roomState.runoffCandidates = [];
      const targetId = voteResult.targetId;
      const victim = roomState.players.find(p => p.id === targetId);
      if (!victim || !victim.isAlive) { setTimeout(startNextNight, 1000); return; }
      roomState.executedVictim = targetId;
      recordGameHistory({ phaseLabel: '白天出局', message: `${targetId}號` });
      victim.isAlive = false;
      victim.deathReason = 'EXECUTED_BY_VOTE';
      renderTable();
      speakGod(`${targetId}號出局，請發表遺言。`);
      if (startDeathSkillResolution([{ id: targetId, reason: 'EXECUTED_BY_VOTE' }], 'LAST_WORDS', targetId)) return;
      const winner = checkWinCondition();
      if (winner) {
        finishGame(winner, `${targetId} 號玩家已被處決。`);
        return;
      }
      if (startSheriffBadgeDecision('LAST_WORDS', targetId)) return;
      startLastWordsPhase(targetId);
    }

    function startDeathSkillResolution(deaths, returnPhase, executedVictimId = null) {
      const queue = (Array.isArray(deaths) ? deaths : []).map(death => {
        const player = roomState.players.find(item => Number(item.id) === Number(death.id));
        const skill = player ? AwooGameEngine.getDeathSkill(player, death.reason || player.deathReason) : null;
        return skill ? { playerId: Number(player.id), deathReason: death.reason || player.deathReason, skill } : null;
      }).filter(Boolean);
      if (!queue.length) return false;
      roomState.deathSkillQueue = queue;
      roomState.deathSkillReturnPhase = returnPhase;
      roomState.deathSkillExecutedVictim = executedVictimId == null ? null : Number(executedVictimId);
      roomState.deathSkillDeaths = [];
      if (!setCurrentPhase('DEATH_SKILL')) return false;
      clearInterval(roomState.timerInterval);
      roomState.timerInterval = null;
      const current = queue[0];
      updateBanner('【死亡技能】', `${current.playerId} 號 ${current.skill.role} 可以發動死亡技能。`, '請切換到該座位選擇目標。');
      speakGod(`${current.playerId} 號 ${current.skill.role} 發動死亡技能，請選擇目標。`);
      renderTable();
      updateControlPanel();
      return true;
    }

    function renderDeathSkillPanel(player, container) {
      const current = roomState.deathSkillQueue[0];
      if (!current) {
        container.innerHTML = '<p>死亡技能結算中……</p>';
        return;
      }
      if (Number(player.id) !== Number(current.playerId)) {
        container.innerHTML = `<p style="color:#aaa;">等待 ${current.playerId} 號 ${current.skill.role} 完成死亡技能。</p>`;
        return;
      }
      container.innerHTML = `
        <p style="color:var(--gold-primary);">${current.playerId} 號 ${current.skill.role}：選擇一名存活玩家發動技能。</p>
        ${renderPlayerTargetGrid({ onSelect: 'resolveCurrentDeathSkill', isAllowed: target => target.isAlive && Number(target.id) !== Number(player.id), showDead: true })}
        ${current.skill.type === 'hunter-shot' ? '<button type="button" class="btn-gothic" style="width:100%;margin-top:8px;" onclick="declineCurrentDeathSkill()">不開槍</button>' : ''}
      `;
    }

    function resolveCurrentDeathSkill(targetId) {
      if (roomState.currentPhase !== 'DEATH_SKILL') return false;
      const current = roomState.deathSkillQueue[0];
      if (!current) return false;
      if (Number(roomState.currentPerspective) !== Number(current.playerId)) {
        alert(`請先切換到 ${current.playerId} 號座位。`);
        return false;
      }
      const result = AwooGameEngine.resolveDeathSkill({
        players: roomState.players,
        actorId: current.playerId,
        targetId,
        deathReason: current.deathReason,
      });
      if (!result.valid) {
        alert(result.reason);
        return false;
      }
      return completeCurrentDeathSkill(result);
    }

    function declineCurrentDeathSkill() {
      if (roomState.currentPhase !== 'DEATH_SKILL') return false;
      const current = roomState.deathSkillQueue[0];
      if (!current || current.skill.type !== 'hunter-shot') return false;
      if (Number(roomState.currentPerspective) !== Number(current.playerId)) {
        alert(`請先切換到 ${current.playerId} 號座位。`);
        return false;
      }
      const player = roomState.players.find(item => Number(item.id) === Number(current.playerId));
      if (!player || player.isAlive || player.deathSkillUsed === true) return false;
      player.deathSkillUsed = true;
      return completeCurrentDeathSkill(null);
    }

    function completeCurrentDeathSkill(result) {
      const current = roomState.deathSkillQueue[0];
      if (!current) return false;
      roomState.deathSkillQueue.shift();
      if (result && result.death) {
        roomState.deathSkillDeaths.push(result.death);
        if (roomState.deathSkillReturnPhase === 'DAY_DEATH') {
          roomState.lastNightDeaths.push(result.death);
        }
        const chainedSkill = AwooGameEngine.getDeathSkill(result.target, result.death.reason);
        if (chainedSkill) {
          roomState.deathSkillQueue.push({
            playerId: Number(result.target.id),
            deathReason: result.death.reason,
            skill: chainedSkill,
          });
        }
      }
      renderTable();
      if (roomState.deathSkillQueue.length) {
        const next = roomState.deathSkillQueue[0];
        updateBanner('【死亡技能】', `${next.playerId} 號 ${next.skill.role} 可以發動死亡技能。`, '請切換到該座位選擇目標。');
        speakGod(`${next.playerId} 號 ${next.skill.role} 發動死亡技能，請選擇目標。`);
        updateControlPanel();
        return true;
      }
      const returnPhase = roomState.deathSkillReturnPhase;
      const executedVictimId = roomState.deathSkillExecutedVictim;
      roomState.deathSkillReturnPhase = null;
      roomState.deathSkillExecutedVictim = null;
      roomState.deathSkillQueue = [];
      const winner = checkWinCondition();
      if (winner) {
        const deaths = returnPhase === 'DAY_DEATH'
          ? roomState.lastNightDeaths
          : roomState.deathSkillDeaths;
        const summary = deaths.length ? `出局玩家：${deaths.map(item => `${item.id} 號`).join('、')}。` : '';
        finishGame(winner, summary);
        return true;
      }
      if (startSheriffBadgeDecision(returnPhase, executedVictimId)) return true;
      if (returnPhase === 'WHITE_WOLF_KING_SELF_DESTRUCT') {
        startNextNight({
          announcement: '白狼王自爆並帶走一名玩家，白天流程立即中止。',
          voiceMessage: '白狼王自爆，並帶走一名玩家。天黑請閉眼。',
        });
      } else if (returnPhase === 'LAST_WORDS') {
        startLastWordsPhase(executedVictimId);
      } else {
        if (roomState.sheriffMode === 'enabled' && gameState.currentDay === 1 && !roomState.hasSheriffInGame) {
          if (!setCurrentPhase('SHERIFF_ELECTION')) return false;
          startSheriffCountdown();
        } else {
          announceDayDeath();
        }
      }
      return true;
    }

    function startSheriffBadgeDecision(returnPhase, executedVictimId = null) {
      const sheriff = roomState.players.find(player => Number(player.id) === Number(roomState.sheriffId));
      if (!sheriff || sheriff.isAlive || !sheriff.isSheriff) return false;
      roomState.sheriffBadgeReturnPhase = returnPhase;
      roomState.sheriffBadgeExecutedVictim = executedVictimId == null ? null : Number(executedVictimId);
      if (!setCurrentPhase('SHERIFF_BADGE')) return false;
      clearInterval(roomState.timerInterval);
      roomState.timerInterval = null;
      updateBanner('【警徽處理】', `${sheriff.id} 號警長已出局，請選擇移交警徽或銷毀警徽。`, '請切換到已出局的警長座位進行選擇。');
      speakGod(`${sheriff.id} 號警長出局，請選擇移交警徽或銷毀警徽。`);
      updateControlPanel();
      return true;
    }

    function renderSheriffBadgePanel(player, container) {
      const sheriff = roomState.players.find(item => Number(item.id) === Number(roomState.sheriffId));
      if (!sheriff || sheriff.isAlive || !sheriff.isSheriff) {
        container.innerHTML = '<p>警徽狀態已更新。</p>';
        return;
      }
      if (Number(player.id) !== Number(sheriff.id)) {
        container.innerHTML = `<p style="color:#aaa;">等待 ${sheriff.id} 號已出局警長處理警徽。</p>`;
        return;
      }
      const targets = roomState.players.filter(item => item.isAlive && Number(item.id) !== Number(sheriff.id));
      container.innerHTML = `
        <p style="color:var(--gold-primary);">你已出局，請選擇警徽處理方式。</p>
        <div class="target-grid">${targets.map(target => `<button class="target-btn" onclick="resolveSheriffBadge('transfer', ${target.id})">移交給 ${target.id} 號</button>`).join('')}</div>
        <button class="btn-gothic btn-crimson" style="width:100%;margin-top:8px;" onclick="resolveSheriffBadge('destroy')">銷毀警徽</button>
      `;
    }

    function resolveSheriffBadge(action, targetId = null) {
      if (roomState.currentPhase !== 'SHERIFF_BADGE') return false;
      const sheriff = roomState.players.find(player => Number(player.id) === Number(roomState.sheriffId));
      if (!sheriff || sheriff.isAlive || Number(roomState.currentPerspective) !== Number(sheriff.id)) {
        alert('請切換到已出局的警長座位處理警徽。');
        return false;
      }
      let successor = null;
      if (action === 'transfer') {
        successor = roomState.players.find(player => Number(player.id) === Number(targetId) && player.isAlive);
        if (!successor || Number(successor.id) === Number(sheriff.id)) {
          alert('請選擇一名仍存活的警徽接收者。');
          return false;
        }
      } else if (action !== 'destroy') {
        return false;
      }
      sheriff.isSheriff = false;
      if (successor) {
        successor.isSheriff = true;
        roomState.sheriffId = Number(successor.id);
        gameState.sheriffId = Number(successor.id);
        roomState.hasSheriffInGame = true;
      } else {
        roomState.sheriffId = null;
        gameState.sheriffId = null;
        roomState.hasSheriffInGame = false;
      }
      const returnPhase = roomState.sheriffBadgeReturnPhase;
      const executedVictimId = roomState.sheriffBadgeExecutedVictim;
      roomState.sheriffBadgeReturnPhase = null;
      roomState.sheriffBadgeExecutedVictim = null;
      speakGod(successor ? `警徽已移交給 ${successor.id} 號玩家。` : '警徽已銷毀，本局不再有警長。');
      renderTable();
      if (returnPhase === 'LAST_WORDS') {
        startLastWordsPhase(executedVictimId);
      } else if (returnPhase === 'WHITE_WOLF_KING_SELF_DESTRUCT') {
        startNextNight({
          announcement: '白狼王自爆並帶走一名玩家，白天流程立即中止。',
          voiceMessage: '白狼王自爆，並帶走一名玩家。天黑請閉眼。',
        });
      } else {
        announceDayDeath();
      }
      return true;
    }

    function startLastWordsPhase(victimId) {
      if (!setCurrentPhase('LAST_WORDS')) return;
      roomState.activeSpeakerId = victimId;
      roomState.speechTimer = 60;
      renderTable();
      updateControlPanel();

      updateBanner("【發表遺言階段】", `由處決出局的 ${victimId} 號玩家發表遺言`, `遺言剩餘時間：${roomState.speechTimer}s`);

      clearInterval(roomState.timerInterval);
      roomState.timerInterval = setInterval(() => {
        roomState.speechTimer--;
        updateBanner("【發表遺言階段】", `由處決出局的 ${victimId} 號玩家發表遺言`, `遺言剩餘時間：${roomState.speechTimer}s`);
        if (roomState.speechTimer <= 0) {
          endLastWords();
        }
      }, 1000);
    }

    function endLastWords() {
      clearInterval(roomState.timerInterval);
      roomState.timerInterval = null;
      const winner = checkWinCondition();
      if (winner) { finishGame(winner); return; }
      speakGod('遺言發表結束，天黑請閉眼。');
      updateBanner('【夜間準備】', '遺言結束，進入下一夜...', '準備中...');
      setTimeout(startNextNight, 3000);
    }

    function updateBanner(line1, line2, line3) {
      AwooUI.setBanner(line1, line2, line3);
    }

    function scrollToGameTable() {
      const table = document.getElementById('seatTable');
      if (!table) return;
      table.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function toggleFloatingPanel() {
      const panel = document.getElementById('floatingPanel');
      panel.classList.toggle('collapsed');
      const expanded = !panel.classList.contains('collapsed');
      const header = panel.querySelector('.panel-header');
      if (header) header.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      document.getElementById('panelToggleIcon').innerText = expanded ? '⌄' : '⌃';
    }

    function toggleSheriffCheckbox(checkbox) {
      const selected = document.getElementById('setupPlayerCount')?.value;
      const count = selected === 'custom'
        ? (parseInt(document.getElementById('customTotalCount')?.value, 10) || 12)
        : (parseInt(selected, 10) || 12);
      checkSheriffEligibility(count);
      if (count >= 12 && checkbox) checkbox.checked = !!checkbox.checked;
    }

    function openSettings() {
      // Settings controls have not yet been separated from the media/device panel.
      // Open the existing panel instead of leaving a dead button in the UI.
      openMediaModal();
    }

    function openMediaModal() { AwooUI.setDisplay('mediaModal', true); }
    function openCompendium() { AwooCompendium.open(); AwooUI.setDisplay('compendiumModal', true); }
    function closeModal(id) { AwooUI.setDisplay(id, false); }

    function setBgmVolume(val) {
      const bgm = document.getElementById('googleDriveBgm');
      if (bgm) {
        bgm.volume = val / 100;
      }
    }

    async function toggleSelfMic() {
      const p = roomState.players.find(x => x.id === roomState.currentPerspective);
      if (!p) return;

      if (!p.micOn) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: p.camOn });
          p.micOn = true;
          p.stream = stream;
        } catch (e) { alert("無法取得麥克風授權！"); return; }
      } else {
        if (p.stream) p.stream.getAudioTracks().forEach(t => t.stop());
        p.micOn = false;
      }
      document.getElementById('micToggleBtn').innerText = p.micOn ? '麥克風: 開' : '麥克風: 關';
      renderTable();
    }

    async function toggleSelfCam() {
      const p = roomState.players.find(x => x.id === roomState.currentPerspective);
      if (!p) return;
      
      if (!p.camOn) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: p.micOn });
          p.camOn = true;
          p.stream = stream;
        } catch (e) { alert("無法取得攝影機授權！"); return; }
      } else {
        if (p.stream) p.stream.getVideoTracks().forEach(t => t.stop());
        p.camOn = false;
      }
      document.getElementById('camToggleBtn').innerText = p.camOn ? '鏡頭: 開' : '鏡頭: 關';
      renderTable();
    }
