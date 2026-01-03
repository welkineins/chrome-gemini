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
        const body = {
            model: this.model,
            messages: this.convertMessages(messages, options.systemPrompt),
            stream: true
        };

        // Add tools if enabled (function calling)
        if (options.enableSearch && options.tools) {
            body.tools = options.tools;
        }

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
