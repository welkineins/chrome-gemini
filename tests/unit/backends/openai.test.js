import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { OpenAIBackend } from '../../../src/backends/openai.js';
import { createMockSSEResponse, createMockErrorResponse, mockFetch } from '../mocks/fetch.mock.js';

describe('OpenAIBackend', () => {
    let backend;

    beforeEach(() => {
        backend = new OpenAIBackend({
            apiUrl: 'http://localhost:11434/v1',
            apiKey: '',
            model: 'llama3'
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with config', () => {
            expect(backend.apiUrl).toBe('http://localhost:11434/v1');
            expect(backend.apiKey).toBe('');
            expect(backend.model).toBe('llama3');
        });
    });

    describe('convertMessages', () => {
        it('should include system message when provided', () => {
            const messages = [{ role: 'user', content: 'Hello' }];
            const result = backend.convertMessages(messages, 'Be helpful');

            expect(result[0]).toEqual({
                role: 'system',
                content: 'Be helpful'
            });
            expect(result[1]).toEqual({
                role: 'user',
                content: 'Hello'
            });
        });

        it('should not include system message when not provided', () => {
            const messages = [{ role: 'user', content: 'Hello' }];
            const result = backend.convertMessages(messages, null);

            expect(result).toHaveLength(1);
            expect(result[0].role).toBe('user');
        });

        it('should preserve message roles', () => {
            const messages = [
                { role: 'user', content: 'Hello' },
                { role: 'assistant', content: 'Hi!' }
            ];
            const result = backend.convertMessages(messages, null);

            expect(result[0].role).toBe('user');
            expect(result[1].role).toBe('assistant');
        });
    });

    describe('buildRequestBody', () => {
        it('should build basic request body', () => {
            const messages = [{ role: 'user', content: 'Hello' }];
            const body = backend.buildRequestBody(messages, {});

            expect(body.model).toBe('llama3');
            expect(body.messages).toBeDefined();
            expect(body.stream).toBe(true);
        });

        it('should not add tools when enableSearch is true (OpenAI compatibility)', () => {
            const messages = [{ role: 'user', content: 'Hello' }];
            const body = backend.buildRequestBody(messages, { enableSearch: true });

            // Web search is Gemini-specific, so tools should not be added for OpenAI
            expect(body.tools).toBeUndefined();
        });
    });

    describe('streamChat', () => {
        it('should stream response chunks', async () => {
            const mockChunks = [
                { choices: [{ delta: { content: 'Hello' } }] },
                { choices: [{ delta: { content: ' World!' } }] }
            ];
            mockFetch(createMockSSEResponse(mockChunks));

            const chunks = [];
            for await (const chunk of backend.streamChat([{ role: 'user', content: 'Hi' }])) {
                chunks.push(chunk);
            }

            expect(chunks.map(c => c.text).join('')).toBe('Hello World!');
        });

        it('should call correct API endpoint', async () => {
            mockFetch(createMockSSEResponse([]));

            await backend.streamChat([{ role: 'user', content: 'Hi' }]).next();

            expect(fetch).toHaveBeenCalledWith(
                'http://localhost:11434/v1/chat/completions',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json'
                    })
                })
            );
        });

        it('should work without API key (Ollama)', async () => {
            mockFetch(createMockSSEResponse([]));

            await backend.streamChat([{ role: 'user', content: 'Hi' }]).next();

            const headers = fetch.mock.calls[0][1].headers;
            expect(headers.Authorization).toBeUndefined();
        });

        it('should include Authorization header when API key is provided', async () => {
            backend.apiKey = 'sk-test-key';
            mockFetch(createMockSSEResponse([]));

            await backend.streamChat([{ role: 'user', content: 'Hi' }]).next();

            const headers = fetch.mock.calls[0][1].headers;
            expect(headers.Authorization).toBe('Bearer sk-test-key');
        });

        it('should handle API errors', async () => {
            mockFetch(createMockErrorResponse(401, 'Unauthorized'));

            await expect(
                backend.streamChat([{ role: 'user', content: 'Hi' }]).next()
            ).rejects.toThrow('Unauthorized');
        });

        it('should handle tool calls', async () => {
            const mockChunks = [
                {
                    choices: [{
                        delta: {
                            tool_calls: [{
                                id: 'call_123',
                                function: { name: 'search', arguments: '{"query":"test"}' }
                            }]
                        }
                    }]
                }
            ];
            mockFetch(createMockSSEResponse(mockChunks));

            const chunks = [];
            for await (const chunk of backend.streamChat([{ role: 'user', content: 'Search' }])) {
                chunks.push(chunk);
            }

            expect(chunks[0].toolCall).toBeDefined();
            expect(chunks[0].toolCall.name).toBe('search');
        });

        it('should handle reasoning content (o1 models)', async () => {
            const mockChunks = [
                { choices: [{ delta: { reasoning_content: 'Let me think...' } }] },
                { choices: [{ delta: { content: 'Here is my answer' } }] }
            ];
            mockFetch(createMockSSEResponse(mockChunks));

            const chunks = [];
            for await (const chunk of backend.streamChat([{ role: 'user', content: 'Think' }])) {
                chunks.push(chunk);
            }

            expect(chunks[0].thought).toBe(true);
            expect(chunks[0].text).toBe('Let me think...');
            expect(chunks[1].thought).toBe(false);
            expect(chunks[1].text).toBe('Here is my answer');
        });
    });
});
