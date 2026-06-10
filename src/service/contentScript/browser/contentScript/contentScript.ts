import { IContentScriptService, IToggleConfig } from '@/service/common/contentScript';
import { Service, Inject } from 'typedi';
import styles from '@/service/contentScript/browser/contentScript/contentScript.less';
import * as QRCode from 'qrcode';
import { Readability } from '@web-clipper/readability';
import AreaSelector from '@web-clipper/area-selector';
import Highlighter from '@web-clipper/highlight';
import plugins from '@web-clipper/turndown';
import TurndownService from 'turndown';
import { ContentScriptContext } from '@/extensions/common';
import { localStorageService } from '@/common/chrome/storage';
import { LOCAL_USER_PREFERENCE_LOCALE_KEY } from '@/common/types';
import { IExtensionContainer } from '@/service/common/extension';
import { getResourcePath } from '@/common/getResource';

const turndownService = new TurndownService({ codeBlockStyle: 'fenced' });
turndownService.use(plugins);

// Extend lazy-load image support: many websites use custom attribute names
// for lazy-loaded images (data-lazy-src, data-original, data-echo, etc.).
// The base @web-clipper/turndown plugin only handles data-src and data-original-src.
// This rule covers additional common patterns.
const LAZY_ATTRS = [
  'data-lazy-src',
  'data-original',
  'data-real-src',
  'data-lazy',
  'data-lazyload',
  'data-echo',
  'data-original-src',
  'data-src',
];
turndownService.addRule('extendedLazyLoadImage', {
  filter: ['img'],
  replacement: function (_content: string, node: Node) {
    const img = node as HTMLElement;
    if (!(img instanceof HTMLElement)) return '';

    // Check lazy-load attributes first (most common before src is set)
    for (const attr of LAZY_ATTRS) {
      const url = img.getAttribute(attr);
      if (url) {
        const resolved = resolveUrl(url);
        if (resolved) return `![](${resolved})\n`;
      }
    }

    // Check srcset (responsive images)
    const srcset = img.getAttribute('srcset');
    if (srcset) {
      // Pick the largest resolution from srcset
      const candidates = srcset.split(',').map(s => s.trim());
      let bestUrl = '';
      let bestWidth = 0;
      for (const c of candidates) {
        const parts = c.split(/\s+/);
        const url = parts[0];
        const descriptor = parts[1] || '';
        const width = parseInt(descriptor.replace(/[^0-9]/g, ''), 10) || 0;
        if (width >= bestWidth) {
          bestUrl = url;
          bestWidth = width;
        }
      }
      // Fallback: if srcset parsed but no width info, use last URL
      if (!bestUrl && candidates.length > 0) {
        bestUrl = candidates[candidates.length - 1].split(/\s+/)[0];
      }
      if (bestUrl) {
        const resolved = resolveUrl(bestUrl);
        if (resolved) return `![](${resolved})\n`;
      }
    }

    // Finally, check the actual src attribute
    const src = img.getAttribute('src');
    if (src) {
      const resolved = resolveUrl(src);
      if (resolved) return `![](${resolved})\n`;
    }

    return '';
  },
});

/** Resolve relative URLs to absolute */
function resolveUrl(url: string): string | null {
  if (!url) return null;
  if (url.startsWith('//')) return window.location.protocol + url;
  if (url.startsWith('/')) return window.location.origin + url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Relative path — resolve against current page URL
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return null;
  }
}

// Strip javascript: and empty anchor links — these are UI navigation elements,
// never actual content. Converts them to plain text instead of markdown links.
// e.g. <a href="javascript:void(0)">关注</a> → 关注 (not [关注](javascript:void(0)))
function stripLink(targetUrl: string): boolean {
  if (!targetUrl || targetUrl === '#') return true;
  if (/^javascript\s*:/i.test(targetUrl)) return true;
  if (/^mailto:/i.test(targetUrl)) return false; // valid email links
  if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) return false;
  if (targetUrl.startsWith('/')) return false; // relative URL
  return false;
}

// Turndown's built-in cleanAttribute strips newlines from HTML attributes.
// Without this, href values with embedded newlines produce markdown like
// [text](url\nwith\nbreak) which the Notion parser can't handle.
function cleanAttr(val: string | null): string {
  return val ? val.replace(/\n+/g, '') : '';
}

turndownService.addRule('stripJunkLinks', {
  filter: ['a'],
  replacement: function (content: string, node: Node) {
    const el = node as HTMLElement;
    if (!(el instanceof HTMLElement)) return content || '';
    const href = cleanAttr(el.getAttribute('href'));
    // Resolve relative URLs to absolute (same as image handling)
    const resolvedHref = resolveUrl(href);

    // If the <a> tag has a JS/empty href but a data-href/data-url with
    // the real URL, use that instead. Common on SPA sites where the
    // actual destination is stored in a data attribute.
    if (stripLink(resolvedHref)) {
      const dataUrl =
        el.getAttribute('data-href') ||
        el.getAttribute('data-url') ||
        el.getAttribute('data-link');
      if (dataUrl) {
        const resolvedDataUrl = resolveUrl(dataUrl);
        if (resolvedDataUrl && !stripLink(resolvedDataUrl)) {
          return '[' + content + '](' + resolvedDataUrl + ')\n';
        }
      }
      return content || '';
    }
    // Keep valid links unchanged (preserve title attribute if present)
    const title = cleanAttr(el.getAttribute('title'));
    if (title) return '[' + content + '](' + resolvedHref + ' "' + title + '")';
    return '[' + content + '](' + resolvedHref + ')\n';
  },
});

/**
 * Extract a navigational URL from a non-<a> element by checking:
 * 1. onclick / onmousedown handlers (location.href, window.open, window.location)
 * 2. data-href, data-url, data-link attributes (common in SPA frameworks)
 * 3. href attribute on non-<a> elements (some SPAs put href on div/button)
 * 4. formaction on button elements (HTML5 form override)
 * 5. aria role="link" elements (accessibility pattern)
 *
 * This catches buttons, link cards, and styled clickable containers on sites
 * like Zhihu that use div/button + onclick instead of <a href>.
 */
function extractClickUrl(el: HTMLElement): string | null {
  // 1. Check data attributes first (fast, no regex needed)
  for (const attr of ['data-href', 'data-url', 'data-link', 'data-target-url', 'data-action']) {
    const val = el.getAttribute(attr);
    if (val && val.startsWith('http')) return val;
    if (val && val.startsWith('/')) return resolveUrl(val);
  }

  // 2. Check href on non-<a> elements (React Router / Vue Router sometimes
  //    renders href directly on div/button elements)
  if (el.tagName !== 'A') {
    const href = el.getAttribute('href');
    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
      const resolved = resolveUrl(href);
      if (resolved) return resolved;
    }
  }

  // 3. Check formaction on button elements
  if (el.tagName === 'BUTTON') {
    const formaction = el.getAttribute('formaction');
    if (formaction) {
      const resolved = resolveUrl(formaction);
      if (resolved) return resolved;
    }
  }

  // 4. Check aria role="link" elements (accessibility pattern)
  if (el.getAttribute('role') === 'link') {
    // Some role="link" elements store URL in aria-label or data attributes
    for (const attr of ['data-url', 'data-href', 'aria-label']) {
      const val = el.getAttribute(attr);
      if (val) {
        const resolved = resolveUrl(val);
        if (resolved) return resolved;
      }
    }
  }

  // 5. Check onclick handlers
  const onclick = el.getAttribute('onclick') || el.getAttribute('onmousedown');
  if (onclick) {
    // Match: location.href='...', location.href = "...", window.open('...', ...)
    const hrefMatch = onclick.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
    if (hrefMatch) return resolveUrl(hrefMatch[1]);
    const openMatch = onclick.match(/window\.open\s*\(\s*['"]([^'"]+)['"]/);
    if (openMatch) return resolveUrl(openMatch[1]);
    const assignMatch = onclick.match(/location\.assign\s*\(\s*['"]([^'"]+)['"]/);
    if (assignMatch) return resolveUrl(assignMatch[1]);
    const replaceMatch = onclick.match(/location\.replace\s*\(\s*['"]([^'"]+)['"]/);
    if (replaceMatch) return resolveUrl(replaceMatch[1]);
  }

  return null;
}

/**
 * Convert button/div/span/li elements with embedded navigational URLs to
 * markdown links. Catches link cards, SPA buttons, ARIA links across all sites.
 */
turndownService.addRule('clickableLink', {
  filter: ['button', 'div', 'span', 'li', 'section'],
  replacement: function (content: string, node: Node) {
    const el = node as HTMLElement;
    if (!(el instanceof HTMLElement) || !content.trim()) return content || '';

    // Skip elements that already contain <a> children (links already handled)
    if (el.querySelectorAll('a').length > 0) return content || '';

    const url = extractClickUrl(el);
    if (!url) return content || '';

    return '[' + content.trim() + '](' + url + ')\n';
  },
});
class ContentScriptService implements IContentScriptService {
  constructor(@Inject(IExtensionContainer) private extensionContainer: IExtensionContainer) {}

  async remove() {
    $(`.${styles.toolFrame}`).remove();
  }
  async hide() {
    $(`.${styles.toolFrame}`).hide();
  }
  async toggle(config: IToggleConfig) {
    const toolPath = getResourcePath('tool.html');
    let src = chrome.runtime.getURL(toolPath);
    if (config) {
      src = `${chrome.runtime.getURL(toolPath)}#${config.pathname}?${config.query}`;
    }
    if ($(`.${styles.toolFrame}`).length === 0) {
      if (config) {
        $('body').append(`<iframe src="${src}" class=${styles.toolFrame}></iframe>`);
        return;
      }
      $('body').append(`<iframe src="${src}" class=${styles.toolFrame}></iframe>`);
    } else {
      const srcRaw = $(`.${styles.toolFrame}`).attr('src');

      if (srcRaw !== src) {
        $(`.${styles.toolFrame}`).attr('src', src);
      }
      $(`.${styles.toolFrame}`).toggle();
    }
  }
  async getSelectionMarkdown() {
    let selection = document.getSelection();
    if (selection?.rangeCount) {
      let container = document.createElement('div');
      for (let i = 0, len = selection.rangeCount; i < len; ++i) {
        container.appendChild(selection.getRangeAt(i).cloneContents());
      }
      return turndownService.turndown(container.innerHTML);
    }
    return '';
  }
  async checkStatus() {
    return true;
  }
  async getPageUrl() {
    return location.href;
  }
  async toggleLoading() {
    const loadIngStyle = styles['web-clipper-loading-box'];
    if ($(`.${loadIngStyle}`).length === 0) {
      $('body').append(`
      <div class=${loadIngStyle}>
        <div class="web-clipper-loading">
          <div>
            <div class="line"></div>
            <div class="line"></div>
            <div class="line"></div>
            <div class="line"></div>
          </div>
        </div>
      </div>
      `);
    } else {
      $(`.${loadIngStyle}`).remove();
    }
  }

  async runScript(id: string, lifeCycle: 'run' | 'destroy') {
    const extensions = this.extensionContainer.extensions;
    const extension = extensions.find((o) => o.id === id);
    const lifeCycleFunc = extension?.extensionLifeCycle[lifeCycle];
    if (!lifeCycleFunc) {
      return;
    }
    await localStorageService.init();
    const toggleClipper = () => {
      $(`.${styles.toolFrame}`).toggle();
    };
    const context: ContentScriptContext = {
      locale: localStorageService.get(LOCAL_USER_PREFERENCE_LOCALE_KEY, navigator.language),
      turndown: turndownService,
      Highlighter: Highlighter,
      toggleClipper,
      Readability,
      document,
      AreaSelector,
      QRCode,
      $,
      toggleLoading: () => {
        this.toggleLoading();
      },
    };
    $(`.${styles.toolFrame}`).blur();
    return lifeCycleFunc(context);
  }
}

Service(IContentScriptService)(ContentScriptService);
