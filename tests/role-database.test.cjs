const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ROLE_DATABASE,
  ROLE_ALIAS_MAP,
  ROLE_CAMP,
  getRoleDefinition,
  getRoleCamp,
} = require('../js/role-database.js');

test('角色資料庫有內容且角色標準名稱唯一', () => {
  assert.ok(Array.isArray(ROLE_DATABASE));
  assert.ok(ROLE_DATABASE.length >= 100, `角色數量異常：${ROLE_DATABASE.length}`);
  const names = ROLE_DATABASE.map(role => role.name);
  assert.ok(names.every(name => typeof name === 'string' && name.trim()));
  assert.equal(new Set(names).size, names.length, '發現重複的標準角色名稱');
});

test('每個角色具有圖鑑必要欄位與合法陣營', () => {
  const teams = new Set(['wolf', 'wolfAlly', 'good', 'couple', 'third']);
  for (const role of ROLE_DATABASE) {
    assert.ok(role.name, '角色缺少 name');
    assert.ok(teams.has(role.team), `${role.name} 的 team 不合法：${role.team}`);
    assert.ok(role.category, `${role.name} 缺少 category`);
    assert.ok(role.ability, `${role.name} 缺少 ability`);
    assert.ok(Array.isArray(role.aliases), `${role.name} 的 aliases 必須是陣列`);
    assert.ok(Array.isArray(role.relations), `${role.name} 的 relations 必須是陣列`);
  }
});

test('標準名稱可以查回正確角色，別名映射有定義', () => {
  for (const role of ROLE_DATABASE) {
    assert.equal(getRoleDefinition(role.name)?.name, role.name);
    assert.equal(getRoleCamp(role.name), ROLE_CAMP[role.name]);
    for (const alias of role.aliases) {
      assert.ok(ROLE_ALIAS_MAP[String(alias).toLocaleLowerCase()], `${role.name} 的別名 ${alias} 沒有映射`);
    }
  }
});

test('角色關係名稱可查到資料，或明確保留為未解析關係', () => {
  // 目前圖鑑允許純文字關係，讓不同平台的角色名稱可以先被記錄；
  // 此測試報告關係解析率，避免未來新增資料時默默下降。
  let resolved = 0;
  let total = 0;
  for (const role of ROLE_DATABASE) {
    for (const relation of role.relations) {
      total++;
      if (getRoleDefinition(relation)) resolved++;
    }
  }
  assert.ok(total > 0);
  const ratio = resolved / total;
  assert.ok(ratio >= 0.8, `關係解析率偏低：${Math.round(ratio * 100)}% (${resolved}/${total})`);
});

test('不同角色的標準名稱與別名不會互相衝突', () => {
  const ownerByAlias = new Map();
  for (const role of ROLE_DATABASE) {
    for (const label of [role.name, ...role.aliases]) {
      const key = String(label).trim().toLocaleLowerCase();
      assert.ok(key, `${role.name} 有空白名稱或別名`);
      const previous = ownerByAlias.get(key);
      assert.ok(!previous || previous === role.name, `別名衝突「${label}」：${previous} / ${role.name}`);
      ownerByAlias.set(key, role.name);
    }
  }
});
