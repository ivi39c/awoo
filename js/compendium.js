/*
 * Awoo character compendium UI.
 * Uses DOM text nodes instead of injecting user/searchable role content into HTML strings.
 */
(function (root, factory) {
  const roleDb = (typeof module === 'object' && module.exports)
    ? require('./role-database.js')
    : (root && root.AwooRoleDatabase);
  const api = factory(roleDb, root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AwooCompendium = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (roleDb, root) {
  'use strict';
  const ROLE_DATABASE = roleDb && roleDb.ROLE_DATABASE ? roleDb.ROLE_DATABASE : [];
  const getRoleDefinition = roleDb && roleDb.getRoleDefinition ? roleDb.getRoleDefinition : () => null;
  let selectedRoleName = '平民';
  let initialized = false;

  function getRoleFilterKey(role) {
    if (role.team === 'good' && role.category === '神職') return 'good-god';
    if (role.team === 'good') return 'good-villager';
    if (role.team === 'wolf') return 'wolf';
    if (role.team === 'wolfAlly') return 'wolfAlly';
    if (role.team === 'couple') return 'couple';
    return 'third';
  }

  function findRoleReference(name) {
    if (!name) return null;
    return ROLE_DATABASE.find(role => role.name === name) || getRoleDefinition(name) || null;
  }

  function filterRoles({ search = '', filter = 'all' } = {}) {
    const query = String(search).trim().toLocaleLowerCase();
    return ROLE_DATABASE.filter(role => {
      const matchesFilter = filter === 'all' || getRoleFilterKey(role) === filter;
      const searchableText = [
        role.name, role.camp, role.category, role.ability, role.timing,
        role.interaction, role.variants, ...(role.aliases || []), ...(role.relations || [])
      ].join(' ').toLocaleLowerCase();
      return matchesFilter && (!query || searchableText.includes(query));
    });
  }

  function getElement(id) {
    return root && root.document ? root.document.getElementById(id) : null;
  }

  function createElement(tagName, className, text) {
    const element = root.document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  }

  function appendSection(parent, title, text) {
    const section = createElement('section', 'compendium-section');
    section.appendChild(createElement('div', 'compendium-section-title', title));
    section.appendChild(createElement('p', '', text || '尚未提供資料。'));
    parent.appendChild(section);
  }

  function renderDetail(role) {
    const detail = getElement('compendiumDetail');
    if (!detail) return;
    detail.replaceChildren();
    if (!role) {
      detail.appendChild(createElement('p', '', '找不到符合條件的角色，請清除搜尋條件。'));
      return;
    }
    detail.appendChild(createElement('div', 'compendium-detail-eyebrow', '角色資料卡'));
    detail.appendChild(createElement('h4', '', role.name));
    detail.appendChild(createElement('div', 'compendium-card-meta', `${role.camp}　／　${role.category}`));
    if (Array.isArray(role.aliases) && role.aliases.length) {
      const aliases = createElement('div', 'compendium-aliases', `別名：${role.aliases.join('、')}`);
      detail.appendChild(aliases);
    }
    appendSection(detail, '技能說明', role.ability);
    appendSection(detail, '行動時機', role.timing);

    const relationSection = createElement('section', 'compendium-section');
    relationSection.appendChild(createElement('div', 'compendium-section-title', '角色關係／可互動角色'));
    const relationContainer = createElement('div', 'compendium-relations');
    const relations = Array.isArray(role.relations) ? role.relations : [];
    if (!relations.length) {
      relationContainer.appendChild(createElement('span', 'compendium-no-relations', '尚未定義直接關係'));
    }
    relations.forEach(name => {
      const related = findRoleReference(name);
      if (related) {
        const button = createElement('button', 'compendium-chip', related.name);
        button.type = 'button';
        button.addEventListener('click', () => selectRole(related.name));
        relationContainer.appendChild(button);
      } else {
        relationContainer.appendChild(createElement('span', 'compendium-chip compendium-chip-static', name));
      }
    });
    relationSection.appendChild(relationContainer);
    detail.appendChild(relationSection);

    appendSection(detail, '技能互動與結算注意事項', role.interaction);
    appendSection(detail, '版本差異', role.variants);
    detail.appendChild(createElement('div', 'compendium-status', role.implementation || '已收錄於圖鑑；遊戲引擎尚未接入。'));
  }

  function render() {
    const grid = getElement('compendiumRoleGrid');
    const count = getElement('compendiumCount');
    if (!grid || !count) return [];
    const searchInput = getElement('compendiumSearch');
    const filterInput = getElement('compendiumFilter');
    const filtered = filterRoles({
      search: searchInput ? searchInput.value : '',
      filter: filterInput ? filterInput.value : 'all'
    });
    if (!filtered.some(role => role.name === selectedRoleName)) {
      selectedRoleName = filtered.length ? filtered[0].name : '';
    }
    count.textContent = `顯示 ${filtered.length} / ${ROLE_DATABASE.length} 個角色｜點選角色可查看技能與關係`;
    grid.replaceChildren();
    if (!filtered.length) {
      const empty = createElement('div', 'compendium-empty', '找不到符合條件的角色，請更改搜尋字詞或陣營篩選。');
      grid.appendChild(empty);
      renderDetail(null);
      return filtered;
    }
    filtered.forEach(role => {
      const button = createElement('button', `compendium-card${role.name === selectedRoleName ? ' selected' : ''}`);
      button.type = 'button';
      button.setAttribute('aria-pressed', role.name === selectedRoleName ? 'true' : 'false');
      button.appendChild(createElement('div', 'compendium-card-title', role.name));
      button.appendChild(createElement('div', 'compendium-card-meta', `${role.camp}・${role.category}`));
      button.appendChild(createElement('div', 'compendium-card-desc', role.ability));
      button.addEventListener('click', () => selectRole(role.name));
      grid.appendChild(button);
    });
    renderDetail(filtered.find(role => role.name === selectedRoleName) || filtered[0]);
    return filtered;
  }

  function selectRole(name) {
    const role = findRoleReference(name);
    if (!role) return false;
    selectedRoleName = role.name;
    const search = getElement('compendiumSearch');
    const filter = getElement('compendiumFilter');
    if (search) search.value = '';
    if (filter) filter.value = 'all';
    render();
    return true;
  }

  function init() {
    if (initialized || !root || !root.document) return;
    const search = getElement('compendiumSearch');
    const filter = getElement('compendiumFilter');
    if (search) search.addEventListener('input', render);
    if (filter) filter.addEventListener('change', render);
    initialized = true;
  }

  function open() {
    init();
    render();
  }

  // Script tags use defer, so the DOM is ready by the time this runs in the browser.
  if (root && root.document) init();

  return Object.freeze({
    open, init, render, select: selectRole, filterRoles, getRoleFilterKey,
    findRoleReference, getSelectedRole: () => selectedRoleName
  });
});
