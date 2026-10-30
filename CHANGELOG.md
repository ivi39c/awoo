## 0.9.4-alpha.1 — 2026-10-30

- [修復] 首夜警長競選期間暫緩公開夜間死亡狀態；結束競選後才公布昨夜出局名單。
- [修復] 將狼人襲擊、女巫毒藥與夜間獵人開槍的出局座號合併進天亮公告，避免夜間技能目標提前被視為死亡而影響其他夜間行動。
- [修復] 夜間獵人開槍改為夜間統一結算時套用死亡，避免目標被提前標記出局，並保留死因判定。
- [修復] 狼王被獵人開槍帶走時，會在天亮公布出局後進入狼王死亡技能流程；原有被投票處決的技能流程維持不變。
- [介面] 大廳首頁底部顯示目前測試版號；`package.json` 與首頁版本同步。
- [測試] 新增回歸檢查，涵蓋首夜警長競選的死亡資訊遮蔽、夜間獵人擊殺併入天亮清單與版本號同步。

## 2026-10-25 — Role-target grid and history acceptance coverage

- Corrected an extra closing `</div>` in the Seer panel markup so the result element is nested cleanly after the shared target grid.
- Added automated checks that Wolf teammates are listed with eliminated status, Seer self-selection and dead targets are disabled, Guard's previous-night target is disabled, and another valid living target remains selectable.
- Added interaction checks for the global history's collapsed default and expand/collapse behavior, plus a static layout check confirming it sits directly under God narration and begins as a one-line summary.
- Updated the current README test baseline.
- GitHub Actions `Awoo checks` passed on commit `3316bca021c873fb68e865c6910c4100c861e045`: syntax checks passed; **104/104 automated tests passed**. Browser/mobile acceptance remains pending.

## 2026-10-25 — Night target privacy and narration regression coverage

- Removed the wolf-kill target number from the generic action alert; the number remains in the wolf's private panel/history and is shown to the Witch only after the antidote prompt has finished.
- Removed the Witch poison target number from the global test-mode banner and kept private Witch target details in the Witch panel/day summary and private action history.
- Changed the antidote and Guard confirmation alerts to avoid placing their private target numbers in generic pop-up notifications.
- Added regression tests for target privacy, the Witch prompt visibility gate, Witch narration after both potions are spent, the test-mode speech-skip button's phase visibility, and the rule that skipping speech cannot bypass a pending role action.
- Asserted that the Hunter wake / hand-signal / close-eyes sequence is narration-only and does not create an actionable night-skill step.
- GitHub Actions `Awoo checks` passed on commit `7b75b3a9fbc1bbace5405567b48328c21bf03253`: syntax checks passed; **100/100 automated tests passed**. Browser/mobile acceptance is still outstanding.

# Changelog

## 2026-10-25 — Requirement audit and Witch potion rule

- Added `docs/PROJECT_HANDOFF.md` and `docs/REQUIREMENTS_TRACEABILITY.md` to preserve project continuity and map requirements to source/test evidence.
- Enforced the user-defined Witch rule in the engine: on night one, antidote and poison cannot both be used; from night two onward, both may be used if available.
- Passed current night and potion-used state from the app to the engine validator; added regression cases for both action orders across night one and night two.
- Automated tests have **not** been run after these changes; verify with `npm run check` before treating this change as test-passing.


## Step 8 — 手機優先 UI 與完成度盤點

- 以手機使用情境重整整體視覺：提高觸控區、座位卡兩欄佈局、固定底部導覽與底部操作抽屜。
- 手機 modal 改為 bottom sheet；平板與桌面在較寬斷點恢復置中對話框與多欄座位表。
- 加入安全區（safe-area）、鍵盤焦點樣式、較少動態效果偏好與語意化導覽。
- 新增 `docs/COMPLETION_AUDIT.md`，逐項區分五階段的已完成、部分完成、尚未實作及未驗收事項。
- 新增 `docs/MOBILE_UI_GUIDE.md` 與 mobile UI 結構靜態測試。
- 保留現有遊戲規則模組、測試模式和角色圖鑑；本階段沒有宣稱多人連線、遠端視訊或所有角色技能已完成。

## Step 7 — 測試模式與角色控制台巡檢

- 新增本機 Bot 測試模式、角色覆蓋、視角切換與角色巡檢計數。
- 新增測試模式快捷操作與測試文件。
- 原有 43 項 Node.js 自動化測試通過；Step 8 新增 4 項 mobile UI 靜態斷言測試。

## Step 9 — 女巫毒藥端到端驗證與角色式上帝口白

- 女巫毒藥改為座位按鈕選擇：顯示所有玩家號碼、對已出局座位反灰並 disabled；支援選擇、確認和取消，只有確認才消耗毒藥。
- 新增整合測試：從開啟選擇器、選取 1 號、確認使用，直到 `resolveNightNow()` 結算，驗證 1 號被標記死亡且列入實際死亡清單。
- 修正夜間死亡立即觸發勝負時，流程先結束遊戲、漏掉夜間出局名單公告的問題；現在遊戲結束公告也會包含本夜實際出局者或平安夜資訊。
- 新增依照本局角色組合及夜數產生的上帝口白模組；預設順序依 Awoo 的要求為狼人 → 女巫 → 預言家 → 守衛，另提供 `classic` 替代順序。
- 為多種首夜角色與擴充角色加入專屬或版本提示口白；沒有專屬流程的夜間角色會使用明確標示的佔位口白，不會冒充已完成技能。
- 隱私提示：女巫狼刀座號與預言家查驗資訊不得由公開語音洩漏。
- 新增 `docs/MODERATOR_SCRIPT.md`，記錄流程順序、隱私原則、房規差異及參考資料。
- `npm run check`：55/55 Node.js 自動化測試通過，所有 JavaScript 模組語法檢查通過。


## Step 9.1 — 手機上方工具列去重

- 手機寬度（760px 以下）隱藏上方重複的觀眾席、影音、圖鑑按鈕，因為這些功能已在底部導覽列提供。
- 保留測試模式視角切換與設定入口；桌面版上方工具列維持完整。
- 手機 top-actions 改為依內容排版，避免只剩少量按鈕時仍占滿整行；限制視角選單寬度，降低小螢幕擠壓。
- 新增 mobile UI 靜態測試，檢查手機隱藏重複入口且保留測試視角與設定。


## Step 9.2 — 逐句主持與角色行動鎖定

- 上帝每唸完一個有語音的步驟後，才解鎖對應角色操作與「下一句」；瀏覽器語音播放尚未結束時不可操作或推進。
- 狼人襲擊、女巫救藥／毒藥決策、預言家查驗、守衛守護均須完成或明確選擇不使用後，才能繼續主持流程。
- 女巫毒藥的選擇、確認和取消維持不同狀態；只有確認才消耗毒藥並鎖定目標。
- 尚未實作的特殊角色使用明確標記的測試模式手動確認；不會在正式模式中把佔位流程誤當作技能完成。
- 修正常見房規中獵人被每晚叫醒的口白問題；獵人是死亡觸發技能，出局開槍流程另列為尚待實作項目。
- 夜間提醒倒數不再自動結算或跳過未完成技能。
- 新增逐句主持／技能閘門回歸測試，並更新維護文件。
- `npm run check`：68/68 Node.js 自動化測試通過，所有 8 個 JavaScript 模組通過語法檢查。


## Step 9.3 — 系統自動上帝主持

- 正式模式不再要求真人主持人點擊「下一句」；口白結束後自動推進無需決策的步驟。
- 角色完成合法夜間操作後自動推進下一句，未完成行動仍會鎖住流程。
- 首夜若有狼王，狼人互認後新增「狼王請比讚。」並保留手勢確認停頓。
- 正式模式隱藏手動主持控制；測試模式保留逐句手動控制、重播和佔位流程確認。
- 正式模式阻止包含尚未接入的主動夜間技能佔位步驟的板型開局，避免無效技能卡死流程。
- 新增自動推進、行動等待與狼王口白的自動化測試。
- `npm run check`：75/75 Node.js 自動化測試通過，8 個 JavaScript 模組語法檢查通過。
