/**
 * Fetch API Mock for SSE streaming tests
 */
import { jest } from '@jest/globals';

/**
 * Create a mock SSE Response with given chunks
 * @param {Array} chunks - Array of objects to send as SSE data
 * @returns {Response} Mock Response with SSE stream
 */
export function createMockSSEResponse(chunks) {
    const encoder = new TextEncoder();
    let chunkIndex = 0;

    const stream = new ReadableStream({
        pull(controller) {
            if (chunkIndex < chunks.length) {
                const data = `data: ${JSON.stringify(chunks[chunkIndex])}\n\n`;
                controller.enqueue(encoder.encode(data));
                chunkIndex++;
            } else {
                // Send [DONE] signal
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
            }
        }
    });

    return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' }
    });
}

/**
 * Create a mock error Response
 * @param {number} status - HTTP status code
 * @param {string} message - Error message
 * @returns {Response} Mock error Response
 */
export function createMockErrorResponse(status, message) {
    return new Response(
        JSON.stringify({ error: { message } }),
        { status, headers: { 'Content-Type': 'application/json' } }
    );
}

/**
 * Mock fetch globally
 * @param {Response|Function} responseOrFn - Response or function returning Response
 */
export function mockFetch(responseOrFn) {
    global.fetch = jest.fn().mockImplementation((...args) => {
        if (typeof responseOrFn === 'function') {
            return Promise.resolve(responseOrFn(...args));
        }
        return Promise.resolve(responseOrFn);
    });
}

/**
 * Restore original fetch
 */
export function restoreFetch() {
    if (global._originalFetch) {
        global.fetch = global._originalFetch;
    }
}

// Save original fetch
if (typeof global.fetch !== 'undefined') {
    global._originalFetch = global.fetch;
}
