/**
 * Chrome API Mock for Jest testing
 */
import { jest } from '@jest/globals';

// Mock chrome.storage.local
const mockStorage = {};

global.chrome = {
    storage: {
        local: {
            get: jest.fn((keys, callback) => {
                if (typeof keys === 'function') {
                    callback = keys;
                    keys = null;
                }
                const result = {};
                if (keys) {
                    const keyArray = Array.isArray(keys) ? keys : [keys];
                    for (const key of keyArray) {
                        if (mockStorage[key] !== undefined) {
                            result[key] = mockStorage[key];
                        }
                    }
                } else {
                    Object.assign(result, mockStorage);
                }
                if (callback) {
                    callback(result);
                }
                return Promise.resolve(result);
            }),
            set: jest.fn((items, callback) => {
                Object.assign(mockStorage, items);
                if (callback) {
                    callback();
                }
                return Promise.resolve();
            }),
            clear: jest.fn((callback) => {
                Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
                if (callback) {
                    callback();
                }
                return Promise.resolve();
            })
        }
    },
    tabs: {
        query: jest.fn().mockResolvedValue([{ id: 1, url: 'https://example.com' }])
    },
    scripting: {
        executeScript: jest.fn().mockResolvedValue([{
            result: {
                title: 'Test Page',
                url: 'https://example.com',
                content: 'Test content'
            }
        }])
    },
    sidePanel: {
        open: jest.fn().mockResolvedValue(undefined),
        setOptions: jest.fn().mockResolvedValue(undefined),
        setPanelBehavior: jest.fn().mockResolvedValue(undefined)
    },
    runtime: {
        lastError: null,
        onInstalled: {
            addListener: jest.fn()
        }
    }
};

// Helper to reset mocks
global.resetChromeMocks = () => {
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    jest.clearAllMocks();
};

// Helper to set mock storage
global.setMockStorage = (data) => {
    Object.assign(mockStorage, data);
};
