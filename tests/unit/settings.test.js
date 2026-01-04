import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { SettingsManager, defaultSettings } from '../../src/settings.js';

describe('SettingsManager', () => {
    beforeEach(() => {
        global.resetChromeMocks();
    });

    describe('defaultSettings', () => {
        it('should have expected structure', () => {
            expect(defaultSettings.backendType).toBe('gemini');
            expect(defaultSettings.gemini).toBeDefined();
            expect(defaultSettings.openai).toBeDefined();
            expect(defaultSettings.gemini.models).toContain('gemini-3-pro-preview');
        });
    });

    describe('load', () => {
        it('should return default settings when storage is empty', async () => {
            chrome.storage.local.get.mockImplementation((keys, callback) => {
                callback({});
            });

            const settings = await SettingsManager.load();

            expect(settings.backendType).toBe('gemini');
            expect(settings.gemini.models).toContain('gemini-3-pro-preview');
        });

        it('should merge stored settings with defaults', async () => {
            chrome.storage.local.get.mockImplementation((keys, callback) => {
                callback({
                    settings: { backendType: 'openai', systemPrompt: 'Custom prompt' }
                });
            });

            const settings = await SettingsManager.load();

            expect(settings.backendType).toBe('openai');
            expect(settings.systemPrompt).toBe('Custom prompt');
            expect(settings.gemini.models).toBeDefined(); // Default preserved
        });

        it('should set default currentModel if not set', async () => {
            chrome.storage.local.get.mockImplementation((keys, callback) => {
                callback({});
            });

            const settings = await SettingsManager.load();

            expect(settings.currentModel).toBe('gemini-3-pro-preview');
        });
    });

    describe('save', () => {
        it('should save settings to chrome.storage', async () => {
            const settings = { backendType: 'gemini', apiKey: 'test' };

            await SettingsManager.save(settings);

            expect(chrome.storage.local.set).toHaveBeenCalledWith(
                { settings },
                expect.any(Function)
            );
        });

        it('should reject on storage error', async () => {
            chrome.runtime.lastError = { message: 'Storage error' };
            chrome.storage.local.set.mockImplementation((items, callback) => {
                callback();
            });

            await expect(SettingsManager.save({})).rejects.toThrow('Storage error');

            chrome.runtime.lastError = null;
        });
    });

    describe('getBackendConfig', () => {
        it('should return gemini config when gemini is selected', () => {
            const settings = {
                ...defaultSettings,
                backendType: 'gemini',
                currentModel: 'gemini-2.5-pro'
            };

            const config = SettingsManager.getBackendConfig(settings);

            expect(config.type).toBe('gemini');
            expect(config.apiUrl).toBe(defaultSettings.gemini.apiUrl);
            expect(config.model).toBe('gemini-2.5-pro');
        });

        it('should return openai config when openai is selected', () => {
            const settings = {
                ...defaultSettings,
                backendType: 'openai',
                currentModel: 'llama3'
            };

            const config = SettingsManager.getBackendConfig(settings);

            expect(config.type).toBe('openai');
            expect(config.apiUrl).toBe(defaultSettings.openai.apiUrl);
            expect(config.model).toBe('llama3');
        });

        it('should fallback to first model if currentModel not set', () => {
            const settings = {
                ...defaultSettings,
                backendType: 'gemini',
                currentModel: ''
            };

            const config = SettingsManager.getBackendConfig(settings);

            expect(config.model).toBe('gemini-3-pro-preview');
        });
    });

    describe('addModel', () => {
        it('should add model to the current backend', () => {
            const settings = {
                backendType: 'gemini',
                gemini: { models: ['model1'] },
                openai: { models: [] }
            };

            const updated = SettingsManager.addModel(settings, 'model2');

            expect(updated.gemini.models).toContain('model2');
        });

        it('should not add duplicate models', () => {
            const settings = {
                backendType: 'gemini',
                gemini: { models: ['model1'] }
            };

            const updated = SettingsManager.addModel(settings, 'model1');

            expect(updated.gemini.models).toHaveLength(1);
        });

        it('should add to openai models when openai is selected', () => {
            const settings = {
                backendType: 'openai',
                gemini: { models: [] },
                openai: { models: ['llama3'] }
            };

            const updated = SettingsManager.addModel(settings, 'mistral');

            expect(updated.openai.models).toContain('mistral');
        });
    });

    describe('removeModel', () => {
        it('should remove model from the current backend', () => {
            const settings = {
                backendType: 'gemini',
                currentModel: 'model1',
                gemini: { models: ['model1', 'model2'] }
            };

            const updated = SettingsManager.removeModel(settings, 'model2');

            expect(updated.gemini.models).not.toContain('model2');
            expect(updated.gemini.models).toContain('model1');
        });

        it('should update currentModel if removed model was selected', () => {
            const settings = {
                backendType: 'gemini',
                currentModel: 'model1',
                gemini: { models: ['model1', 'model2'] }
            };

            const updated = SettingsManager.removeModel(settings, 'model1');

            expect(updated.currentModel).toBe('model2');
        });

        it('should set currentModel to empty if no models left', () => {
            const settings = {
                backendType: 'gemini',
                currentModel: 'model1',
                gemini: { models: ['model1'] }
            };

            const updated = SettingsManager.removeModel(settings, 'model1');

            expect(updated.currentModel).toBe('');
        });
    });

    describe('validateApiUrl', () => {
        it('should validate correct URLs', () => {
            expect(SettingsManager.validateApiUrl('https://api.example.com').valid).toBe(true);
            expect(SettingsManager.validateApiUrl('http://localhost:8045').valid).toBe(true);
            expect(SettingsManager.validateApiUrl('http://192.168.1.100:8080/v1').valid).toBe(true);
        });

        it('should reject empty URLs', () => {
            expect(SettingsManager.validateApiUrl('').valid).toBe(false);
        });

        it('should reject invalid URLs', () => {
            expect(SettingsManager.validateApiUrl('not-a-url').valid).toBe(false);
        });

        it('should reject non-http protocols', () => {
            expect(SettingsManager.validateApiUrl('ftp://example.com').valid).toBe(false);
        });
    });

    describe('validate', () => {
        it('should validate gemini settings', () => {
            const settings = {
                backendType: 'gemini',
                gemini: {
                    apiUrl: 'https://api.example.com',
                    apiKey: 'test-key'
                }
            };

            const result = SettingsManager.validate(settings);

            expect(result.valid).toBe(true);
        });

        it('should require API key for gemini', () => {
            const settings = {
                backendType: 'gemini',
                gemini: {
                    apiUrl: 'https://api.example.com',
                    apiKey: ''
                }
            };

            const result = SettingsManager.validate(settings);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Gemini API Key is required');
        });

        it('should not require API key for openai (local)', () => {
            const settings = {
                backendType: 'openai',
                openai: {
                    apiUrl: 'http://localhost:8045/v1',
                    apiKey: ''
                }
            };

            const result = SettingsManager.validate(settings);

            expect(result.valid).toBe(true);
        });

        it('should validate API URL format', () => {
            const settings = {
                backendType: 'gemini',
                gemini: {
                    apiUrl: 'invalid-url',
                    apiKey: 'test-key'
                }
            };

            const result = SettingsManager.validate(settings);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('URL'))).toBe(true);
        });
    });

    describe('getDefaults', () => {
        it('should return a deep copy of default settings', () => {
            const defaults1 = SettingsManager.getDefaults();
            const defaults2 = SettingsManager.getDefaults();

            expect(defaults1).toEqual(defaults2);
            expect(defaults1).not.toBe(defaults2); // Different object references
            expect(defaults1.gemini).not.toBe(defaults2.gemini);
            expect(defaults1.gemini.models).not.toBe(defaults2.gemini.models);
        });

        it('should not be affected by mutations', () => {
            const defaults1 = SettingsManager.getDefaults();
            defaults1.gemini.models.push('mutated-model');
            defaults1.backendType = 'modified';

            const defaults2 = SettingsManager.getDefaults();

            expect(defaults2.backendType).toBe('gemini');
            expect(defaults2.gemini.models).not.toContain('mutated-model');
        });

        it('should have all required fields', () => {
            const defaults = SettingsManager.getDefaults();

            expect(defaults).toHaveProperty('backendType');
            expect(defaults).toHaveProperty('theme');
            expect(defaults).toHaveProperty('gemini');
            expect(defaults).toHaveProperty('openai');
            expect(defaults).toHaveProperty('currentModel');
            expect(defaults).toHaveProperty('systemPrompt');
            expect(defaults).toHaveProperty('enableSearch');
            expect(defaults).toHaveProperty('includeThinking');
            expect(defaults).toHaveProperty('autoIncludePage');
            expect(defaults.gemini).toHaveProperty('apiUrl');
            expect(defaults.gemini).toHaveProperty('apiKey');
            expect(defaults.gemini).toHaveProperty('models');
            expect(defaults.openai).toHaveProperty('apiUrl');
            expect(defaults.openai).toHaveProperty('apiKey');
            expect(defaults.openai).toHaveProperty('models');
        });
    });

    describe('deepMerge', () => {
        it('should merge nested objects correctly', () => {
            const target = { a: 1, b: { c: 2, d: 3 } };
            const source = { b: { c: 5 }, e: 6 };

            const result = SettingsManager.deepMerge(target, source);

            expect(result).toEqual({ a: 1, b: { c: 5, d: 3 }, e: 6 });
        });

        it('should not mutate the original objects', () => {
            const target = { a: 1, b: { c: 2 } };
            const source = { b: { c: 5 } };

            SettingsManager.deepMerge(target, source);

            expect(target.b.c).toBe(2);
        });

        it('should handle arrays by replacing them', () => {
            const target = { models: ['a', 'b'] };
            const source = { models: ['c', 'd', 'e'] };

            const result = SettingsManager.deepMerge(target, source);

            expect(result.models).toEqual(['c', 'd', 'e']);
        });
    });

    describe('integration scenarios', () => {
        it('should handle full settings lifecycle', async () => {
            // 1. Load defaults
            chrome.storage.local.get.mockImplementation((keys, callback) => {
                callback({});
            });

            const initial = await SettingsManager.load();
            expect(initial.backendType).toBe('gemini');

            // 2. Modify and save
            const modified = { ...initial, backendType: 'openai', systemPrompt: 'Test' };
            await SettingsManager.save(modified);

            expect(chrome.storage.local.set).toHaveBeenCalledWith(
                { settings: modified },
                expect.any(Function)
            );

            // 3. Load modified settings
            chrome.storage.local.get.mockImplementation((keys, callback) => {
                callback({ settings: modified });
            });

            const loaded = await SettingsManager.load();
            expect(loaded.backendType).toBe('openai');
            expect(loaded.systemPrompt).toBe('Test');
        });

        it('should correctly get backend config after switching backends', () => {
            const settings = {
                backendType: 'openai',
                gemini: { apiUrl: 'gemini-url', apiKey: 'gemini-key', models: ['gmodel'] },
                openai: { apiUrl: 'openai-url', apiKey: 'openai-key', models: ['omodel'] },
                currentModel: 'omodel'
            };

            const config = SettingsManager.getBackendConfig(settings);

            expect(config.apiUrl).toBe('openai-url');
            expect(config.apiKey).toBe('openai-key');
            expect(config.models).toEqual(['omodel']);
        });

        it('should add and remove models correctly', () => {
            const settings = {
                backendType: 'gemini',
                gemini: { models: ['model1', 'model2'] },
                openai: { models: ['model3'] },
                currentModel: 'model1'
            };

            // Add model
            const afterAdd = SettingsManager.addModel(settings, 'model-new');
            expect(afterAdd.gemini.models).toContain('model-new');
            expect(afterAdd.gemini.models).toHaveLength(3);

            // Remove model
            const afterRemove = SettingsManager.removeModel(afterAdd, 'model1');
            expect(afterRemove.gemini.models).not.toContain('model1');
            expect(afterRemove.currentModel).toBe('model2'); // Updated to next model
        });

        it('should validate model list is not empty after removal', () => {
            const settings = {
                backendType: 'gemini',
                gemini: { apiUrl: 'http://test.com', apiKey: 'key', models: ['only-model'] },
                currentModel: 'only-model'
            };

            const afterRemove = SettingsManager.removeModel(settings, 'only-model');

            // Should set currentModel to empty when no models left
            expect(afterRemove.currentModel).toBe('');
        });
    });
});
