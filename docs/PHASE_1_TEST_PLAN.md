# Phase 1 — 首夜警長與天亮流程測試追蹤矩陣

**基準分支：** `main`  
**基準 commit：** `082523dc3fa4c1761585c5319b9618171ba4bbd0`  
**產品版本：** `0.9.4-alpha.1`  
**狀態：** 測試設計與現況映射；尚未代表任何 SFE 案例已通過端到端驗收。

## 1. 目的與執行原則

本文件將架構規格 §10.2 的 SFE-01 至 SFE-16 對應到目前實際函式、狀態欄位及測試檔案，作為 Phase 1 建立測試防線的工作清單。

執行原則：

1. 先保護已確認的玩家可觀察行為，再修改 runtime。
2. 測試應呼叫實際公開函式／流程入口，檢查狀態與事件順序；不得只靠比對原始碼字串宣稱流程正確。
3. 每個案例都要標記測試層級：Unit、Module Integration、Flow Integration、UI/Browser。
4. 現有測試即使通過，也不能將未覆蓋的整合流程標記為通過。
5. 測試先建立；預期失敗的案例在修正前可保持 Red，但不得把 Red 描述為 CI 通過。
6. 本階段不建立空殼模組，不為了讓測試可跑而複製一套新的遊戲規則。

## 2. SFE-01 至 SFE-16 對照表

| ID | 驗收情境 | 目前主要程式入口／狀態 | 現有測試證據 | 缺口與 Phase 1 測試目標 |
|---|---|---|---|---|
| SFE-01 | 夜間必要行動未完成，不得開始警長競選 | `advanceModeratorLine()`、`resolveNightNow()`；`moderatorStepIndex`、`moderatorSpeechDone`、各角色 action decision 欄位 | `tests/moderator-action-gating.test.cjs`、`tests/autonomous-moderator.test.cjs` 有行動鎖定測試 | 尚無「夜間行動閘門 → 警長競選入口」流程整合測試；新增行動未完成時不能進入 `SHERIFF_ELECTION` 的流程測試 |
| SFE-02 | 所有夜間行動完成後，先進入警長競選 | `resolveNightNow()`、`startSheriffCountdown()`；`currentPhase`、`lastNightDeaths` | `tests/app-smoke.test.cjs` 以原始碼片段檢查 `resolveNightNow()` | 改為執行函式並記錄階段／主持事件；斷言先進入競選且先播「天將破曉」 |
| SFE-03 | 待公布死亡者仍可上警 | `candidateSheriff()`；玩家生命狀態、競選階段 | 無直接行為測試 | 建立待公布死亡狀態後呼叫真實競選命令，斷言成功；不得用暫時復活 `isAlive` 達成 |
| SFE-04 | 待公布死亡者可成為候選人並參與候選人發言 | `processSheriffCandidates()`、`electSheriff()`；`sheriffCandidates`、候選發言隊列 | 無警長競選整合測試 | 驗證候選名單保留待公布死亡者，且候選發言隊列包含該玩家；候選發言目前尚未實作 |
| SFE-05 | 待公布死亡者可退水 | `candidateSheriff()`；`sheriffCandidates` | 無直接行為測試 | 驗證加入與退出均成功，候選名單更新且不提前公開死亡 |
| SFE-06 | 待公布死亡者在警下且符合一般資格時可投票 | `voteSheriff()`、`renderSheriffVotingPanel()`；`currentPerspective`、`sheriffVotes` | 無警長投票行為整合測試 | 分離候選資格與投票資格；驗證待公布死亡本身不構成拒絕原因，候選人仍受一般警下投票限制 |
| SFE-07 | 多名候選人逐位發言 | `processSheriffCandidates()`、`startSheriffVoting()`；候選名單、發言隊列、計時器 | 無候選發言測試 | 新增候選發言階段及順序測試；目前多候選人直接進入警長投票，口白卻稱候選人發言已結束 |
| SFE-08 | 競選未完成前不得天亮或公布死亡 | `startSheriffVoting()`、`finalizeSheriffVote()`、`announceDayDeath()`；`currentPhase`、`pendingDawnHistory` | `tests/app-smoke.test.cjs` 僅做靜態檢查 | 以實際流程斷言候選發言、退水、投票及平票未結束前，不會進入天亮公告或公開死訊 |
| SFE-09 | 競選完成後才播「天亮請睜眼」並公布昨夜死亡 | `electSheriff()`、`finishSheriffElectionWithoutWinner()`、`announceDayDeath()`；主持腳本與階段 | `tests/moderator-script.test.cjs` 只驗證夜間腳本口白；無跨階段測試 | 收集實際主持／階段事件，斷言「天將破曉 → 競選完成 → 天亮請睜眼 → 公布死亡」 |
| SFE-10 | 死訊公開前不得顯示出局、死因或公開紀錄；不得改回存活 | `resolveNightNow()`、`renderTable()`、`updateControlPanel()`、`announceDayDeath()`；目前使用 `firstNightDeathsHiddenUntilDawn` | `tests/app-smoke.test.cjs` 目前反而斷言暫時恢復 `isAlive` | 移除會保護錯誤設計的靜態斷言；新增狀態與 UI 可見性行為測試，確認 `PENDING_DEATH` 不等於 `ALIVE` 或公開 `DEAD` |
| SFE-11 | 待公布死亡者仍可當選警長，公告前保留警長身分 | `electSheriff()`；`sheriffId`、`hasSheriffInGame`、`isSheriff` | 無直接行為測試 | 驗證待公布死亡者當選後，警長識別與選舉結果保留至天亮公告 |
| SFE-12 | 當選警長於天亮被公告死亡後，依規則處理遺言及警徽 | `announceDayDeath()`、`startDeathSkillResolution()`、`continueDayAfterDawn()`、`startSheriffBadgeDecision()` | `tests/game-flow.test.cjs` 只有階段轉換測試；引擎測試不涵蓋警徽整合 | 新增端到端交接測試，檢查公告、適用遺言、警徽移交／銷毀與返回流程；優先順序依已確認房規固定 |
| SFE-13 | 無候選人或全部退水，競選結束為無警長並繼續天亮 | `processSheriffCandidates()`、`finishSheriffElectionWithoutWinner()` | 無直接流程測試 | 驗證無候選人及全部退水兩條路徑都只完成一次競選，且天亮可繼續 |
| SFE-14 | 首輪警長票平票，進入限定候選人的重投 | `finalizeSheriffVote()`、`startSheriffVoting()`；`sheriffElectionRound` | 無警長投票流程測試 | 驗證首輪平票後候選名單縮小為平票者、投票紀錄清空、輪次更新且不提前天亮 |
| SFE-15 | 重投後仍平票或無有效票，結束為無警長 | `finalizeSheriffVote()`、`finishSheriffElectionWithoutWinner()` | 無警長投票流程測試 | 驗證第二輪無唯一勝者時回傳無警長並只觸發一次天亮後續 |
| SFE-16 | 夜間基本死亡公告後才觸發死亡技能與連鎖 | `announceDayDeath()`、`startDeathSkillResolution()`、`resolveDeathSkillAction()`、`finishAfterDawnDeathSkillChain()`；`deathSkillQueue`、`deathSkillDeaths` | `tests/game-engine.test.cjs` 有死亡技能單元測試；`tests/self-destruct-flow.test.cjs` 涵蓋白天自爆，不是首夜整合 | 新增流程整合測試，斷言警長競選與基本死訊公告完成前不觸發死亡技能；技能隊列清空後才進入白天／勝負判定 |

## 3. 現況結論

### 已有的可重用測試基礎

- `tests/moderator-action-gating.test.cjs`：可重用主持口白與角色行動閘門的 VM 測試環境。
- `tests/autonomous-moderator.test.cjs`：可重用正式模式自動推進、語音回呼與計時器測試方式。
- `tests/test-mode.test.cjs`：可重用瀏覽器腳本載入、測試視角與控制面板測試環境。
- `tests/game-engine.test.cjs`：可重用夜間結算、死亡技能資格及勝負規則的純引擎測試。
- `tests/game-flow.test.cjs`：可重用階段合法轉換及發言順序測試。

### 必須修正的測試反模式

`tests/app-smoke.test.cjs` 的「first-night Sheriff election hides the result until dawn」案例以正規表示式檢查 `resolveNightNow()`、`announceDayDeath()` 及 `renderTable()` 的原始碼，並要求 `firstNightDeathsHiddenUntilDawn` 期間將玩家 `isAlive` 設回 `true`。這只證明特定字串存在，不證明競選資格、資訊可見性或遊戲狀態正確；且與架構規格 §4.2 的生命狀態要求衝突。

Phase 1 應以可執行行為測試取代這個斷言，不可只刪除舊測試而不補上行為覆蓋。

### 已新增的跨階段整合覆蓋

```text
Night Actions Completed
  → Pre-dawn Sheriff Election
  → Candidate Registration / Candidate Speech / Withdrawal
  → Single Candidate Election
  → Dawn Announcement
  → Reveal Pending Night Death
  → Sheriff Badge Transfer
  → Resume Daytime
```

`SFE-17` 已以單一整合測試串接以上路徑，並驗證待公布死亡者當選警長後，天亮才轉為公開出局、進入警徽處理、移交後回到白天流程，且不重複公告死訊。

此整合案例不等同完整覆蓋所有死亡技能連鎖、平票重投及瀏覽器語音／計時器；這些仍須分別以整合案例與實際瀏覽器驗收補齊。

## 4. 執行紀錄

| 項目 | 狀態 |
|---|---|
| 讀取 main 原始碼與現有測試 | 已完成 |
| SFE-01 至 SFE-17 對照目前函式／狀態／測試 | 已完成 |
| 行為回歸測試 | 已新增 SFE-01～17，另加 SFE-07b（單一候選人發言及退水）、SFE-07c（發言倒數自動推進） |
| Runtime 修正 | 已完成本階段首輪修正：待公布死亡狀態、警長參與資格、候選發言／退水、天亮閘門與警徽交接 |
| 本機測試 | 未執行；本工作階段無法取得本機 checkout，因此以 GitHub Actions 作為執行環境 |
| GitHub Actions `npm run check` | **通過：134 tests、134 pass、0 fail**（run #198，commit `ef941fee3cbebcad339512d0fb51a06c8626c1fc`） |
| 本機手動瀏覽器驗收 | 尚未執行；CI 不等同瀏覽器／多人視角驗收 |
| 模組抽取 | 尚未開始；目前仍在 `app.js` 既有流程中修正，避免先搬動未穩定邏輯 |

## 5. 本階段 Runtime 變更摘要

- `Player.lifeState` 增加 `ALIVE`、`PENDING_DEATH`、`DEAD`；首夜警長競選期間，待公布死亡者保持 `isAlive=false`，不再暫時復活。
- `AwooGameEngine.resolveNight()` 支援 `deferDeath`；首夜死亡可標記為待公布，其他夜晚仍直接標記為公開出局。
- `roomState.pendingNightDeaths` 保存待公布死亡的玩家、原因、來源、夜次及公告狀態。
- 警長候選資格與警長投票資格分開判斷；候選人不得投警長票，警下待公布死亡者仍可投票。
- 警長流程新增 `SHERIFF_CANDIDATE_SPEECH` 與 `SHERIFF_WITHDRAWAL`；候選人逐位發言後才進入退水，再進入投票或直接當選／無警長。
- `announceDayDeath()` 加入首夜競選完成閘門；競選完成後依序播放「天亮請睜眼」及死訊。
- `DAY_DEATH → SHERIFF_BADGE` 與警徽處理後返回 `DAY_DEATH` 的階段轉換已補齊，避免警徽處理後重複播報死訊。

**重要：** 134 項 CI 測試通過代表語法檢查與自動化測試通過，不代表已完成實際瀏覽器、語音、倒數計時或多視角手動驗收。產品版本仍為 `0.9.4-alpha.1`；本 PR 未修改產品版本。
