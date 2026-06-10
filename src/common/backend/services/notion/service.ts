import localeService from '@/common/locales';
import { generateUuid } from '@web-clipper/shared/lib/uuid';
import axios, { AxiosInstance } from 'axios';
import { CreateDocumentRequest, DocumentService } from '../../index';
import { CompleteStatus, HttpError } from './../interface';
import { NotionPage, NotionDatabase } from './types';

const API_BASE = 'https://api.notion.com';
const API_VERSION = '2022-06-28';

/**
 * Notion Document Service - uses official Notion API v1 with Integration Token auth.
 * 
 * Authentication:
 * 1. User creates a Notion Integration at https://www.notion.so/my-integrations
 * 2. User grants the Integration access to their workspace pages
 * 3. User provides the Integration's Internal Integration Token (secret_xxx)
 * 4. Token is used as Bearer token for all API calls
 */
export default class NotionDocumentService implements DocumentService {
  private request: AxiosInstance;
  private repositories: (NotionPage | NotionDatabase)[];
  private token: string;
  private id: string;

  constructor(info: { token: string }) {
    this.token = info?.token || '';
    this.repositories = [];
    // Generate a stable ID from the first 12 chars of the token
    // so the same integration always gets the same ID, and different
    // tokens get different IDs (allowing multiple Notion accounts).
    this.id = `notion_${this.token.slice(-12)}`;

    this.request = axios.create({
      baseURL: `${API_BASE}/v1/`,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'Notion-Version': API_VERSION,
      },
    });

    this.request.interceptors.response.use(
      (r) => r,
      (error) => {
        if (error.response) {
          const status = error.response.status;
          const body = error.response.data;

          if (status === 401) {
            return Promise.reject(
              new HttpError({
                message:
                  body?.message ||
                  localeService.format({
                    id: 'backend.services.notion.unauthorizedErrorMessage',
                    defaultMessage:
                      'Invalid Notion API token. Make sure your Integration Token starts with "secret_" and has been granted access to your workspace.',
                  }),
                status: 401,
              })
            );
          }

          if (status === 403) {
            return Promise.reject(
              new HttpError({
                message:
                  body?.message ||
                  'Access denied. Please make sure your Notion Integration has been shared with the target page or database.',
                status: 403,
              })
            );
          }

          if (status === 429) {
            return Promise.reject(
              new HttpError({
                message:
                  'Notion API rate limit exceeded. Please wait a moment and try again.',
                status: 429,
              })
            );
          }

          if (status === 400) {
            return Promise.reject(
              new HttpError({
                message:
                  body?.message ||
                  'Bad request (400). The API request format is invalid.',
                status: 400,
              })
            );
          }

          if (status === 404) {
            return Promise.reject(
              new HttpError({
                message:
                  body?.message ||
                  'Resource not found (404). The page or database may have been deleted.',
                status: 404,
              })
            );
          }
        }
        return Promise.reject(error);
      }
    );
  }

  getId = () => {
    return this.id;
  };

  getUserInfo = async () => {
    const response = await this.request.get<{
      id: string;
      name: string;
      avatar_url: string;
      type: string;
      person?: { email: string };
      bot?: { owner: { type: string } };
    }>('users/me');
    
    const data = response.data;
    return {
      name: data.name || 'Notion Integration',
      avatar: data.avatar_url || '',
      homePage: 'https://www.notion.so/',
      description: data.type === 'bot' ? 'Notion Integration (Bot)' : (data.person?.email || ''),
    };
  };

  getRepositories = async () => {
    // Single search call (no filter = returns both pages and databases)
    // Limited to 50 items (most recent) for speed — more than enough for target selection
    const response = await this.request.post<{
      results: any[];
      next_cursor: string | null;
      has_more: boolean;
    }>('search', {
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time',
      },
      page_size: 50,
    });

    const results: (NotionPage | NotionDatabase)[] = [];

    for (const item of response.data.results) {
      if (item.archived === false && item.object === 'page') {
        const title = this.extractPageTitle(item);
        if (title) {
          results.push({
            id: item.id,
            name: title,
            groupId: 'pages',
            groupName: '📄 Pages',
            object: 'page',
          });
        }
      } else if (item.archived === false && item.object === 'database') {
        const title = this.extractDatabaseTitle(item);
        if (title) {
          results.push({
            id: item.id,
            name: title,
            groupId: 'databases',
            groupName: '🗄️ Databases',
            object: 'database',
          });
        }
      }
    }

    this.repositories = results;
    return this.repositories;
  };

  createDocument = async ({
    repositoryId,
    title,
    content,
  }: CreateDocumentRequest): Promise<CompleteStatus> => {
    const repository = this.repositories.find((o) => o.id === repositoryId);
    if (!repository) {
      throw new Error(
        'Target not found. Please go to Preferences → Account and re-select a page or database.'
      );
    }

    // Convert markdown to Notion blocks
    const children = this.markdownToNotionBlocks(content);
    const MAX_BLOCKS_PER_REQUEST = 100;

    // Build parent: databases use database_id, pages use page_id
    const parent: any =
      repository.object === 'database'
        ? { database_id: repository.id }
        : { page_id: repository.id };

    // Notion databases require properties matching their schema.
    // Use the standard "Name" / "title" property — most databases have it.
    // If the database renamed this column, the API returns a 400 which
    // we propagate to the user so they can adjust.
    const pageBody: any = {
      parent,
      properties: {
        title: {
          title: [
            {
              type: 'text',
              text: {
                content: title || 'Untitled',
              },
            },
          ],
        },
      },
    };

    // Notion API: creating a page under a page supports 'children' inline,
    // but creating under a database does NOT — children are silently ignored.
    // So we always create the page first, then append blocks afterward.
    // Additionally, Notion limits each append to 100 blocks, so we batch.
    // Rate limit: ~3 req/s ceiling, so we add delay + retry on 429/5xx.
    const response = await this.request.post<{ id: string; url: string }>('pages', pageBody);
    const pageId = response.data.id;

    if (children.length > 0) {
      const APPEND_DELAY_MS = 350; // ~3 req/s ceiling
      const MAX_RETRIES = 3;
      let failedBatches = 0;

      for (let i = 0; i < children.length; i += MAX_BLOCKS_PER_REQUEST) {
        const batch = children.slice(i, i + MAX_BLOCKS_PER_REQUEST);
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            await this.request.patch(`blocks/${pageId}/children`, {
              children: batch,
            });
            break; // success, move to next batch
          } catch (error: any) {
            const isRateLimited = error?.response?.status === 429;
            const isTransient = error?.response?.status >= 500 || error?.code === 'ECONNABORTED';
            if (attempt < MAX_RETRIES && (isRateLimited || isTransient)) {
              // Exponential backoff: 1s, 2s, 4s for rate limits; 500ms, 1s, 2s for others
              const backoff = isRateLimited
                ? Math.pow(2, attempt) * 1000
                : attempt * 500;
              await new Promise(r => setTimeout(r, backoff));
              continue;
            }
            // Last attempt or non-retryable error — record and move on
            failedBatches++;
            console.warn(
              `[Notion] Failed to append blocks batch ${Math.floor(i / MAX_BLOCKS_PER_REQUEST) + 1}/${Math.ceil(children.length / MAX_BLOCKS_PER_REQUEST)}: ${error?.message || error}`
            );
            break;
          }
        }
        // Small delay between batches to stay under rate limit
        if (i + MAX_BLOCKS_PER_REQUEST < children.length) {
          await new Promise(r => setTimeout(r, APPEND_DELAY_MS));
        }
      }

      if (failedBatches > 0) {
        console.warn(
          `[Notion] ${failedBatches} batch(es) failed to append. Page ${pageId} may have incomplete content.`
        );
      }
    }

    return {
      href: response.data.url,
    };
  };

  /**
   * Extract page title from Notion API response
   */
  private extractPageTitle(page: any): string | null {
    try {
      if (page.properties?.title?.title?.[0]?.plain_text) {
        return page.properties.title.title[0].plain_text;
      }
      if (page.properties?.title?.title?.[0]?.text?.content) {
        return page.properties.title.title[0].text.content;
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  /**
   * Extract database title from Notion API response
   */
  private extractDatabaseTitle(database: any): string | null {
    try {
      if (database.title?.[0]?.plain_text) {
        return database.title[0].plain_text;
      }
      if (database.title?.[0]?.text?.content) {
        return database.title[0].text.content;
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  /**
   * Convert markdown text to Notion block objects
   * Supports: headings, paragraphs, code blocks, bullet lists, numbered lists, blockquotes, toggles
   */
  private markdownToNotionBlocks(markdown: string): any[] {
    const blocks: any[] = [];
    const lines = markdown.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines (but add a spacer paragraph for visual separation)
      if (!trimmed) {
        if (i > 0 && i < lines.length - 1) {
          // Only add spacer if it's between content
          const prevNonEmpty = lines.slice(0, i).reverse().find(l => l.trim());
          const nextNonEmpty = lines.slice(i + 1).find(l => l.trim());
          if (prevNonEmpty && nextNonEmpty) {
            blocks.push({
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [],
              },
            });
          }
        }
        i++;
        continue;
      }

      // Heading 1: # text
      if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
        blocks.push(this.createBlock('heading_1', this.parseRichText(trimmed.slice(2))));
        i++;
        continue;
      }

      // Heading 2: ## text
      if (trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
        blocks.push(this.createBlock('heading_2', this.parseRichText(trimmed.slice(3))));
        i++;
        continue;
      }

      // Heading 3: ### text
      if (trimmed.startsWith('### ')) {
        blocks.push(this.createBlock('heading_3', this.parseRichText(trimmed.slice(4))));
        i++;
        continue;
      }

      // Blockquote: > text
      if (trimmed.startsWith('> ')) {
        const quoteLines: string[] = [trimmed.slice(2)];
        i++;
        while (i < lines.length && lines[i].trim().startsWith('> ')) {
          quoteLines.push(lines[i].trim().slice(2));
          i++;
        }
        blocks.push({
          object: 'block',
          type: 'quote',
          quote: {
            rich_text: this.parseRichText(quoteLines.join('\n')),
          },
        });
        continue;
      }

      // Code block: ``` ... ```
      if (trimmed.startsWith('```')) {
        const lang = trimmed.slice(3).trim();
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // skip closing ```
        blocks.push({
          object: 'block',
          type: 'code',
          code: {
            rich_text: [
              {
                type: 'text',
                text: { content: codeLines.join('\n') },
              },
            ],
            language: lang || 'plain text',
          },
        });
        continue;
      }

      // Bullet list: - item or * item
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const listItems: string[] = [];
        while (i < lines.length) {
          const t = lines[i].trim();
          if (t.startsWith('- ') || t.startsWith('* ')) {
            listItems.push(t.slice(2));
            i++;
          } else if (!t) {
            i++;
            break;
          } else {
            break;
          }
        }
        for (const item of listItems) {
          blocks.push({
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: this.parseRichText(item),
            },
          });
        }
        continue;
      }

      // Numbered list: 1. item
      if (/^\d+\.\s/.test(trimmed)) {
        const listItems: string[] = [];
        while (i < lines.length) {
          const t = lines[i].trim();
          if (/^\d+\.\s/.test(t)) {
            listItems.push(t.replace(/^\d+\.\s/, ''));
            i++;
          } else if (!t) {
            i++;
            break;
          } else {
            break;
          }
        }
        for (const item of listItems) {
          blocks.push({
            object: 'block',
            type: 'numbered_list_item',
            numbered_list_item: {
              rich_text: this.parseRichText(item),
            },
          });
        }
        continue;
      }

      // Toggle: <details>/summary equivalent - use ## Toggle prefix
      if (trimmed.startsWith('## Toggle ')) {
        const toggleTitle = trimmed.slice(10);
        const toggleContent: any[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('## Toggle') && !lines[i].trim().startsWith('---')) {
          const t = lines[i].trim();
          if (t) {
            toggleContent.push(this.createBlock('paragraph', this.parseRichText(t)));
          }
          i++;
        }
        blocks.push({
          object: 'block',
          type: 'toggle',
          toggle: {
            rich_text: this.parseRichText(toggleTitle),
            children: toggleContent.length > 0 ? toggleContent : undefined,
          },
        });
        continue;
      }

      // Divider: --- or ***
      if (trimmed === '---' || trimmed === '***') {
        blocks.push({
          object: 'block',
          type: 'divider',
          divider: {},
        });
        i++;
        continue;
      }

      // Image: ![alt](url)
      const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imageMatch) {
        const imageUrl = imageMatch[2].trim();
        if (this.isValidNotionUrl(imageUrl)) {
          blocks.push({
            object: 'block',
            type: 'image',
            image: {
              type: 'external',
              external: { url: imageUrl },
            },
          });
        } else {
          // Invalid image URL - render as plain text
          blocks.push(this.createBlock('paragraph', this.parseRichText(trimmed)));
        }
        i++;
        continue;
      }

      // Default: paragraph
      blocks.push(this.createBlock('paragraph', this.parseRichText(trimmed)));
      i++;
    }

    return blocks;
  }

  private createBlock(type: string, richText: any[]): any {
    const block: any = {
      object: 'block',
      type: type,
    };
    block[type] = {
      rich_text: richText.length > 0 ? richText : [{ type: 'text', text: { content: ' ' } }],
    };
    return block;
  }

  /**
   * Validate URL for Notion API.
   * Notion only accepts URLs with valid protocols: http://, https://, mailto:, tel:.
   * Relative URLs, javascript:, data:, and fragment-only URLs are rejected.
   */
  private isValidNotionUrl(url: string): boolean {
    if (!url || url.trim() === '') return false;

    // Must start with a valid protocol scheme
    const validProtocols = /^(https?|mailto|tel):/i;
    return validProtocols.test(url.trim());
  }

  /**
   * Parse inline markdown formatting: bold (**text**), italic (*text*), code (`text`), links
   * Notion API requires valid URLs (http://, https://, mailto:) - invalid URLs fall back to plain text.
   */
  private parseRichText(text: string): any[] {
    if (!text) return [];

    const richTexts: any[] = [];
    // Simple inline parsing for bold, italic, inline code, and links
    // Negative lookbehind (?<!!) prevents matching image ![alt](url) as a link
    const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(?<!!)\[(.+?)\]\((.+?)\)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add plain text before this match
      if (match.index > lastIndex) {
        richTexts.push({
          type: 'text',
          text: { content: text.slice(lastIndex, match.index) },
        });
      }

      if (match[2]) {
        // **bold**
        richTexts.push({
          type: 'text',
          text: { content: match[2] },
          annotations: { bold: true },
        });
      } else if (match[4]) {
        // *italic*
        richTexts.push({
          type: 'text',
          text: { content: match[4] },
          annotations: { italic: true },
        });
      } else if (match[6]) {
        // `inline code`
        richTexts.push({
          type: 'text',
          text: { content: match[6] },
          annotations: { code: true },
        });
      } else if (match[7] && match[8]) {
        // [link text](url)
        const url = match[8];
        if (this.isValidNotionUrl(url)) {
          richTexts.push({
            type: 'text',
            text: { content: match[7], link: { url } },
          });
        } else {
          // Invalid URL - render as plain text: [text](url)
          richTexts.push({
            type: 'text',
            text: { content: match[0] },
          });
        }
      }

      lastIndex = match.index + match[0].length;
    }

    // Remaining plain text
    if (lastIndex < text.length) {
      richTexts.push({
        type: 'text',
        text: { content: text.slice(lastIndex) },
      });
    }

    return richTexts.length > 0 ? richTexts : [{ type: 'text', text: { content: ' ' } }];
  }
}
