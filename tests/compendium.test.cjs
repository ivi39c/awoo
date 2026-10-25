const test = require('node:test');
const assert = require('node:assert/strict');
const Compendium = require('../js/compendium.js');
const { ROLE_DATABASE } = require('../js/role-database.js');

test('compendium search covers names, aliases, skill text, and relationships', () => {
  assert.ok(Compendium.filterRoles({ search: '預言家' }).some(role => role.name === '預言家'));
  assert.ok(Compendium.filterRoles({ search: 'SEER' }).some(role => role.name === '預言家'));
  assert.ok(Compendium.filterRoles({ search: '毒藥' }).length > 0);
  assert.ok(Compendium.filterRoles({ search: '狼美人' }).length > 0);
});

test('compendium category filters only return matching factions', () => {
  assert.ok(Compendium.filterRoles({ filter: 'wolf' }).length > 0);
  assert.ok(Compendium.filterRoles({ filter: 'wolf' }).every(role => role.team === 'wolf'));
  assert.ok(Compendium.filterRoles({ filter: 'good-god' }).every(role => role.team === 'good' && role.category === '神職'));
  assert.ok(Compendium.filterRoles({ filter: 'third' }).every(role => !['good', 'wolf', 'wolfAlly', 'couple'].includes(role.team)));
});

test('compendium resolves cross-links and exposes a stable catalogue count', () => {
  assert.equal(Compendium.findRoleReference('SEER')?.name, '預言家');
  assert.equal(Compendium.findRoleReference('不存在的角色'), null);
  assert.ok(ROLE_DATABASE.length >= 100);
});
