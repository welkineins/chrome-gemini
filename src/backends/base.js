/**
 * Base class for AI backends
 */
export class AIBackend {
    constructor(config) {
        this.apiUrl = config.apiUrl;
        this.apiKey = config.apiKey;
        this.model = config.model;
    }

    /**
     * Stream chat completion
     * @param {Array} messages - Array of message objects
     * @param {Object} options - Additional options
     * @yields {Object} Response chunks with { text, thought, searchResults }
     */
    async *streamChat(messages, options = {}) {
        throw new Error('streamChat must be implemented by subclass');
    }

    /**
     * Parse SSE data line
     * @param {string} line - SSE data line
     * @returns {Object|null} Parsed JSON or null
     */
    parseSSELine(line) {
        if (!line.startsWith('data: ')) return null;
        const data = line.slice(6).trim();
        if (data === '[DONE]') return null;
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error('Failed to parse SSE data:', data);
            return null;
        }
    }

    /**
     * Create a streaming reader from fetch response
     * @param {Response} response - Fetch response
     * @yields {string} SSE lines
     */
    async *readSSEStream(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim()) {
                        yield line;
                    }
                }
            }

            // Process remaining buffer
            if (buffer.trim()) {
                yield buffer;
            }
        } finally {
            reader.releaseLock();
        }
    }
}
