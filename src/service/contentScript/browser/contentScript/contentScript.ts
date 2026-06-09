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
        const resolved = resolveImageUrl(url);
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
        const resolved = resolveImageUrl(bestUrl);
        if (resolved) return `![](${resolved})\n`;
      }
    }

    // Finally, check the actual src attribute
    const src = img.getAttribute('src');
    if (src) {
      const resolved = resolveImageUrl(src);
      if (resolved) return `![](${resolved})\n`;
    }

    return '';
  },
});

/** Resolve relative image URLs to absolute */
function resolveImageUrl(url: string): string | null {
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
  return false;
}

turndownService.addRule('stripJunkLinks', {
  filter: ['a'],
  replacement: function (content: string, node: Node) {
    const el = node as HTMLElement;
    if (!(el instanceof HTMLElement)) return content || '';
    const href = el.getAttribute('href') || '';
    // If it's a junk link, return just the text content without markdown link syntax
    if (stripLink(href)) return content || '';
    // Keep valid links unchanged (preserve title attribute if present)
    const title = el.getAttribute('title');
    if (title) return '[' + content + '](' + href + ' "' + title + '")';
    return '[' + content + '](' + href + ')';
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
