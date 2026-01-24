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
        this.currentPageInfo = null;
        this.pendingImages = []; // Store images to be sent with message
        this.userAtBottom = true; // Track if user is at bottom for smart auto-scroll
    }

    /**
     * Initialize the application
     */
    async init() {
        this.cacheElements();
        this.bindEvents();

        const settings = await this.chatManager.init();
        this.updateUIFromSettings(settings);

        // Update page info on init and tab changes
        this.updatePageInfo();
        chrome.tabs.onActivated?.addListener(() => this.updatePageInfo());
        chrome.tabs.onUpdated?.addListener((tabId, changeInfo) => {
            if (changeInfo.status === 'complete') this.updatePageInfo();
        });
    }

    /**
     * Update page info display (favicon + title)
     */
    async updatePageInfo() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) return;

            const favicon = this.elements.pageFavicon;
            const title = this.elements.pageTitle;

            if (tab.favIconUrl) {
                favicon.src = tab.favIconUrl;
                favicon.style.display = 'block';
            } else {
                favicon.src = '';
                favicon.style.display = 'none';
            }

            title.textContent = tab.title || 'Include page content';
            title.title = tab.title || '';

            this.currentPageInfo = {
                title: tab.title,
                url: tab.url,
                favIconUrl: tab.favIconUrl
            };
        } catch (error) {
            console.error('Failed to update page info:', error);
        }
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
            themeRadios: document.querySelectorAll('input[name="theme"]'),

            // Page info
            pageFavicon: document.getElementById('page-favicon'),
            pageTitle: document.getElementById('page-title'),

            // Image handling
            inputBox: document.querySelector('.input-box'),
            addImageButton: document.getElementById('add-image-button'),
            imageFileInput: document.getElementById('image-file-input'),
            imagePreviewArea: document.getElementById('image-preview-area'),

            // Scroll to bottom
            scrollToBottomBtn: document.getElementById('scroll-to-bottom')
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
            // Don't send during CJK IME composition
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
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

        // Reset to default button
        document.getElementById('reset-settings')?.addEventListener('click', () => this.resetSettings());

        // Theme instant preview
        this.elements.themeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.applyTheme(e.target.value);
            });
        });

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

        // Quick action buttons
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const prompt = btn.dataset.prompt;
                this.elements.messageInput.value = prompt;
                this.sendMessage();
            });
        });

        // Image handling
        this.elements.addImageButton.addEventListener('click', () => {
            this.elements.imageFileInput.click();
        });

        this.elements.imageFileInput.addEventListener('change', (e) => {
            this.handleImageFiles(e.target.files);
            e.target.value = ''; // Reset for same file selection
        });

        // Drag and drop
        this.elements.inputBox.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.elements.inputBox.classList.add('drag-over');
        });

        this.elements.inputBox.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.elements.inputBox.classList.remove('drag-over');
        });

        this.elements.inputBox.addEventListener('drop', (e) => {
            e.preventDefault();
            this.elements.inputBox.classList.remove('drag-over');
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            this.handleImageFiles(files);
        });

        // Paste image
        this.elements.messageInput.addEventListener('paste', (e) => {
            const items = Array.from(e.clipboardData.items);
            const imageItems = items.filter(item => item.type.startsWith('image/'));
            if (imageItems.length > 0) {
                e.preventDefault();
                const files = imageItems.map(item => item.getAsFile());
                this.handleImageFiles(files);
            }
        });

        // Track scroll position for smart auto-scroll
        this.elements.chatMessages.addEventListener('scroll', () => {
            this.updateUserAtBottom();
        });

        // Scroll to bottom button click
        this.elements.scrollToBottomBtn.addEventListener('click', () => {
            this.scrollToBottom(true);
        });
    }

    /**
     * Handle image files for attachment
     */
    handleImageFiles(files) {
        const fileArray = Array.from(files);

        for (const file of fileArray) {
            if (!file.type.startsWith('image/')) continue;

            const reader = new FileReader();
            reader.onload = (e) => {
                this.pendingImages.push({
                    name: file.name,
                    type: file.type,
                    data: e.target.result // base64 data URL
                });
                this.renderImagePreviews();
            };
            reader.readAsDataURL(file);
        }
    }

    /**
     * Render image previews
     */
    renderImagePreviews() {
        const area = this.elements.imagePreviewArea;
        area.innerHTML = '';

        if (this.pendingImages.length === 0) {
            area.classList.add('hidden');
            return;
        }

        area.classList.remove('hidden');

        this.pendingImages.forEach((img, index) => {
            const item = document.createElement('div');
            item.className = 'image-preview-item';
            item.innerHTML = `
                <img src="${img.data}" alt="${img.name}">
                <button class="remove-image" title="Remove">×</button>
            `;

            item.querySelector('.remove-image').addEventListener('click', () => {
                this.removeImage(index);
            });

            area.appendChild(item);
        });
    }

    /**
     * Remove image from pending list
     */
    removeImage(index) {
        this.pendingImages.splice(index, 1);
        this.renderImagePreviews();
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
     * Render model list with drag-and-drop reordering
     */
    renderModelList(backend, models) {
        const container = this.elements[`${backend}Models`];
        container.innerHTML = '';

        models.forEach((model, index) => {
            const item = document.createElement('div');
            item.className = 'model-item';
            item.draggable = true;
            item.dataset.index = index;
            item.dataset.backend = backend;
            item.innerHTML = `
                <span class="model-item-drag">⋮⋮</span>
                <span class="model-item-name">${model}</span>
                <button class="delete-btn" title="Remove">×</button>
            `;

            // Drag events
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', index.toString());
                item.classList.add('dragging');
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const dragging = container.querySelector('.dragging');
                if (dragging && dragging !== item) {
                    const rect = item.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        container.insertBefore(dragging, item);
                    } else {
                        container.insertBefore(dragging, item.nextSibling);
                    }
                }
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                // Reorder based on current DOM order
                const newOrder = Array.from(container.children).map(
                    child => models[parseInt(child.dataset.index)]
                );
                const settings = { ...this.chatManager.settings };
                settings[backend].models = newOrder;
                this.renderModelList(backend, newOrder);
            });

            item.querySelector('.delete-btn').addEventListener('click', () => {
                this.removeModel(backend, model);
            });

            container.appendChild(item);
        });
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
        // Restore theme to saved value when canceling
        this.applyTheme(this.chatManager.settings.theme || 'auto');
    }

    /**
     * Reset settings to defaults
     */
    async resetSettings() {
        if (!confirm('Reset all settings to default values?')) return;

        const defaults = SettingsManager.getDefaults();
        await this.chatManager.updateSettings(defaults);
        this.updateUIFromSettings(defaults);
        this.closeSettings();
    }

    /**
     * Save settings
     */
    async saveSettings() {
        const backendType = document.querySelector('input[name="backend-type"]:checked').value;

        // Collect model lists from DOM (only get model names, not drag handles)
        const geminiModels = Array.from(this.elements.geminiModels.querySelectorAll('.model-item-name'))
            .map(span => span.textContent);
        const openaiModels = Array.from(this.elements.openaiModels.querySelectorAll('.model-item-name'))
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

        // Switch to stop button
        this.showStopButton();

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

        // Collect images to send
        const images = [...this.pendingImages];
        this.pendingImages = [];
        this.renderImagePreviews();

        // Create assistant message container
        const assistantContainer = this.createAssistantMessageContainer();

        try {
            let thinkingContent = '';
            let responseContent = '';
            let hasThinking = false;

            for await (const chunk of this.chatManager.sendMessage(text, { pageContent, images })) {
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
            // Handle abort gracefully
            if (error.name === 'AbortError') {
                console.log('Streaming aborted by user');
                // Add a note that generation was stopped
                const responseContent = assistantContainer.querySelector('.response-content');
                if (responseContent && !responseContent.textContent.trim()) {
                    responseContent.innerHTML = '<em style="color: var(--text-muted)">⏹️ Generation stopped</em>';
                }
            } else {
                console.error('Error sending message:', error);

                let errorMessage = `Error: ${error.message}`;
                if (error.message.includes('unregistered callers') || error.message.includes('API key')) {
                    errorMessage += '\n\n💡 Tip: Please check your API Key in settings.';
                }

                this.updateResponseContent(assistantContainer, errorMessage);
            }
        }

        // Remove loading indicator
        const loading = assistantContainer.querySelector('.loading-indicator');
        if (loading) loading.remove();

        // Switch back to send button
        this.showSendButton();

        // Scroll to bottom
        this.scrollToBottom();
    }

    /**
     * Add message to UI
     */
    addMessageToUI(role, content) {
        const message = document.createElement('div');
        message.className = `message ${role}`;
        message.dataset.content = content; // Store original content for copying
        message.innerHTML = `
            <div class="message-content">${markdownToHtml(content)}</div>
            <div class="message-actions">
                <button class="copy-button" title="Copy message">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                </button>
            </div>
        `;

        message.querySelector('.copy-button').addEventListener('click', (e) => {
            this.copyMessage(e.currentTarget, content);
        });

        this.elements.chatMessages.appendChild(message);
        this.scrollToBottom(true); // Force scroll when user sends a message
    }

    /**
     * Copy message content to clipboard
     */
    async copyMessage(button, content) {
        try {
            await navigator.clipboard.writeText(content);
            button.classList.add('copied');
            const originalHtml = button.innerHTML;
            button.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                Copied!
            `;
            setTimeout(() => {
                button.classList.remove('copied');
                button.innerHTML = originalHtml;
            }, 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    }

    /**
     * Create assistant message container
     */
    createAssistantMessageContainer() {
        const container = document.createElement('div');
        container.className = 'message assistant';
        container.innerHTML = `
            <div class="thinking-section">
                <button class="thinking-toggle collapsed">
                    <span class="chevron">▼</span>
                    <span class="thinking-label">Thinking...</span>
                </button>
                <div class="thinking-preview"></div>
                <div class="thinking-content hidden"></div>
            </div>
            <div class="response-content message-content"></div>
            <div class="message-actions">
                <button class="copy-button" title="Copy message">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                </button>
            </div>
            <div class="loading-indicator">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        `;

        // Copy button for assistant
        container.querySelector('.copy-button').addEventListener('click', (e) => {
            const responseContent = container.querySelector('.response-content');
            // Use original markdown if available, fallback to textContent
            const content = responseContent.dataset.markdown || responseContent.textContent;
            this.copyMessage(e.currentTarget, content);
        });

        // Toggle thinking visibility
        const toggle = container.querySelector('.thinking-toggle');
        const thinkingContent = container.querySelector('.thinking-content');
        const thinkingPreview = container.querySelector('.thinking-preview');
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('collapsed');
            thinkingContent.classList.toggle('hidden');
            // Hide preview when expanded
            if (thinkingContent.classList.contains('hidden')) {
                thinkingPreview.classList.remove('hidden');
            } else {
                thinkingPreview.classList.add('hidden');
            }
        });

        this.elements.chatMessages.appendChild(container);
        this.scrollToBottom(true); // Force scroll when creating new response container

        return container;
    }

    /**
     * Update thinking section
     */
    updateThinkingSection(container, content) {
        const thinkingContent = container.querySelector('.thinking-content');
        const thinkingPreview = container.querySelector('.thinking-preview');

        // Convert escaped newlines to actual newlines
        const processedContent = content.replace(/\\n/g, '\n');

        if (thinkingContent) {
            thinkingContent.innerHTML = markdownToHtml(processedContent);
        }

        // Update preview with last 2 lines (only if thinking content is hidden)
        if (thinkingPreview && processedContent && thinkingContent?.classList.contains('hidden')) {
            const lines = processedContent.trim().split('\n').filter(line => line.trim());
            const lastTwoLines = lines.slice(-2).join('\n');
            thinkingPreview.textContent = lastTwoLines || '';
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
            responseContent.dataset.markdown = content; // Store original markdown for copying
        }

        // Hide thinking preview once response starts (if still collapsed)
        const thinkingPreview = container.querySelector('.thinking-preview');
        if (thinkingPreview) {
            thinkingPreview.classList.add('hidden');
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
                <p>Start a conversation or try one of these:</p>
                <div class="quick-actions">
                    <button class="quick-action-btn" data-prompt="Summarize this page">📝 Summarize</button>
                    <button class="quick-action-btn" data-prompt="Help me understand and learn from this page">📚 Help me learn</button>
                    <button class="quick-action-btn" data-prompt="Research and fact-check the claims on this page">🔍 Fact check</button>
                </div>
            </div>
        `;
        // Rebind quick action buttons
        this.elements.chatMessages.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const prompt = btn.dataset.prompt;
                this.elements.messageInput.value = prompt;
                this.sendMessage();
            });
        });
    }

    /**
     * Check if user is at or near the bottom of the chat
     */
    updateUserAtBottom() {
        const el = this.elements.chatMessages;
        // Consider "at bottom" if within 50px of the bottom
        const threshold = 50;
        this.userAtBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) <= threshold;

        // Show/hide scroll to bottom button
        if (this.userAtBottom) {
            this.elements.scrollToBottomBtn.classList.add('hidden');
        } else {
            this.elements.scrollToBottomBtn.classList.remove('hidden');
        }
    }

    /**
     * Scroll chat to bottom (only if user was already at bottom)
     */
    scrollToBottom(force = false) {
        if (force || this.userAtBottom) {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
            this.userAtBottom = true;
            this.elements.scrollToBottomBtn.classList.add('hidden');
        }
    }

    /**
     * Show stop button (during streaming)
     */
    showStopButton() {
        this.elements.sendButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
            </svg>
        `;
        this.elements.sendButton.disabled = false;
        this.elements.sendButton.classList.add('stop-mode');
        this.elements.sendButton.title = 'Stop generation';
        this.elements.sendButton.onclick = () => this.stopStreaming();
    }

    /**
     * Show send button (default state)
     */
    showSendButton() {
        this.elements.sendButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
        `;
        this.elements.sendButton.disabled = !this.elements.messageInput.value.trim();
        this.elements.sendButton.classList.remove('stop-mode');
        this.elements.sendButton.title = 'Send message';
        this.elements.sendButton.onclick = null; // Remove stop handler
    }

    /**
     * Stop current streaming
     */
    stopStreaming() {
        this.chatManager.stopStreaming();
    }
}

// Initialize app
const app = new SidePanelApp();
app.init().catch(console.error);
