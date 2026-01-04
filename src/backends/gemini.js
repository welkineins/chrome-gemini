import { AIBackend } from './base.js';

/**
 * Gemini API Backend
 */
export class GeminiBackend extends AIBackend {
    constructor(config) {
        super(config);
    }

    /**
     * Convert messages to Gemini format
     */
    convertMessages(messages) {
        return messages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));
    }

    /**
     * Build request body
     */
    buildRequestBody(messages, options) {
        const contents = this.convertMessages(messages);

        // Add images to the last user message if present
        if (options.images && options.images.length > 0 && contents.length > 0) {
            const lastContent = contents[contents.length - 1];
            if (lastContent.role === 'user') {
                // Add image parts
                for (const img of options.images) {
                    // Extract base64 data from data URL
                    const base64Data = img.data.split(',')[1];
                    const mimeType = img.type || 'image/jpeg';

                    lastContent.parts.push({
                        inlineData: {
                            mimeType,
                            data: base64Data
                        }
                    });
                }
            }
        }

        const body = { contents };

        // System instruction
        if (options.systemPrompt) {
            body.systemInstruction = {
                parts: [{ text: options.systemPrompt }]
            };
        }

        // Tools (Search Grounding)
        if (options.enableSearch) {
            body.tools = [{ googleSearch: {} }];
        }

        // Generation config with thinking
        if (options.includeThinking) {
            body.generationConfig = {
                thinkingConfig: {
                    includeThoughts: true
                }
            };
        }

        return body;
    }

    /**
     * Stream chat completion
     */
    async *streamChat(messages, options = {}) {
        const url = `${this.apiUrl}/models/${this.model}:streamGenerateContent?alt=sse`;

        const headers = {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey
        };

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

            // Handle candidates
            const candidate = data.candidates?.[0];
            if (!candidate?.content?.parts) continue;

            for (const part of candidate.content.parts) {
                if (part.text) {
                    yield {
                        text: part.text,
                        thought: part.thought || false
                    };
                }
            }

            // Handle grounding metadata (search results)
            const grounding = candidate.groundingMetadata;
            if (grounding?.searchEntryPoint?.renderedContent) {
                yield {
                    searchResults: grounding.searchEntryPoint.renderedContent,
                    groundingChunks: grounding.groundingChunks
                };
            }
        }
    }
}
