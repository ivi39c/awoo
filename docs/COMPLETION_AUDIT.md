# Awoo 狼人殺：階段完成度與測試盤點

歷史基準：Step 7 專案（當時 138 筆角色 metadata），當時 `npm run check` 為 43/43 Node.js 測試通過。Step 9 已再加入角色及上帝口白／女巫毒藥整合測試；目前角色資料 140 筆，最新測試總結見本文最後的「Step 9 補充」。

## 五大階段狀態

狀態定義：
- **已完成（模組層）**：核心能力已寫入模組並有自動化測試；不等同整個遊戲已通過端到端驗收。
- **部分完成**：已建基礎，但仍缺少整合、規則分支或驗收。
- **未完成**：尚未具備可用的完整實作。

| 階段 | 狀態 | 已完成／有測試的部分 | 未完成或未驗收部分 |
|---|---|---|---|
| 1. 核心回合與結算 | 部分完成 | 發牌洗牌、角色池驗證、基礎夜晚結算、守衛／解藥互動、女巫毒藥結算、投票平票／棄票／警長權重、勝負判定、自爆、階段轉換及發言順序有 Node.js 單元測試。 | `app.js` 仍持有大量階段、計時器與狀態編排。尚未完成真實瀏覽器從建局到多日終局的端到端測試。警長競選現已包含候選人退出、正式投票與一次平票重投；仍需瀏覽器驗收。獵人／狼王死亡技能已加入基礎觸發與目標選擇流程；白狼王與其他角色死亡連鎖仍未完成。 |
| 2. 統一角色系統 | 部分完成 | 138 個角色的基本資料、別名、分類、技能摘要、關係、版本差異集中於 `role-database.js`；別名、欄位、陣營及關係引用有測試。 | 角色 metadata 不是可自動執行的技能規格。實際引擎只涵蓋少數通用操作：小狼夜刀／自爆、預言家查驗、女巫藥劑目標、守衛守護、投票與基礎勝負判定等。`獵人`與`狼王`的基礎死亡觸發技能已接入；`白狼王`、狼美人、騎士、白痴及多數第三方技能仍未完成。需持續擴充結構化技能註冊／觸發系統。 |
| 3. 程式模組拆分 | 部分完成 | 已有 `role-database.js`、`ruleset.js`、`game-engine.js`、`game-flow.js`、`compendium.js`、`ui.js`、`app.js` 等模組，核心引擎不直接依賴 DOM。 | `app.js` 仍約 1,450 行，包含建房／加入原型、回合編排、計時器、警長、投票、媒體和多個 UI handler；不少介面仍用 inline `onclick` 及字串 `innerHTML`。狀態型別、事件／副作用邊界及錯誤回復仍需整理。Step 8 只先更新 UI 樣式與導覽，並未宣稱完成架構拆分。 |
| 4. 真正多人房間 | 未完成 | 只有本機房間畫面、房號展示、Bot 座位與測試模式。 | `confirmJoinRoom()` 未驗證實際房間或建立網路連線；每個瀏覽器各自建立本機狀態。尚無後端、WebSocket／其他訊令通道、房主權限、伺服器權威狀態、資料持久化、重新連線、玩家離線處理或作弊防護。 |
| 5. 多人視訊與音訊 | 未完成 | 本機麥克風／攝影機可透過 `getUserMedia()` 請求權限；本地 `MediaStream` 可以放進本機座位畫面。 | 沒有 `RTCPeerConnection`、SDP／ICE 訊令交換、遠端 stream、房間音訊路由或斷線恢復。主音量滑桿及麥克風音量滑桿目前未完整連接實際音訊處理。需要分瀏覽器、裝置與權限狀態測試。 |

## 測試覆蓋狀況

### 已自動化（Node.js）

- 角色資料 schema、名稱與 alias 唯一性、關係引用。
- 洗牌與牌池數量檢查。
- 基礎夜間行動驗證與結算。
- 守衛／女巫解藥互動、女巫毒藥、狼人夜刀。
- 公投票數、棄票、平票、警長權重及非法投票。
- 小狼自爆房規與白天流程中斷。
- 合法階段轉換、發言隊列。
- 圖鑑搜尋／分類／角色引用。
- 測試模式啟動、視角限制、角色覆蓋及巡檢計數。
- UI helper、HTML 腳本載入順序。
- Step 8 新增的 mobile UI 結構與 CSS 靜態斷言。

### 尚未完成的驗收

- 真實瀏覽器端到端自動化（目前沒有可靠的 Playwright／WebDriver 測試套件）。
- 手機 Safari／Chrome、桌面 Chrome／Firefox 的畫面與流程交叉測試。
- 不同螢幕寬度、橫向模式、軟鍵盤、safe area、無障礙與動態字體測試。
- 麥克風／鏡頭允許、拒絕、撤銷權限及裝置拔除測試。
- 多人同時進入房間、斷線重連、同時投票、惡意／重複提交及房主離線測試。
- 全角色技能真實效果與技能互動的整合測試。

## Step 8 UI 改版範圍

本階段採手機優先 CSS：

- 手機 2 欄座位卡，較寬手機 3 欄，平板／桌面逐步增加欄數。
- 固定底部主要導覽（座位、圖鑑、觀眾、影音）。
- 玩家控制台改為底部操作抽屜，加入收合按鈕的 `aria-expanded` 狀態。
- 手機 modal 改底部 sheet，桌面恢復置中對話框。
- 最小點擊目標以 44px 為設計基準，加入 safe-area 與 reduced-motion 支援。
- 保留現有 ID 與核心函式，降低 UI 刷新對遊戲流程的回歸風險。

這階段的新增 CSS 測試是靜態斷言，不代表所有 viewport 都已完成實機／瀏覽器視覺驗收。發佈前仍應依 `docs/MOBILE_UI_GUIDE.md` 手動驗收。

## 建議下一步

1. 先由使用者用新手機介面手動跑完整測試流程，整理實際 Bug。
2. 把 `app.js` 拆成 lobby/room controller、phase controller、actions controller、media controller。
3. 建立結構化技能系統，先實作獵人、狼王、白狼王，再逐批實作其他角色。
4. 決定伺服器技術與權威狀態模型，實作房間與斷線重連。
5. 在多人狀態穩定後，加入 WebRTC 視訊音訊。


## Step 9 補充：女巫毒藥與上帝流程

- 角色資料庫已擴充為 140 筆（包含新增的混血兒、吹笛者）。
- 女巫毒藥新增端到端流程測試：所有座位可見、已出局座位為灰色且不可選、確認目標後保存到夜間狀態、結算後更新死亡原因和實際死亡清單。
- 修正夜間死亡直接達成勝利條件時，跳過死訊公告的流程；終局公告現在附帶本夜死亡名單。
- 新增 `moderator-script.js`，按本局角色組合／夜數建構口白；目前有專屬模板與通用佔位模板之分，佔位流程不代表技能已實作。
- 執行 `npm run check`：55/55 Node.js 測試通過，JavaScript 語法檢查通過。
- 仍未完成：完整真實瀏覽器／手機端到端測試、多人後端同步、遠端影音，以及大部分角色的專屬技能引擎。


## Step 10 implementation note — 2026-10-25

- Removed the alternate Awoo-custom night order. Standard order is fixed to Guard → wolves → Witch → Seer.
- Sheriff election now supports candidate withdrawal, multi-candidate voting, and one runoff for tied leaders. A second tie/no valid votes results in no sheriff.
- Hunter/Wolf King base death-trigger skills are integrated in a dedicated `DEATH_SKILL` phase. Hunter shot is disabled by poison; Wolf King shot triggers on public execution.
- Current GitHub Actions validation passed after the death-skill phase transition correction. Browser and mobile acceptance are still pending.
- Remaining: sheriff badge transfer/destruction, White Wolf King skill, broader role trigger chains, complete win-condition acceptance, and real multiplayer/WebRTC.


## Step 10 update — 2026-10-25

- Fixed the only night order to Guard → wolves → Witch → Seer; alternate Awoo-custom order removed.
- Sheriff election now supports candidate withdrawal, multi-candidate voting, and one runoff for tied leaders. A second tie or no valid votes results in no sheriff.
- Sheriff death now opens a badge decision: transfer to a living player or destroy the badge.
- Hunter and Wolf King base death-trigger skills are integrated in a dedicated `DEATH_SKILL` phase. Hunter shot is disabled by poison; Wolf King shot triggers on public execution. Death skills resolve before win checks/day announcements/last words.
- GitHub Actions syntax checks and unit tests passed on PRs #5–#8. Browser and mobile acceptance remain pending.
- Remaining: White Wolf King skill, broader role trigger chains, complete win-condition scenario acceptance, mobile settings/media placement, and real multiplayer/WebRTC.
