/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Initialize marked.js with highlight.js
 */
function initMarked() {
    if (typeof marked !== 'undefined' && !marked._configured) {
        marked.setOptions({
            gfm: true,           // GitHub Flavored Markdown
            breaks: true,        // Convert \n to <br>
            highlight: function (code, lang) {
                if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (e) {
                        console.warn('Highlight error:', e);
                    }
                }
                // Fallback to auto-detection or plain
                if (typeof hljs !== 'undefined') {
                    try {
                        return hljs.highlightAuto(code).value;
                    } catch (e) {
                        console.warn('Highlight auto error:', e);
                    }
                }
                return escapeHtml(code);
            }
        });
        marked._configured = true;
    }
}

/**
 * Markdown to HTML converter
 * Uses marked.js for full GFM support including tables, code blocks, etc.
 * Falls back to simple parser if marked.js not available
 */
export function markdownToHtml(text) {
    if (!text) return '';

    // Try to use marked.js if available
    if (typeof marked !== 'undefined') {
        initMarked();
        try {
            return marked.parse(text);
        } catch (e) {
            console.warn('Marked parse error, falling back to simple parser:', e);
        }
    }

    // Fallback: Simple markdown parser
    let html = escapeHtml(text);

    // Code blocks (must be first)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Line breaks (double newline = paragraph)
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    // Wrap in paragraph
    html = `<p>${html}</p>`;

    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[123]>)/g, '$1');
    html = html.replace(/(<\/h[123]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<pre>)/g, '$1');
    html = html.replace(/(<\/pre>)<\/p>/g, '$1');

    return html;
}

/**
 * Extract text content from current tab
 */
export async function extractPageContent() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return null;

        // Skip chrome:// and other restricted URLs
        if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
            return null;
        }

        const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                // Get main content, preferring article or main elements
                const selectors = ['article', 'main', '[role="main"]', '.content', '#content', 'body'];
                let content = '';

                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        content = element.innerText;
                        break;
                    }
                }

                // Limit content length
                const maxLength = 10000;
                if (content.length > maxLength) {
                    content = content.substring(0, maxLength) + '...[truncated]';
                }

                return {
                    title: document.title,
                    url: window.location.href,
                    content: content.trim()
                };
            }
        });

        return result?.[0]?.result || null;
    } catch (error) {
        // Ignore errors for restricted pages (e.g. Chrome Web Store, chrome:// pages)
        if (error.message && error.message.includes('cannot be scripted')) {
            // Silently ignore restricted pages
            return null;
        }
        console.error('Failed to extract page content:', error);
        return null;
    }
}

/**
 * Auto-resize textarea based on content
 */
export function autoResizeTextarea(textarea) {
    const maxHeight = 150;
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = newHeight + 'px';

    // Toggle overflow class based on whether content exceeds max height
    if (textarea.scrollHeight > maxHeight) {
        textarea.classList.add('has-overflow');
    } else {
        textarea.classList.remove('has-overflow');
    }
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Generate unique ID
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
