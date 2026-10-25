/*
 * Awoo UI primitives. Keep DOM operations here so game rules remain browser-independent.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AwooUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function byId(id) {
    if (typeof document === 'undefined') return null;
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function setText(id, value) {
    const element = byId(id);
    if (!element) return false;
    element.textContent = String(value == null ? '' : value);
    return true;
  }

  function setDisplay(id, visible, display = 'flex') {
    const element = byId(id);
    if (!element) return false;
    element.style.display = visible ? display : 'none';
    return true;
  }

  function setBanner(phase, announcement, timer) {
    setText('bannerPhase', phase);
    setText('bannerAnnouncement', announcement);
    setText('bannerTimer', timer);
  }

  function toggleClass(id, className) {
    const element = byId(id);
    if (!element) return false;
    element.classList.toggle(className);
    return true;
  }

  return Object.freeze({ byId, escapeHtml, setText, setDisplay, setBanner, toggleClass });
});
