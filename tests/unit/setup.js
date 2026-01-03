/**
 * Jest setup file for polyfills
 */
import { TextEncoder, TextDecoder } from 'util';

// Polyfill TextEncoder/TextDecoder
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Response and ReadableStream polyfills for jsdom
if (typeof Response === 'undefined') {
    global.Response = class Response {
        constructor(body, init = {}) {
            this.body = body;
            this.status = init.status || 200;
            this.ok = this.status >= 200 && this.status < 300;
            this._headers = init.headers || {};
        }

        get headers() {
            return {
                get: (key) => this._headers[key]
            };
        }

        async json() {
            if (typeof this.body === 'string') {
                return JSON.parse(this.body);
            }
            // Handle ReadableStream body
            if (this.body && typeof this.body.getReader === 'function') {
                const reader = this.body.getReader();
                const decoder = new TextDecoder();
                let result = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    result += decoder.decode(value, { stream: true });
                }
                return JSON.parse(result);
            }
            return this.body;
        }

        async text() {
            if (typeof this.body === 'string') return this.body;
            // Handle ReadableStream body  
            if (this.body && typeof this.body.getReader === 'function') {
                const reader = this.body.getReader();
                const decoder = new TextDecoder();
                let result = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    result += decoder.decode(value, { stream: true });
                }
                return result;
            }
            return JSON.stringify(this.body);
        }
    };
}

if (typeof ReadableStream === 'undefined') {
    global.ReadableStream = class ReadableStream {
        constructor(source) {
            this._source = source;
            this._locked = false;
        }

        getReader() {
            this._locked = true;
            const source = this._source;
            let done = false;

            return {
                read: async () => {
                    if (done) return { done: true, value: undefined };
                    return new Promise((resolve) => {
                        source.pull({
                            enqueue: (value) => resolve({ done: false, value }),
                            close: () => {
                                done = true;
                                resolve({ done: true, value: undefined });
                            }
                        });
                    });
                },
                releaseLock: () => { this._locked = false; }
            };
        }
    };
}
