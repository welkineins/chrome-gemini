/**
 * Default settings configuration
 */
export const defaultSettings = {
    backendType: 'gemini',
    gemini: {
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: '',
        models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash']
    },
    openai: {
        apiUrl: 'http://localhost:11434/v1',
        apiKey: '',
        models: ['llama3', 'codellama', 'mistral']
    },
    currentModel: '',
    systemPrompt: '',
    enableSearch: true,
    includeThinking: true,
    autoIncludePage: true
};

/**
 * Settings Manager for handling extension settings
 */
export class SettingsManager {
    /**
     * Deep merge two objects
     */
    static deepMerge(target, source) {
        const result = { ...target };
        for (const key of Object.keys(source)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        return result;
    }

    /**
     * Load settings from chrome.storage
     */
    static async load() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['settings'], (result) => {
                const stored = result.settings || {};
                const merged = this.deepMerge(defaultSettings, stored);

                // Ensure currentModel is set
                if (!merged.currentModel) {
                    const backend = merged[merged.backendType];
                    merged.currentModel = backend?.models?.[0] || '';
                }

                resolve(merged);
            });
        });
    }

    /**
     * Save settings to chrome.storage
     */
    static async save(settings) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set({ settings }, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Get current backend configuration
     */
    static getBackendConfig(settings) {
        const backendSettings = settings[settings.backendType];
        return {
            type: settings.backendType,
            apiUrl: backendSettings.apiUrl,
            apiKey: backendSettings.apiKey,
            model: settings.currentModel || backendSettings.models[0],
            models: backendSettings.models
        };
    }

    /**
     * Add a model to the current backend
     */
    static addModel(settings, modelName) {
        const backend = settings.backendType;
        const models = settings[backend].models;

        if (!models.includes(modelName)) {
            return {
                ...settings,
                [backend]: {
                    ...settings[backend],
                    models: [...models, modelName]
                }
            };
        }

        return settings;
    }

    /**
     * Remove a model from the current backend
     */
    static removeModel(settings, modelName) {
        const backend = settings.backendType;
        const models = settings[backend].models.filter(m => m !== modelName);

        let currentModel = settings.currentModel;
        if (currentModel === modelName) {
            currentModel = models[0] || '';
        }

        return {
            ...settings,
            currentModel,
            [backend]: {
                ...settings[backend],
                models
            }
        };
    }

    /**
     * Validate API URL format
     */
    static validateApiUrl(url) {
        if (!url) return { valid: false, error: 'URL is required' };

        try {
            const parsed = new URL(url);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return { valid: false, error: 'URL must use http or https protocol' };
            }
            return { valid: true };
        } catch (e) {
            return { valid: false, error: 'Invalid URL format' };
        }
    }

    /**
     * Validate settings before saving
     */
    static validate(settings) {
        const errors = [];

        // Validate Gemini settings
        if (settings.backendType === 'gemini') {
            const urlValidation = this.validateApiUrl(settings.gemini.apiUrl);
            if (!urlValidation.valid) {
                errors.push(`Gemini API URL: ${urlValidation.error}`);
            }
            if (!settings.gemini.apiKey) {
                errors.push('Gemini API Key is required');
            }
        }

        // Validate OpenAI settings
        if (settings.backendType === 'openai') {
            const urlValidation = this.validateApiUrl(settings.openai.apiUrl);
            if (!urlValidation.valid) {
                errors.push(`OpenAI API URL: ${urlValidation.error}`);
            }
            // API key is optional for local services like Ollama
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}
