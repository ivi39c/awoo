const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

class FakeElement {
  constructor(tagName = 'div', id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.className = '';
    this.value = '';
    this.type = '';
    this.attributes = {};
    this.children = [];
    this.listeners = {};
    this._text = '';
  }
  set textContent(value) {
    this._text = String(value == null ? '' : value);
    this.children = [];
  }
  get textContent() {
    return this._text + this.children.map(child => child.textContent).join('');
  }
  appendChild(child) { this._text = ''; this.children.push(child); return child; }
  replaceChildren(...children) { this._text = ''; this.children = children; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  dispatch(type) { for (const callback of this.listeners[type] || []) callback({ target: this }); }
}

function makeDocument() {
  const ids = {};
  for (const id of ['compendiumSearch', 'compendiumFilter', 'compendiumRoleGrid', 'compendiumDetail', 'compendiumCount']) {
    ids[id] = new FakeElement('div', id);
  }
  ids.compendiumSearch.tagName = 'INPUT';
  ids.compendiumFilter.tagName = 'SELECT';
  ids.compendiumFilter.value = 'all';
  return {
    getElementById: id => ids[id] || null,
    createElement: tagName => new FakeElement(tagName),
    _elements: ids,
  };
}

test('compendium renders records with DOM APIs and reacts to search/filter events', () => {
  const context = vm.createContext({ console, Map, Set, Object, Array, Number, String, Math, TypeError, Error });
  context.window = context;
  context.document = makeDocument();
  for (const file of ['js/role-database.js', 'js/compendium.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  context.AwooCompendium.open();
  const nodes = context.document._elements;
  assert.ok(nodes.compendiumRoleGrid.children.length >= 100, '角色清單應顯示完整資料庫');
  assert.match(nodes.compendiumDetail.textContent, /角色資料卡/);
  assert.match(nodes.compendiumCount.textContent, /個角色/);

  nodes.compendiumSearch.value = 'SEER';
  nodes.compendiumSearch.dispatch('input');
  assert.equal(nodes.compendiumRoleGrid.children.length, 1);
  assert.match(nodes.compendiumDetail.textContent, /預言家/);

  nodes.compendiumSearch.value = '';
  nodes.compendiumFilter.value = 'wolf';
  nodes.compendiumFilter.dispatch('change');
  assert.ok(nodes.compendiumRoleGrid.children.length > 0);
  assert.ok(nodes.compendiumRoleGrid.children.every(card => card.textContent.length > 0));
});
