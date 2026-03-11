# Privacy Policy — Ask AI Chrome Extension

**Last updated:** March 11, 2026

## Overview

Ask AI is a Chrome extension that helps you send selected text from webpages to AI assistants (ChatGPT and Claude). Your privacy is important to us.

## Data Collection

Ask AI does **not** collect, store, or transmit any personal data. Specifically:

- **No personal information** is collected (no names, emails, addresses, or identifiers)
- **No browsing history** is tracked or recorded
- **No analytics or telemetry** data is sent to any server
- **No cookies** are set by the extension
- **No user accounts** are required

## Data Usage

When you use Ask AI, the following happens **locally on your device**:

- **Selected text** is read from the active tab only when you explicitly trigger the extension
- **Page title and URL** may be appended to your prompt if you enable the "Include page context" toggle
- **User preferences** (last selected AI provider and context toggle state) are stored locally using Chrome's `storage.local` API — this data never leaves your device

## Third-Party Services

When you click "Send", the extension opens a new browser tab to either:
- **ChatGPT** (chatgpt.com) — operated by OpenAI
- **Claude** (claude.ai) — operated by Anthropic

Your selected text is passed to these services via URL query parameters or clipboard. These services have their own privacy policies. Ask AI has no control over how they handle your data.

## Permissions

- **activeTab**: Read your text selection on the current page when you trigger the extension
- **contextMenus**: Provide a right-click "Ask AI" menu option
- **storage**: Save your preferences locally on your device

## Contact

For questions about this privacy policy, please open an issue at:
https://github.com/zhongnansu/ask-ai-extension/issues
