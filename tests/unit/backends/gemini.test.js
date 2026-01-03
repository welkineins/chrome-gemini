import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { GeminiBackend } from '../../../src/backends/gemini.js';
import { createMockSSEResponse, createMockErrorResponse, mockFetch } from '../mocks/fetch.mock.js';

describe('GeminiBackend', () => {
    let backend;

    beforeEach(() => {
        backend = new GeminiBackend({
            apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
            apiKey: 'test-api-key',
            model: 'gemini-1.5-pro'
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with config', () => {
            expect(backend.apiUrl).toBe('https://generativelanguage.googleapis.com/v1beta');
            expect(backend.apiKey).toBe('test-api-key');
            expect(backend.model).toBe('gemini-1.5-pro');
        });
    });

    describe('convertMessages', () => {
        it('should convert user messages', () => {
            const messages = [{ role: 'user', content: 'Hello' }];
            const result = backend.convertMessages(messages);

            expect(result).toEqual([{
                role: 'user',
                parts: [{ text: 'Hello' }]
            }]);
        });

        it('should convert assistant messages to model role', () => {
            const messages = [{ role: 'assistant', content: 'Hi there' }];
            const result = backend.convertMessages(messages);

            expect(result).toEqual([{
                role: 'model',
                parts: [{ text: 'Hi there' }]
            }]);
        });

        it('should handle multiple messages', () => {
            const messages = [
                { role: 'user', content: 'Hello' },
                { role: 'assistant', content: 'Hi!' },
                { role: 'user', content: 'How are you?' }
            ];
            const result = backend.convertMessages(messages);

            expect(result).toHaveLength(3);
            expect(result[0].role).toBe('user');
            expect(result[1].role).toBe('model');
            expect(result[2].role).toBe('user');
        });
    });

    describe('buildRequestBody', () => {
        it('should build basic request body', () => {
            const messages = [{ role: 'user', content: 'Hello' }];
            const body = backend.buildRequestBody(messages, {});

            expect(body.contents).toBeDefined();
            expect(body.contents).toHaveLength(1);
        });

        it('should include system instruction when provided', () => {
            const messages = [{ role: 'user', content: 'Hello' }];
            const body = backend.buildRequestBody(messages, { systemPrompt: 'Be helpful' });

            expect(body.systemInstruction).toEqual({
                parts: [{ text: 'Be helpful' }]
            });
        });

        it('should include search grounding when enabled', () => {
            const messages = [{ role: 'user', content: 'Hello' }];
            const body = backend.buildRequestBody(messages, { enableSearch: true });

            expect(body.tools).toEqual([{ googleSearch: {} }]);
        });

        it('should include thinking config when enabled', () => {
            const messages = [{ role: 'user', content: 'Hello' }];
            const body = backend.buildRequestBody(messages, { includeThinking: true });

            expect(body.generationConfig).toEqual({
                thinkingConfig: { includeThoughts: true }
            });
        });
    });

    describe('streamChat', () => {
        it('should stream response chunks', async () => {
            const mockChunks = [
                { candidates: [{ content: { parts: [{ thought: true, text: 'Thinking...' }] } }] },
                { candidates: [{ content: { parts: [{ text: 'Hello!' }] } }] }
            ];
            mockFetch(createMockSSEResponse(mockChunks));

            const chunks = [];
            for await (const chunk of backend.streamChat([{ role: 'user', content: 'Hi' }])) {
                chunks.push(chunk);
            }

            expect(chunks).toHaveLength(2);
            expect(chunks[0].thought).toBe(true);
            expect(chunks[0].text).toBe('Thinking...');
            expect(chunks[1].thought).toBe(false);
            expect(chunks[1].text).toBe('Hello!');
        });

        it('should call correct API endpoint', async () => {
            mockFetch(createMockSSEResponse([]));

            await backend.streamChat([{ role: 'user', content: 'Hi' }]).next();

            expect(fetch).toHaveBeenCalledWith(
                'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:streamGenerateContent?alt=sse',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        'x-goog-api-key': 'test-api-key'
                    })
                })
            );
        });

        it('should include search grounding in request when enabled', async () => {
            mockFetch(createMockSSEResponse([]));

            await backend.streamChat(
                [{ role: 'user', content: 'Search something' }],
                { enableSearch: true }
            ).next();

            const callBody = JSON.parse(fetch.mock.calls[0][1].body);
            expect(callBody.tools).toEqual([{ googleSearch: {} }]);
        });

        it('should handle API errors', async () => {
            mockFetch(createMockErrorResponse(401, 'Invalid API key'));

            await expect(
                backend.streamChat([{ role: 'user', content: 'Hi' }]).next()
            ).rejects.toThrow('Invalid API key');
        });

        it('should handle network errors', async () => {
            global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

            await expect(
                backend.streamChat([{ role: 'user', content: 'Hi' }]).next()
            ).rejects.toThrow('Network error');
        });

        it('should handle grounding metadata', async () => {
            const mockChunks = [
                {
                    candidates: [{
                        content: { parts: [{ text: 'Based on search...' }] },
                        groundingMetadata: {
                            searchEntryPoint: { renderedContent: '<div>Search results</div>' },
                            groundingChunks: [{ web: { uri: 'https://example.com' } }]
                        }
                    }]
                }
            ];
            mockFetch(createMockSSEResponse(mockChunks));

            const chunks = [];
            for await (const chunk of backend.streamChat([{ role: 'user', content: 'Search' }])) {
                chunks.push(chunk);
            }

            // Should have text chunk and search results chunk
            const searchChunk = chunks.find(c => c.searchResults);
            expect(searchChunk).toBeDefined();
            expect(searchChunk.searchResults).toContain('Search results');
        });
    });
});
