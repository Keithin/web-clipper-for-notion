export interface WebClipperConfiguration {
  resource: {
    host: string;
    privacy: string;
    changelog: string;
  };
}

export interface IConfigurationService {}

export type GetLocalConfiguration = () => {};
