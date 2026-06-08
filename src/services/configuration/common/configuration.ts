import { Token } from 'typedi';

export interface IWebClipperConfiguration {}

export interface IConfigurationService {
  getConfiguration(): IWebClipperConfiguration;

  init(): void;
}

export const IConfigurationService = new Token<IConfigurationService>();
