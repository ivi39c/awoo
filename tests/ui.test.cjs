const test = require('node:test');
const assert = require('node:assert/strict');
const UI = require('../js/ui.js');

test('HTML 跳脫器會處理可能造成 HTML 注入的字元', () => {
  assert.equal(UI.escapeHtml(`<script a="b">Tom & 'Jerry'</script>`), '&lt;script a=&quot;b&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/script&gt;');
});

test('DOM helper 在沒有 document 的測試環境中安全回傳', () => {
  assert.equal(UI.setText('missing', 'x'), false);
  assert.equal(UI.setDisplay('missing', true), false);
  assert.equal(UI.toggleClass('missing', 'active'), false);
});
