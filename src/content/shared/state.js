// src/content/shared/state.js — Central mutable state for content scripts

// Bubble state
export let bubbleHost = null;
export let currentMessages = [];
export let responseText = '';
export let currentRequest = null;
export let renderTimer = null;

export function setBubbleHost(v) { bubbleHost = v; }
export function setCurrentMessages(v) { currentMessages = v; }
export function setResponseText(v) { responseText = v; }
export function appendResponseText(v) { responseText += v; }
export function setCurrentRequest(v) { currentRequest = v; }
export function setRenderTimer(v) { renderTimer = v; }

// Trigger state
export let triggerButton = null;
export let dobbyEnabled = true;

export function setTriggerButton(v) { triggerButton = v; }
export function setDobbyEnabled(v) { dobbyEnabled = v; }

// Screenshot state
export const screenshotState = {
  overlay: null,
  startX: 0,
  startY: 0,
  rect: null,
  dragStarted: false,
};

export function resetScreenshotState() {
  screenshotState.overlay = null;
  screenshotState.startX = 0;
  screenshotState.startY = 0;
  screenshotState.rect = null;
  screenshotState.dragStarted = false;
}

// Long-press state
export const longPressState = {
  timer: null,
  startX: 0,
  startY: 0,
  ring: null,
  ringTimer: null,
};

// Timer state (for selection/scroll debounce)
export let selectionChangeTimer = null;
export let scrollTimer = null;

export function setSelectionChangeTimer(v) { selectionChangeTimer = v; }
export function setScrollTimer(v) { scrollTimer = v; }
