// tests/content.test.js
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';

let messageListener;

global.chrome = {
  runtime: {
    onMessage: {
      addListener: vi.fn((fn) => { messageListener = fn; }),
    },
  },
};

global.showBubble = vi.fn();
global.showBubbleWithPresets = vi.fn();
global.hideBubble = vi.fn();
global.buildChatMessages = vi.fn(() => [{ role: 'user', content: 'mock' }]);
global.captureImage = vi.fn();
global._getBubbleContainer = vi.fn();

await import('../content.js');

describe('content.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SHOW_BUBBLE with text', () => {
    it('calls buildChatMessages and showBubble with text', () => {
      messageListener({ type: 'SHOW_BUBBLE', text: 'hello world' });

      expect(global.buildChatMessages).toHaveBeenCalledWith(
        'hello world',
        'Explain the following',
        true,
      );
      expect(global.showBubble).toHaveBeenCalledWith(
        expect.objectContaining({ bottom: expect.any(Number), left: expect.any(Number), right: expect.any(Number) }),
        [{ role: 'user', content: 'mock' }],
        'hello world',
        'Explain the following',
      );
    });
  });

  describe('SHOW_BUBBLE with image (successful capture)', () => {
    it('calls captureImage and showBubbleWithPresets', async () => {
      global.captureImage.mockResolvedValue({ type: 'image', data: 'base64data' });

      messageListener({ type: 'SHOW_BUBBLE', image: 'https://example.com/img.png' });

      // Wait for async IIFE to settle
      await vi.waitFor(() => {
        expect(global.captureImage).toHaveBeenCalledWith('https://example.com/img.png');
        expect(global.showBubbleWithPresets).toHaveBeenCalledWith(
          expect.objectContaining({ bottom: expect.any(Number) }),
          '',
          null,
          [{ type: 'image', data: 'base64data' }],
        );
      });
    });
  });

  describe('SHOW_BUBBLE with image (capture fails)', () => {
    it('calls showBubble with error when captureImage returns null', async () => {
      global.captureImage.mockResolvedValue(null);

      messageListener({ type: 'SHOW_BUBBLE', image: 'https://example.com/img.png' });

      await vi.waitFor(() => {
        expect(global.showBubble).toHaveBeenCalledWith(
          expect.objectContaining({ bottom: expect.any(Number) }),
          [{ role: 'user', content: "Couldn't capture this image" }],
          '',
          'Error',
        );
      });
    });
  });

  describe('non-SHOW_BUBBLE messages', () => {
    it('are ignored', () => {
      messageListener({ type: 'OTHER_TYPE' });

      expect(global.showBubble).not.toHaveBeenCalled();
      expect(global.showBubbleWithPresets).not.toHaveBeenCalled();
      expect(global.buildChatMessages).not.toHaveBeenCalled();
    });
  });

  describe('click outside bubble', () => {
    it('calls hideBubble when clicking outside the bubble', async () => {
      const bubbleEl = document.createElement('div');
      bubbleEl.id = 'test-bubble';
      document.body.appendChild(bubbleEl);

      global._getBubbleContainer.mockReturnValue(bubbleEl);

      // The mousedown listener is registered after 100ms setTimeout
      await new Promise((r) => setTimeout(r, 150));

      const outsideTarget = document.createElement('div');
      document.body.appendChild(outsideTarget);

      const event = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(event, 'target', { value: outsideTarget });
      document.dispatchEvent(event);

      expect(global.hideBubble).toHaveBeenCalled();
    });

    it('does not call hideBubble when clicking the trigger', async () => {
      const bubbleEl = document.createElement('div');
      document.body.appendChild(bubbleEl);
      global._getBubbleContainer.mockReturnValue(bubbleEl);

      const trigger = document.createElement('div');
      trigger.id = 'dobby-ai-trigger';
      document.body.appendChild(trigger);

      await new Promise((r) => setTimeout(r, 150));

      const event = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(event, 'target', { value: trigger });
      document.dispatchEvent(event);

      expect(global.hideBubble).not.toHaveBeenCalled();
    });

    it('does not call hideBubble when clicking inside the bubble', async () => {
      const bubbleEl = document.createElement('div');
      const innerEl = document.createElement('span');
      bubbleEl.appendChild(innerEl);
      document.body.appendChild(bubbleEl);
      global._getBubbleContainer.mockReturnValue(bubbleEl);

      await new Promise((r) => setTimeout(r, 150));

      const event = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(event, 'target', { value: innerEl });
      document.dispatchEvent(event);

      expect(global.hideBubble).not.toHaveBeenCalled();
    });

    it('does not call hideBubble when no bubble exists', async () => {
      global._getBubbleContainer.mockReturnValue(null);

      await new Promise((r) => setTimeout(r, 150));

      const outsideTarget = document.createElement('div');
      document.body.appendChild(outsideTarget);

      const event = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(event, 'target', { value: outsideTarget });
      document.dispatchEvent(event);

      expect(global.hideBubble).not.toHaveBeenCalled();
    });
  });
});
