import { GeminiBackend } from './backends/gemini.js';
import { OpenAIBackend } from './backends/openai.js';
import { SettingsManager } from './settings.js';
import { markdownToHtml, extractPageContent, generateId } from './utils.js';

/**
 * Chat Manager - handles conversation state and messaging
 */
export class ChatManager {
    constructor() {
        this.messages = [];
        this.currentBackend = null;
        this.settings = null;
        this.isStreaming = false;
        this.abortController = null;
    }

    /**
     * Initialize with settings
     */
    async init() {
        this.settings = await SettingsManager.load();
        this.createBackend();
        return this.settings;
    }

    /**
     * Create backend based on current settings
     */
    createBackend() {
        const config = SettingsManager.getBackendConfig(this.settings);

        if (this.settings.backendType === 'gemini') {
            this.currentBackend = new GeminiBackend(config);
        } else {
            this.currentBackend = new OpenAIBackend(config);
        }
    }

    /**
     * Update settings and recreate backend
     */
    async updateSettings(newSettings) {
        this.settings = newSettings;
        await SettingsManager.save(newSettings);
        this.createBackend();
    }

    /**
     * Clear conversation
     */
    clearConversation() {
        this.messages = [];
    }

    /**
     * Add a message to the conversation
     */
    addMessage(role, content) {
        const message = {
            id: generateId(),
            role,
            content,
            timestamp: Date.now()
        };
        this.messages.push(message);
        return message;
    }

    /**
     * Send a message and stream the response
     * @param {string} userMessage - User's message
     * @param {Object} options - Options including pageContent
     * @yields {Object} Response chunks
     */
    async *sendMessage(userMessage, options = {}) {
        if (this.isStreaming) {
            throw new Error('Already streaming a response');
        }

        this.isStreaming = true;
        this.abortController = new AbortController();

        try {
            // Build the message content
            let content = userMessage;

            // Include page content if available
            if (options.pageContent) {
                content = `[Current Page Context]
Title: ${options.pageContent.title}
URL: ${options.pageContent.url}

Content:
${options.pageContent.content}

---

User Question: ${userMessage}`;
            }

            // Add user message
            this.addMessage('user', content);

            // Prepare stream options
            const streamOptions = {
                systemPrompt: this.settings.systemPrompt,
                enableSearch: this.settings.enableSearch,
                includeThinking: this.settings.includeThinking,
                images: options.images || []
            };

            // Stream the response
            let fullResponse = '';
            let fullThinking = '';

            for await (const chunk of this.currentBackend.streamChat(this.messages, streamOptions)) {
                if (chunk.thought) {
                    fullThinking += chunk.text || '';
                } else if (chunk.text) {
                    fullResponse += chunk.text;
                }

                yield {
                    ...chunk,
                    fullResponse,
                    fullThinking
                };
            }

            // Add assistant message (without page context prefix)
            this.addMessage('assistant', fullResponse);

        } finally {
            this.isStreaming = false;
            this.abortController = null;
        }
    }

    /**
     * Stop current streaming
     */
    stopStreaming() {
        if (this.abortController) {
            this.abortController.abort();
        }
    }

    /**
     * Get page content if enabled
     */
    async getPageContentIfEnabled() {
        if (this.settings.autoIncludePage) {
            return await extractPageContent();
        }
        return null;
    }

    /**
     * Render message as HTML
     */
    renderMessage(content, isThinking = false) {
        if (isThinking) {
            return `<div class="thinking-content">${markdownToHtml(content)}</div>`;
        }
        return `<div class="message-content">${markdownToHtml(content)}</div>`;
    }
}
