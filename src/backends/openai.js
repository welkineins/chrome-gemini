import { AIBackend } from './base.js';

/**
 * OpenAI Compatible API Backend
 * Works with OpenAI, Ollama, LM Studio, and other compatible APIs
 */
export class OpenAIBackend extends AIBackend {
    constructor(config) {
        super(config);
    }

    /**
     * Convert messages to OpenAI format
     */
    convertMessages(messages, systemPrompt) {
        const result = [];

        if (systemPrompt) {
            result.push({
                role: 'system',
                content: systemPrompt
            });
        }

        for (const msg of messages) {
            result.push({
                role: msg.role,
                content: msg.content
            });
        }

        return result;
    }

    /**
     * Build request body
     */
    buildRequestBody(messages, options) {
        const convertedMessages = this.convertMessages(messages, options.systemPrompt);

        // Add images to the last user message if present
        if (options.images && options.images.length > 0 && convertedMessages.length > 0) {
            const lastMsg = convertedMessages[convertedMessages.length - 1];
            if (lastMsg.role === 'user') {
                // Convert to content array format for vision models
                const contentArray = [
                    { type: 'text', text: lastMsg.content }
                ];

                for (const img of options.images) {
                    contentArray.push({
                        type: 'image_url',
                        image_url: {
                            url: img.data // data URL is supported
                        }
                    });
                }

                lastMsg.content = contentArray;
            }
        }

        const body = {
            model: this.model,
            messages: convertedMessages,
            stream: true
        };

        // Note: Web search (grounding) is a Gemini-specific feature
        // OpenAI API doesn't have an equivalent, so enableSearch is ignored here

        return body;
    }

    /**
     * Stream chat completion
     */
    async *streamChat(messages, options = {}) {
        const url = `${this.apiUrl}/chat/completions`;

        const headers = {
            'Content-Type': 'application/json'
        };

        // Only add Authorization header if API key is provided
        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        const body = this.buildRequestBody(messages, options);

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `API error: ${response.status}`);
        }

        for await (const line of this.readSSEStream(response)) {
            const data = this.parseSSELine(line);
            if (!data) continue;

            // Handle choices
            const choice = data.choices?.[0];
            if (!choice?.delta) continue;

            // Content
            if (choice.delta.content) {
                yield {
                    text: choice.delta.content,
                    thought: false
                };
            }

            // Tool calls (function calling)
            if (choice.delta.tool_calls) {
                for (const toolCall of choice.delta.tool_calls) {
                    yield {
                        toolCall: {
                            id: toolCall.id,
                            name: toolCall.function?.name,
                            arguments: toolCall.function?.arguments
                        }
                    };
                }
            }

            // Reasoning tokens (for models that support it, like o1)
            if (choice.delta.reasoning_content) {
                yield {
                    text: choice.delta.reasoning_content,
                    thought: true
                };
            }
        }
    }
}
