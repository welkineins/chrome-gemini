# Chrome Gemini Extension

A Chrome extension with a side panel for chatting with AI models. Supports **Gemini API** and **OpenAI-compatible** backends (Ollama, LM Studio, etc.).

## Features

- 💬 **Side Panel Chat** - Chat with AI directly in Chrome
- 🔄 **Multi-Backend** - Support for Gemini API and OpenAI-compatible APIs
- 🌐 **Local LLM Support** - Works with Ollama, LM Studio, and other local servers
- 💭 **Thinking Mode** - Display model's reasoning process (Gemini)
- 🔍 **Search Grounding** - Web search integration (Gemini)
- 📄 **Page Context** - Include current tab content in prompts
- 🎨 **Dark Theme** - Modern, beautiful UI

## Installation

1. Clone or download this repository
2. Run `npm install` to install dependencies
3. Open `chrome://extensions/` in Chrome
4. Enable **Developer mode**
5. Click **Load unpacked** and select the project folder

## Usage

1. Click the extension icon to open the side panel
2. Click the ⚙️ settings button to configure:
   - Select backend (Gemini or OpenAI Compatible)
   - Enter API URL and API Key
   - Add/remove models
   - Set system prompt
3. Start chatting!

### Using with Gemini API

1. Get an API key from [Google AI Studio](https://aistudio.google.com/)
2. Select "Gemini API" in settings
3. Enter your API key
4. Choose a model (e.g., `gemini-2.5-flash`)

### Using with Ollama (Local)

1. Install and run [Ollama](https://ollama.ai/)
2. Select "OpenAI Compatible" in settings
3. Set URL to `http://localhost:11434/v1`
4. Add your models (e.g., `llama3`, `codellama`)

## Development

### Project Structure

```
├── manifest.json        # Chrome extension manifest
├── background.js        # Service worker
├── sidepanel.html/css/js # Side panel UI
├── src/
│   ├── backends/        # AI backend implementations
│   ├── settings.js      # Settings manager
│   ├── chat.js          # Chat logic
│   └── utils.js         # Utilities
└── tests/
    ├── unit/            # Jest unit tests
    └── e2e/             # Playwright E2E tests
```

### Testing

```bash
# Unit tests (Jest)
npm test

# Unit tests with coverage
npm run test:coverage

# E2E tests (Playwright)
npm run test:e2e
```

## License

MIT
