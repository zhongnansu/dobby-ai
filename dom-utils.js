// dom-utils.js — Shared DOM utility functions for Dobby AI

function removeElement(el) {
  if (el?.parentNode) el.parentNode.removeChild(el);
}

function isClickInsideUI(target) {
  const trigger = document.getElementById('dobby-ai-trigger');
  if (trigger?.contains(target)) return true;
  if (typeof _getBubbleContainer === 'function') {
    const bc = _getBubbleContainer();
    if (bc?.contains(target)) return true;
  }
  return false;
}

function getSelectedText() {
  return window.getSelection().toString().trim();
}

function getSelectionRect() {
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    return selection.getRangeAt(0).getBoundingClientRect();
  }
  return { top: 180, right: 300, bottom: 200, left: 100 };
}

if (typeof module !== 'undefined') module.exports = { removeElement, isClickInsideUI, getSelectedText, getSelectionRect };
