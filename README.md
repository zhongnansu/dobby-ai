<p align="center">
  <img src="icons/icon128.png" alt="Dobby AI" width="80" />
</p>

<h1 align="center">Dobby AI</h1>

<p align="center">
  <strong>Select any text on the web and get instant AI responses — right where you are.</strong>
</p>

<p align="center">
  <a href="https://github.com/zhongnansu/ask-ai-extension/actions/workflows/ci.yml"><img src="https://github.com/zhongnansu/ask-ai-extension/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/zhongnansu/ask-ai-extension/actions/workflows/security.yml"><img src="https://github.com/zhongnansu/ask-ai-extension/actions/workflows/security.yml/badge.svg" alt="Security"></a>
  <a href="https://github.com/zhongnansu/ask-ai-extension/actions/workflows/coverage.yml"><img src="https://github.com/zhongnansu/ask-ai-extension/actions/workflows/coverage.yml/badge.svg" alt="Coverage"></a>
  <img src="https://img.shields.io/badge/version-2.1.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/manifest-v3-green" alt="Manifest V3">
  <a href="https://github.com/zhongnansu/ask-ai-extension/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-yellow" alt="License"></a>
  <img src="https://img.shields.io/badge/chrome-web%20store-orange?logo=googlechrome&logoColor=white" alt="Chrome Web Store">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome">
</p>

<p align="center">
  Zero tab-switching · Inline AI responses · Smart content detection
</p>

---

Dobby AI is a Chrome extension that adds a floating trigger to any text selection. Pick a smart preset or type a custom prompt, and get an AI response in a frosted glass bubble — inline, without leaving the page.

## Why Dobby AI?

| | Dobby AI | HARPA AI | Merlin | Monica | Sider |
|---|:---:|:---:|:---:|:---:|:---:|
| **Inline AI Responses** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Smart Content Detection** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Language-Aware Responses** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **No Account Required** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Open Source** | ✅ | ❌ | ❌ | ❌ | ❌ |

## Features

- **Inline AI responses** — get answers in a frosted glass bubble right next to your selection, no tab-switching
- **Streaming responses** — see the AI's answer as it's being generated, with live markdown rendering
- **Smart content detection** — automatically detects code (JavaScript, Python, Rust, Go, SQL, Java, C/C++, Ruby, PHP), foreign languages (Japanese, Chinese, Korean, Arabic, Russian, Hindi, Thai), error logs, emails, data/tables, and math formulas — then suggests the most relevant presets
- **Language-aware** — responds in the same language as your selected text (select Chinese text, get a Chinese response)
- **Follow-up conversations** — ask follow-up questions within the same bubble, with full conversation history
- **Preset prompts** — one-click actions like "Explain this JavaScript", "Debug this", "Summarize", "Translate to English"
- **Custom instructions** — type any prompt to pair with your selected text
- **Page context injection** — includes the page title and URL for richer AI responses
- **Shadow DOM isolation** — the bubble UI is fully encapsulated and won't conflict with page styles
- **Secure proxy** — requests go through an HMAC-signed, rate-limited Cloudflare Worker proxy

## Quick Start

### Chrome Web Store

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/ask-ai/ebkmcgbkhegdmmmofiobmpnfmlljjjea) — one click and you're ready.

### Manual Installation

```bash
git clone https://github.com/zhongnansu/ask-ai-extension.git
```

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (toggle top-right)
3. Click **Load unpacked** → select the `ask-ai-extension` directory
4. Go to the extension's **Options** page to set your OpenAI API key
5. Select any text on a webpage to try it

## Usage

```
Select text → Click "Dobby AI" → Pick a preset → AI responds inline
```

1. **Select text** on any web page (minimum 3 characters)
2. Click the floating **"✦ Dobby AI"** trigger button
3. **Pick a preset** (auto-suggested based on content type) or **type a custom instruction**
4. The AI response streams into a **frosted glass bubble** right next to your selection
5. **Ask follow-ups** — type in the bubble to continue the conversation

## How It Works

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Content Scripts │     │  Shadow DOM      │     │  Background       │     │  Cloudflare      │
│                  │────>│  Bubble UI       │────>│  Service Worker   │────>│  Worker Proxy    │
│  detection.js    │     │  bubble.js       │     │  background.js    │     │  HMAC + rate     │
│  trigger.js      │     │  presets.js      │     │  SSE streaming    │     │  limiting        │
│  content.js      │     │  prompt.js       │     │                   │     │                   │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └──────────────────┘
```

**Smart Detection** is what sets Dobby AI apart. When you select text, `detection.js` analyzes it using heuristics — code keywords, DOM context (`<pre>`/`<code>` tags), Unicode character ranges, structural patterns — to determine the content type and suggest relevant presets:

| Content Type | Detection | Example Presets |
|---|---|---|
| JavaScript | `const`, `let`, `=>`, `console.log` | "Explain this JavaScript", "Convert to TypeScript" |
| Python | `def`, `self`, `elif`, `True/False/None` | "Explain this Python", "Add type hints" |
| Rust | `fn`, `let mut`, `impl`, `println!` | "Explain this Rust", "Optimize" |
| Chinese/Japanese/Korean | Unicode character ranges | "Summarize", "Explain simply", "Translate to English" |
| Error/Stack trace | `Error:`, `Traceback`, `at file:line` | "Explain error", "Suggest fix", "Find root cause" |
| Email | `Dear`/`Hi` + `Regards`/`Best` | "Draft reply", "Summarize email" |
| Math formula | LaTeX patterns, math operators | "Solve this", "Explain formula" |
| Long text | >200 words | "Summarize", "Key points" |

## Architecture

```
ask-ai-extension/
├── manifest.json          # Chrome extension manifest (MV3)
├── background.js          # Service worker — SSE streaming, context menu
├── content.js             # Entry point — message listener
├── detection.js           # Smart content type detection engine
├── presets.js             # Preset prompt configurations per content type
├── prompt.js              # Prompt construction with system messages
├── trigger.js             # Floating "Dobby AI" trigger on text selection
├── bubble.js              # Frosted glass bubble UI (Shadow DOM)
├── api.js                 # API key validation
├── history.js             # Conversation history management
├── options.html/js        # Settings page for API key
├── icons/                 # Extension icons (16, 48, 128 PNG)
├── proxy/                 # Cloudflare Worker proxy server
│   └── src/
│       ├── index.js       # Main handler — CORS, body validation
│       ├── validate.js    # HMAC-SHA256 request signing
│       ├── rate-limit.js  # Sliding window + burst rate limiting
│       └── openai.js      # OpenAI API relay
├── tests/                 # Vitest test suite (200+ tests)
└── .github/workflows/     # CI, coverage, security, release pipelines
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Proxy server
cd proxy && npm install && npm test
```

### CI/CD

| Workflow | Purpose |
|----------|---------|
| `ci.yml` | Tests + manifest linting on every push/PR |
| `coverage.yml` | Code coverage reporting |
| `security.yml` | Security scanning |
| `release.yml` | Build + GitHub Release + Chrome Web Store publish on `v*` tags |
| `pr-preview.yml` | PR preview builds |
| `permission-guard.yml` | Flags manifest permission changes |

## Contributing

Contributions are welcome! To get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Write tests for your changes
4. Ensure all tests pass (`npm test`)
5. Submit a pull request

## Privacy

Dobby AI collects **zero data**. No accounts, no analytics, no cookies, no telemetry. Your selected text is sent through a secure proxy to the OpenAI API and never stored. See [PRIVACY.md](PRIVACY.md) for details.

## License

[MIT](LICENSE) — free and open source.

---

<p align="center">
  Built with a dislike for copy-pasting and tab-switching
</p>
