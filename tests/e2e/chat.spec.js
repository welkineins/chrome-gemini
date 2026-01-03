import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Chat Functionality', () => {
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

    test('should display user message when sent', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        // Set up API key first (mock won't work without it)
        await page.click('#settings-button');
        await page.fill('#gemini-api-key', 'test-api-key');
        await page.click('#save-settings');

        // Send a message
        await page.fill('#message-input', 'Hello AI');
        await page.click('#send-button');

        // User message should be visible
        await expect(page.locator('.message.user')).toBeVisible();
        await expect(page.locator('.message.user')).toContainText('Hello AI');
    });

    test('should clear input after sending', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        // Set up API key
        await page.click('#settings-button');
        await page.fill('#gemini-api-key', 'test-api-key');
        await page.click('#save-settings');

        await page.fill('#message-input', 'Test message');
        await page.click('#send-button');

        // Input should be cleared
        expect(await page.inputValue('#message-input')).toBe('');
    });

    test('should remove welcome message after first message', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        // Set up API key
        await page.click('#settings-button');
        await page.fill('#gemini-api-key', 'test-api-key');
        await page.click('#save-settings');

        // Welcome should be visible initially
        await expect(page.locator('.welcome-message')).toBeVisible();

        await page.fill('#message-input', 'Hello');
        await page.click('#send-button');

        // Welcome should be gone
        await expect(page.locator('.welcome-message')).not.toBeVisible();
    });

    test('should show loading indicator during response', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        // Set up API key
        await page.click('#settings-button');
        await page.fill('#gemini-api-key', 'test-api-key');
        await page.click('#save-settings');

        // Mock slow response
        await page.route('**/generativelanguage.googleapis.com/**', async route => {
            await new Promise(r => setTimeout(r, 500));
            route.fulfill({
                status: 200,
                contentType: 'text/event-stream',
                body: 'data: {"candidates":[{"content":{"parts":[{"text":"Response"}]}}]}\n\n'
            });
        });

        await page.fill('#message-input', 'Test');
        await page.click('#send-button');

        // Loading indicator should appear
        await expect(page.locator('.loading-indicator')).toBeVisible();
    });

    test('should display thinking section when present', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        // Set up API key
        await page.click('#settings-button');
        await page.fill('#gemini-api-key', 'test-api-key');
        await page.click('#save-settings');

        // Mock response with thinking
        await page.route('**/generativelanguage.googleapis.com/**', route => {
            route.fulfill({
                status: 200,
                contentType: 'text/event-stream',
                body: 'data: {"candidates":[{"content":{"parts":[{"thought":true,"text":"I am analyzing..."}]}}]}\n\ndata: {"candidates":[{"content":{"parts":[{"text":"Here is my answer"}]}}]}\n\n'
            });
        });

        await page.fill('#message-input', 'Test');
        await page.click('#send-button');

        // Wait for response
        await page.waitForSelector('.thinking-section');

        await expect(page.locator('.thinking-section')).toBeVisible();
        await expect(page.locator('.thinking-content')).toContainText('I am analyzing');
    });

    test('should toggle thinking section visibility', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        // Set up API key
        await page.click('#settings-button');
        await page.fill('#gemini-api-key', 'test-api-key');
        await page.click('#save-settings');

        // Mock response with thinking
        await page.route('**/generativelanguage.googleapis.com/**', route => {
            route.fulfill({
                status: 200,
                contentType: 'text/event-stream',
                body: 'data: {"candidates":[{"content":{"parts":[{"thought":true,"text":"Thinking..."}]}}]}\n\ndata: {"candidates":[{"content":{"parts":[{"text":"Answer"}]}}]}\n\n'
            });
        });

        await page.fill('#message-input', 'Test');
        await page.click('#send-button');

        await page.waitForSelector('.thinking-section');

        // Initially visible
        await expect(page.locator('.thinking-content')).toBeVisible();

        // Toggle to collapse
        await page.click('.thinking-toggle');
        await expect(page.locator('.thinking-content')).not.toBeVisible();

        // Toggle to expand
        await page.click('.thinking-toggle');
        await expect(page.locator('.thinking-content')).toBeVisible();
    });

    test('should display response content', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        // Set up API key
        await page.click('#settings-button');
        await page.fill('#gemini-api-key', 'test-api-key');
        await page.click('#save-settings');

        // Mock response
        await page.route('**/generativelanguage.googleapis.com/**', route => {
            route.fulfill({
                status: 200,
                contentType: 'text/event-stream',
                body: 'data: {"candidates":[{"content":{"parts":[{"text":"This is the AI response"}]}}]}\n\n'
            });
        });

        await page.fill('#message-input', 'Hello');
        await page.click('#send-button');

        // Wait for response
        await page.waitForSelector('.message.assistant .response-content');

        await expect(page.locator('.message.assistant .response-content')).toContainText('This is the AI response');
    });

    test('should handle streaming response incrementally', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        // Set up API key
        await page.click('#settings-button');
        await page.fill('#gemini-api-key', 'test-api-key');
        await page.click('#save-settings');

        // Mock streaming response with multiple chunks
        await page.route('**/generativelanguage.googleapis.com/**', route => {
            const body = [
                'data: {"candidates":[{"content":{"parts":[{"text":"Hello "}]}}]}\n\n',
                'data: {"candidates":[{"content":{"parts":[{"text":"World!"}]}}]}\n\n'
            ].join('');

            route.fulfill({
                status: 200,
                contentType: 'text/event-stream',
                body
            });
        });

        await page.fill('#message-input', 'Test');
        await page.click('#send-button');

        await page.waitForSelector('.message.assistant .response-content');

        // Final content should be concatenated
        await expect(page.locator('.message.assistant .response-content')).toContainText('Hello World!');
    });

    test('should display error message on API failure', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        // Set up API key
        await page.click('#settings-button');
        await page.fill('#gemini-api-key', 'invalid-key');
        await page.click('#save-settings');

        // Mock error response
        await page.route('**/generativelanguage.googleapis.com/**', route => {
            route.fulfill({
                status: 401,
                contentType: 'application/json',
                body: JSON.stringify({ error: { message: 'Invalid API key' } })
            });
        });

        await page.fill('#message-input', 'Test');
        await page.click('#send-button');

        // Wait for error
        await page.waitForSelector('.message.assistant .response-content');

        await expect(page.locator('.message.assistant .response-content')).toContainText('Error');
    });

    test('should send message on Enter key', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        // Set up API key
        await page.click('#settings-button');
        await page.fill('#gemini-api-key', 'test-api-key');
        await page.click('#save-settings');

        // Mock response
        await page.route('**/generativelanguage.googleapis.com/**', route => {
            route.fulfill({
                status: 200,
                contentType: 'text/event-stream',
                body: 'data: {"candidates":[{"content":{"parts":[{"text":"Response"}]}}]}\n\n'
            });
        });

        await page.fill('#message-input', 'Enter key test');
        await page.press('#message-input', 'Enter');

        // Message should be sent
        await expect(page.locator('.message.user')).toContainText('Enter key test');
    });

    test('should allow Shift+Enter for new line', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        await page.fill('#message-input', 'Line 1');
        await page.press('#message-input', 'Shift+Enter');
        await page.type('#message-input', 'Line 2');

        const value = await page.inputValue('#message-input');
        expect(value).toContain('Line 1');
        expect(value).toContain('Line 2');
    });
});
