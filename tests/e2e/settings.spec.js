import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Settings UI', () => {
    let context;
    let extensionId;

    test.beforeAll(async () => {
        const pathToExtension = path.resolve(__dirname, '../..');
        context = await chromium.launchPersistentContext('', {
            headless: false,
            args: [
                `--disable-extensions-except=${pathToExtension}`,
                `--load-extension=${pathToExtension}`
            ]
        });

        await context.waitForEvent('serviceworker');
        const [background] = context.serviceWorkers();
        extensionId = background.url().split('/')[2];
    });

    test.afterAll(async () => {
        await context.close();
    });

    test('should display all settings sections', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        await page.click('#settings-button');

        // Backend type radios
        await expect(page.locator('input[value="gemini"]')).toBeVisible();
        await expect(page.locator('input[value="openai"]')).toBeVisible();

        // Gemini settings visible by default
        await expect(page.locator('#gemini-settings')).toBeVisible();
        await expect(page.locator('#gemini-api-url')).toBeVisible();
        await expect(page.locator('#gemini-api-key')).toBeVisible();

        // System prompt
        await expect(page.locator('#system-prompt')).toBeVisible();

        // Feature toggles
        await expect(page.locator('#enable-search')).toBeVisible();
        await expect(page.locator('#include-thinking')).toBeVisible();
        await expect(page.locator('#auto-include-page')).toBeVisible();
    });

    test('should switch backend settings visibility', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        await page.click('#settings-button');

        // Initially Gemini is selected
        await expect(page.locator('#gemini-settings')).toBeVisible();
        await expect(page.locator('#openai-settings')).not.toBeVisible();

        // Switch to OpenAI
        await page.click('input[value="openai"]');

        await expect(page.locator('#gemini-settings')).not.toBeVisible();
        await expect(page.locator('#openai-settings')).toBeVisible();

        // Switch back to Gemini
        await page.click('input[value="gemini"]');

        await expect(page.locator('#gemini-settings')).toBeVisible();
        await expect(page.locator('#openai-settings')).not.toBeVisible();
    });

    test('should add new model to list', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        await page.click('#settings-button');

        // Add a custom model
        await page.fill('#gemini-new-model', 'custom-model-test');
        await page.click('#gemini-add-model');

        // Model should appear in list
        await expect(page.locator('#gemini-models .model-item:has-text("custom-model-test")')).toBeVisible();

        // Input should be cleared
        expect(await page.inputValue('#gemini-new-model')).toBe('');
    });

    test('should remove model from list', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        await page.click('#settings-button');

        // Add a model first
        await page.fill('#gemini-new-model', 'model-to-remove');
        await page.click('#gemini-add-model');

        // Find and click the remove button
        const modelItem = page.locator('#gemini-models .model-item:has-text("model-to-remove")');
        await expect(modelItem).toBeVisible();

        await modelItem.locator('button').click();

        // Model should be removed
        await expect(modelItem).not.toBeVisible();
    });

    test('should show OpenAI settings with localhost hint', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        await page.click('#settings-button');
        await page.click('input[value="openai"]');

        // Should show hint about localhost support
        await expect(page.locator('.setting-hint')).toContainText('localhost');
    });

    test('should save and persist settings', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        await page.click('#settings-button');

        // Enter system prompt
        await page.fill('#system-prompt', 'Test system prompt for E2E');

        // Uncheck a feature
        await page.uncheck('#enable-search');

        // Save
        await page.click('#save-settings');

        // Modal should close
        await expect(page.locator('#settings-modal')).not.toBeVisible();

        // Reload and verify
        await page.reload();
        await page.click('#settings-button');

        expect(await page.inputValue('#system-prompt')).toBe('Test system prompt for E2E');
        await expect(page.locator('#enable-search')).not.toBeChecked();
    });

    test('should show error for invalid Gemini settings', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        await page.click('#settings-button');

        // Clear the API key
        await page.fill('#gemini-api-key', '');

        // Try to save
        await page.click('#save-settings');

        // Error should be shown
        await expect(page.locator('#settings-error')).toBeVisible();
        await expect(page.locator('#settings-error')).toContainText('API Key');
    });

    test('should allow OpenAI without API key', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        await page.click('#settings-button');

        // Switch to OpenAI
        await page.click('input[value="openai"]');

        // Leave API key empty
        await page.fill('#openai-api-key', '');

        // Save should work
        await page.click('#save-settings');

        // Modal should close (no error)
        await expect(page.locator('#settings-modal')).not.toBeVisible();
    });

    test('should validate API URL format', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        await page.click('#settings-button');

        // Enter invalid URL
        await page.fill('#gemini-api-url', 'not-a-valid-url');
        await page.fill('#gemini-api-key', 'test-key');

        // Try to save
        await page.click('#save-settings');

        // Error should be shown
        await expect(page.locator('#settings-error')).toBeVisible();
        await expect(page.locator('#settings-error')).toContainText('URL');
    });
});
