const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/styles.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');

test('mobile UI includes viewport safe-area metadata and a semantic main seat list', () => {
  assert.match(html, /name="viewport"[^>]*viewport-fit=cover/);
  assert.match(html, /name="theme-color"/);
  assert.match(html, /<main[^>]*id="gameMain"/);
  assert.match(html, /<section[^>]*id="seatTable"[^>]*aria-label="玩家座位表"/);
});

test('mobile dock uses existing app actions and seat-scrolling handler', () => {
  assert.match(html, /class="mobile-dock"/);
  for (const action of ['scrollToGameTable()', 'openCompendium()', 'openSpectatorModal()', 'openMediaModal()']) {
    assert.ok(html.includes(action), `missing mobile dock action ${action}`);
  }
  assert.match(app, /function scrollToGameTable\(\)/);
});

test('mobile-first CSS declares responsive seat grids, large touch targets, and safe area insets', () => {
  assert.match(css, /--touch-target:\s*44px/);
  assert.match(css, /--safe-bottom:\s*env\(safe-area-inset-bottom/);
  assert.match(css, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media\s*\(min-width:\s*761px\)/);
  assert.match(css, /@media\s*\(min-width:\s*1100px\)/);
});

test('mobile modal and action panel use bottom-sheet layout without replacing core controls', () => {
  assert.match(css, /\.modal\s*\{[^}]*align-items:\s*flex-end/s);
  assert.match(css, /\.floating-panel\s*\{[^}]*bottom:\s*calc\(72px \+ var\(--safe-bottom\)\)/s);
  assert.match(html, /id="actionControls"/);
  assert.match(html, /id="compendiumModal"/);
});


test('mobile top toolbar hides actions duplicated in the bottom dock while preserving test perspective and Settings', () => {
  assert.match(html, /id="spectatorCountBtn"/);
  assert.match(html, /id="mediaTopBtn"/);
  assert.match(html, /id="compendiumTopBtn"/);
  assert.match(html, /id="settingsTopBtn"/);
  assert.match(html, /onclick="openSettings\(\)" aria-label="開啟設定與影音控制"/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*?#spectatorCountBtn,[\s\S]*?#mediaTopBtn,[\s\S]*?#compendiumTopBtn,[\s\S]*?#settingsTopBtn[\s\S]*?display:\s*none\s*!important/s);
  assert.match(css, /\.top-actions #perspectiveSelect\s*\{[^}]*max-width:/s);
  assert.match(css, /@media \(min-width:\s*761px\)/);
});


test('global action history sits immediately below the God narration and is collapsed by default', () => {
  const narration = html.indexOf('<section id="godFlowPanel"');
  const history = html.indexOf('<section id="gameHistoryPanel"');
  const main = html.indexOf('<main class="main-layout" id="gameMain"');
  assert.ok(narration >= 0 && history > narration && main > history,
    '行動紀錄應緊接在上帝口白下方、座位桌面上方');
  assert.match(html, /id="gameHistoryToggle"[^>]*aria-expanded="false"/);
  assert.match(html, /<ol id="gameHistoryLog" hidden>/,
    '明細預設收合，只呈現單行摘要');
  assert.match(css, /\.game-history-summary #gameHistorySummaryText\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.game-history-summary #gameHistorySummaryText\s*\{[^}]*text-overflow:\s*ellipsis/s);
  assert.match(css, /\.game-history-summary #gameHistorySummaryText\s*\{[^}]*white-space:\s*nowrap/s);
});
