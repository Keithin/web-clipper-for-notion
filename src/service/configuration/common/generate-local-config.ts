import { WebClipperConfiguration } from '@/service/common/configuration';

interface IGenerateLocalConfigOptions {
  locale: string;
}

const generateLocalConfig = (_options: IGenerateLocalConfigOptions): WebClipperConfiguration => {
  return {
    resource: {
      host: '',
      privacy: '',
      changelog: '',
    },
  };
};

export { generateLocalConfig };
