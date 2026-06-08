import { Repository } from '../interface';

/**
 * Notion official API response types
 */

export interface NotionPage extends Repository {
  object: 'page';
}

export interface NotionDatabase extends Repository {
  object: 'database';
}

export interface NotionUserResponse {
  id: string;
  name: string;
  avatar_url: string;
  type: 'person' | 'bot';
  person?: { email: string };
  bot?: { owner: { type: string; workspace?: boolean } };
}

export interface NotionSearchResponse {
  object: 'list';
  results: NotionPageObject[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface NotionPageObject {
  object: 'page' | 'database';
  id: string;
  created_time: string;
  last_edited_time: string;
  archived: boolean;
  parent: {
    type: string;
    workspace?: string;
    page_id?: string;
    database_id?: string;
  };
  properties: Record<string, any>;
  url: string;
}

export interface NotionCreatePageResponse {
  id: string;
  url: string;
  object: 'page';
  created_time: string;
  last_edited_time: string;
}

export interface NotionBlock {
  object: 'block';
  id: string;
  type: string;
  [key: string]: any;
}
