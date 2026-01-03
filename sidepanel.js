import { ChatManager } from './src/chat.js';
import { SettingsManager } from './src/settings.js';
import { autoResizeTextarea, extractPageContent, markdownToHtml } from './src/utils.js';

/**
 * Side Panel Application
 */
class SidePanelApp {
    constructor() {
        this.chatManager = new ChatManager();
        this.elements = {};
    }

    /**
     * Initialize the application
     */
    async init() {
        this.cacheElements();
        this.bindEvents();

        const settings = await this.chatManager.init();
        this.updateUIFromSettings(settings);
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.elements = {
            // Header
            modelSelect: document.getElementById('model-select'),
            newChatButton: document.getElementById('new-chat-button'),
            settingsButton: document.getElementById('settings-button'),

            // Chat
            chatMessages: document.getElementById('chat-messages'),
            messageInput: document.getElementById('message-input'),
            sendButton: document.getElementById('send-button'),
            includePage: document.getElementById('include-page'),

            // Settings Modal
            settingsModal: document.getElementById('settings-modal'),
            closeSettings: document.getElementById('close-settings'),
            cancelSettings: document.getElementById('cancel-settings'),
            saveSettings: document.getElementById('save-settings'),
            settingsError: document.getElementById('settings-error'),

            // Backend settings
            backendRadios: document.querySelectorAll('input[name="backend-type"]'),
            geminiSettings: document.getElementById('gemini-settings'),
            openaiSettings: document.getElementById('openai-settings'),

            // Gemini
            geminiApiUrl: document.getElementById('gemini-api-url'),
            geminiApiKey: document.getElementById('gemini-api-key'),
            geminiModels: document.getElementById('gemini-models'),
            geminiNewModel: document.getElementById('gemini-new-model'),
            geminiAddModel: document.getElementById('gemini-add-model'),

            // OpenAI
            openaiApiUrl: document.getElementById('openai-api-url'),
            openaiApiKey: document.getElementById('openai-api-key'),
            openaiModels: document.getElementById('openai-models'),
            openaiNewModel: document.getElementById('openai-new-model'),
            openaiAddModel: document.getElementById('openai-add-model'),

            // Other settings
            systemPrompt: document.getElementById('system-prompt'),
            enableSearch: document.getElementById('enable-search'),
            includeThinking: document.getElementById('include-thinking'),
            autoIncludePage: document.getElementById('auto-include-page'),

            // Theme
            themeRadios: document.querySelectorAll('input[name="theme"]')
        };
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Message input
        this.elements.messageInput.addEventListener('input', () => {
            autoResizeTextarea(this.elements.messageInput);
            this.elements.sendButton.disabled = !this.elements.messageInput.value.trim();
        });

        this.elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.elements.sendButton.addEventListener('click', () => this.sendMessage());
        this.elements.newChatButton.addEventListener('click', () => this.newChat());

        // Model select
        this.elements.modelSelect.addEventListener('change', async (e) => {
            const settings = { ...this.chatManager.settings, currentModel: e.target.value };
            await this.chatManager.updateSettings(settings);
        });

        // Settings modal
        this.elements.settingsButton.addEventListener('click', () => this.openSettings());
        this.elements.closeSettings.addEventListener('click', () => this.closeSettings());
        this.elements.cancelSettings.addEventListener('click', () => this.closeSettings());
        this.elements.saveSettings.addEventListener('click', () => this.saveSettings());

        // Backend type switching
        this.elements.backendRadios.forEach(radio => {
            radio.addEventListener('change', (e) => this.switchBackendUI(e.target.value));
        });

        // Add model buttons
        this.elements.geminiAddModel.addEventListener('click', () => {
            this.addModel('gemini', this.elements.geminiNewModel);
        });
        this.elements.openaiAddModel.addEventListener('click', () => {
            this.addModel('openai', this.elements.openaiNewModel);
        });

        // Enter to add model
        this.elements.geminiNewModel.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.addModel('gemini', this.elements.geminiNewModel);
        });
        this.elements.openaiNewModel.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.addModel('openai', this.elements.openaiNewModel);
        });

        // Close modal on backdrop click
        this.elements.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.elements.settingsModal) this.closeSettings();
        });
    }

    /**
     * Apply theme to document
     */
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
    }

    /**
     * Update UI from settings
     */
    updateUIFromSettings(settings) {
        // Model select
        this.updateModelSelect(settings);

        // Include page checkbox
        this.elements.includePage.checked = settings.autoIncludePage;

        // Apply theme
        this.applyTheme(settings.theme || 'auto');
        const themeRadio = document.querySelector(`input[name="theme"][value="${settings.theme || 'auto'}"]`);
        if (themeRadio) themeRadio.checked = true;

        // Settings form
        this.elements.geminiApiUrl.value = settings.gemini.apiUrl;
        this.elements.geminiApiKey.value = settings.gemini.apiKey;
        this.elements.openaiApiUrl.value = settings.openai.apiUrl;
        this.elements.openaiApiKey.value = settings.openai.apiKey;
        this.elements.systemPrompt.value = settings.systemPrompt;
        this.elements.enableSearch.checked = settings.enableSearch;
        this.elements.includeThinking.checked = settings.includeThinking;
        this.elements.autoIncludePage.checked = settings.autoIncludePage;

        // Backend type
        const backendRadio = document.querySelector(`input[name="backend-type"][value="${settings.backendType}"]`);
        if (backendRadio) backendRadio.checked = true;
        this.switchBackendUI(settings.backendType);

        // Model lists
        this.renderModelList('gemini', settings.gemini.models);
        this.renderModelList('openai', settings.openai.models);
    }

    /**
     * Update model select dropdown
     */
    updateModelSelect(settings) {
        const backendConfig = SettingsManager.getBackendConfig(settings);

        this.elements.modelSelect.innerHTML = '';
        for (const model of backendConfig.models) {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            option.selected = model === settings.currentModel;
            this.elements.modelSelect.appendChild(option);
        }
    }

    /**
     * Switch backend settings UI
     */
    switchBackendUI(backendType) {
        if (backendType === 'gemini') {
            this.elements.geminiSettings.classList.remove('hidden');
            this.elements.openaiSettings.classList.add('hidden');
        } else {
            this.elements.geminiSettings.classList.add('hidden');
            this.elements.openaiSettings.classList.remove('hidden');
        }
    }

    /**
     * Render model list
     */
    renderModelList(backend, models) {
        const container = this.elements[`${backend}Models`];
        container.innerHTML = '';

        for (const model of models) {
            const item = document.createElement('div');
            item.className = 'model-item';
            item.innerHTML = `
        <span>${model}</span>
        <button data-model="${model}" title="Remove">&times;</button>
      `;

            item.querySelector('button').addEventListener('click', () => {
                this.removeModel(backend, model);
            });

            container.appendChild(item);
        }
    }

    /**
     * Add model to list
     */
    addModel(backend, inputElement) {
        const modelName = inputElement.value.trim();
        if (!modelName) return;

        const settings = { ...this.chatManager.settings };
        if (!settings[backend].models.includes(modelName)) {
            settings[backend].models.push(modelName);
            this.renderModelList(backend, settings[backend].models);
        }

        inputElement.value = '';
    }

    /**
     * Remove model from list
     */
    removeModel(backend, modelName) {
        const settings = { ...this.chatManager.settings };
        settings[backend].models = settings[backend].models.filter(m => m !== modelName);
        this.renderModelList(backend, settings[backend].models);
    }

    /**
     * Open settings modal
     */
    openSettings() {
        this.updateUIFromSettings(this.chatManager.settings);
        this.elements.settingsError.classList.add('hidden');
        this.elements.settingsModal.classList.remove('hidden');
    }

    /**
     * Close settings modal
     */
    closeSettings() {
        this.elements.settingsModal.classList.add('hidden');
    }

    /**
     * Save settings
     */
    async saveSettings() {
        const backendType = document.querySelector('input[name="backend-type"]:checked').value;

        // Collect model lists from DOM
        const geminiModels = Array.from(this.elements.geminiModels.querySelectorAll('.model-item span'))
            .map(span => span.textContent);
        const openaiModels = Array.from(this.elements.openaiModels.querySelectorAll('.model-item span'))
            .map(span => span.textContent);

        const theme = document.querySelector('input[name="theme"]:checked')?.value || 'auto';

        const newSettings = {
            backendType,
            theme,
            gemini: {
                apiUrl: this.elements.geminiApiUrl.value.trim(),
                apiKey: this.elements.geminiApiKey.value,
                models: geminiModels.length > 0 ? geminiModels : this.chatManager.settings.gemini.models
            },
            openai: {
                apiUrl: this.elements.openaiApiUrl.value.trim(),
                apiKey: this.elements.openaiApiKey.value,
                models: openaiModels.length > 0 ? openaiModels : this.chatManager.settings.openai.models
            },
            currentModel: this.chatManager.settings.currentModel,
            systemPrompt: this.elements.systemPrompt.value,
            enableSearch: this.elements.enableSearch.checked,
            includeThinking: this.elements.includeThinking.checked,
            autoIncludePage: this.elements.autoIncludePage.checked
        };

        // Ensure current model is valid for current backend
        const currentModels = newSettings[backendType].models;
        if (!currentModels.includes(newSettings.currentModel)) {
            newSettings.currentModel = currentModels[0] || '';
        }

        // Validate
        const validation = SettingsManager.validate(newSettings);
        if (!validation.valid) {
            this.elements.settingsError.textContent = validation.errors.join('\n');
            this.elements.settingsError.classList.remove('hidden');
            return;
        }

        try {
            await this.chatManager.updateSettings(newSettings);
            this.updateModelSelect(newSettings);
            this.applyTheme(theme);
            this.closeSettings();
        } catch (error) {
            this.elements.settingsError.textContent = error.message;
            this.elements.settingsError.classList.remove('hidden');
        }
    }

    /**
     * Send message
     */
    async sendMessage() {
        const text = this.elements.messageInput.value.trim();
        if (!text || this.chatManager.isStreaming) return;

        // Clear input
        this.elements.messageInput.value = '';
        autoResizeTextarea(this.elements.messageInput);
        this.elements.sendButton.disabled = true;

        // Remove welcome message
        const welcome = this.elements.chatMessages.querySelector('.welcome-message');
        if (welcome) welcome.remove();

        // Add user message
        this.addMessageToUI('user', text);

        // Get page content if enabled
        let pageContent = null;
        if (this.elements.includePage.checked) {
            pageContent = await extractPageContent();
        }

        // Create assistant message container
        const assistantContainer = this.createAssistantMessageContainer();

        try {
            let thinkingContent = '';
            let responseContent = '';
            let hasThinking = false;

            for await (const chunk of this.chatManager.sendMessage(text, { pageContent })) {
                if (chunk.thought && chunk.text) {
                    hasThinking = true;
                    thinkingContent += chunk.text;
                    this.updateThinkingSection(assistantContainer, thinkingContent);
                } else if (chunk.text) {
                    responseContent += chunk.text;
                    this.updateResponseContent(assistantContainer, responseContent);
                }

                if (chunk.searchResults) {
                    this.addSearchResults(assistantContainer, chunk.searchResults);
                }
            }

            // Hide thinking section if empty
            if (!hasThinking) {
                const thinkingSection = assistantContainer.querySelector('.thinking-section');
                if (thinkingSection) thinkingSection.remove();
            }

        } catch (error) {
            console.error('Error sending message:', error);
            this.updateResponseContent(assistantContainer, `Error: ${error.message}`);
        }

        // Remove loading indicator
        const loading = assistantContainer.querySelector('.loading-indicator');
        if (loading) loading.remove();

        // Scroll to bottom
        this.scrollToBottom();
    }

    /**
     * Add message to UI
     */
    addMessageToUI(role, content) {
        const message = document.createElement('div');
        message.className = `message ${role}`;
        message.innerHTML = `<div class="message-content">${markdownToHtml(content)}</div>`;
        this.elements.chatMessages.appendChild(message);
        this.scrollToBottom();
    }

    /**
     * Create assistant message container
     */
    createAssistantMessageContainer() {
        const container = document.createElement('div');
        container.className = 'message assistant';
        container.innerHTML = `
      <div class="thinking-section">
        <button class="thinking-toggle">
          <span class="chevron">▼</span>
          <span>Thinking...</span>
        </button>
        <div class="thinking-content"></div>
      </div>
      <div class="response-content message-content"></div>
      <div class="loading-indicator">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>
    `;

        // Toggle thinking visibility
        const toggle = container.querySelector('.thinking-toggle');
        const thinkingContent = container.querySelector('.thinking-content');
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('collapsed');
            thinkingContent.classList.toggle('hidden');
        });

        this.elements.chatMessages.appendChild(container);
        this.scrollToBottom();

        return container;
    }

    /**
     * Update thinking section
     */
    updateThinkingSection(container, content) {
        const thinkingContent = container.querySelector('.thinking-content');
        if (thinkingContent) {
            thinkingContent.innerHTML = markdownToHtml(content);
        }
        this.scrollToBottom();
    }

    /**
     * Update response content
     */
    updateResponseContent(container, content) {
        const responseContent = container.querySelector('.response-content');
        if (responseContent) {
            responseContent.innerHTML = markdownToHtml(content);
        }
        this.scrollToBottom();
    }

    /**
     * Add search results
     */
    addSearchResults(container, htmlContent) {
        const existing = container.querySelector('.search-results');
        if (existing) return;

        const searchResults = document.createElement('div');
        searchResults.className = 'search-results';
        searchResults.innerHTML = `
      <div class="search-results-title">🔍 Search Results</div>
      <div class="search-results-content">${htmlContent}</div>
    `;

        const responseContent = container.querySelector('.response-content');
        container.insertBefore(searchResults, responseContent);
    }

    /**
     * New chat
     */
    newChat() {
        this.chatManager.clearConversation();
        this.elements.chatMessages.innerHTML = `
      <div class="welcome-message">
        <div class="welcome-icon">✨</div>
        <h2>Welcome to Gemini Chat</h2>
        <p>Start a conversation or configure your settings</p>
      </div>
    `;
    }

    /**
     * Scroll chat to bottom
     */
    scrollToBottom() {
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }
}

// Initialize app
const app = new SidePanelApp();
app.init().catch(console.error);
