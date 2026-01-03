import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Side Panel UI', () => {
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

        // Wait for extension to load and get ID
        await context.waitForEvent('serviceworker');
        const [background] = context.serviceWorkers();
        extensionId = background.url().split('/')[2];
    });

    test.afterAll(async () => {
        await context.close();
    });

    test('should display chat interface elements', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        await expect(page.locator('#chat-messages')).toBeVisible();
        await expect(page.locator('#message-input')).toBeVisible();
        await expect(page.locator('#send-button')).toBeVisible();
        await expect(page.locator('#model-select')).toBeVisible();
        await expect(page.locator('#settings-button')).toBeVisible();
        await expect(page.locator('#new-chat-button')).toBeVisible();
    });

    test('should display welcome message initially', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        await expect(page.locator('.welcome-message')).toBeVisible();
        await expect(page.locator('.welcome-message h2')).toContainText('Welcome');
    });

    test('should have send button disabled when input is empty', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        await expect(page.locator('#send-button')).toBeDisabled();
    });

    test('should enable send button when input has text', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        await page.fill('#message-input', 'Hello');
        await expect(page.locator('#send-button')).toBeEnabled();
    });

    test('should open settings modal', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        await page.click('#settings-button');
        await expect(page.locator('#settings-modal')).toBeVisible();
    });

    test('should close settings modal on cancel', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        await page.click('#settings-button');
        await expect(page.locator('#settings-modal')).toBeVisible();

        await page.click('#cancel-settings');
        await expect(page.locator('#settings-modal')).not.toBeVisible();
    });

    test('should close settings modal on X button', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        await page.click('#settings-button');
        await page.click('#close-settings');
        await expect(page.locator('#settings-modal')).not.toBeVisible();
    });

    test('should clear chat on new chat button', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        // Remove welcome message first by adding a message
        await page.evaluate(() => {
            const chatMessages = document.getElementById('chat-messages');
            chatMessages.innerHTML = '<div class="message user">Test message</div>';
        });

        // Click new chat
        await page.click('#new-chat-button');

        // Welcome message should be back
        await expect(page.locator('.welcome-message')).toBeVisible();
    });

    test('should have include page checkbox', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        const checkbox = page.locator('#include-page');
        await expect(checkbox).toBeVisible();
        await expect(checkbox).toBeChecked();
    });
});
