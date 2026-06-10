import { ServiceMeta } from '@/common/backend';
import Service from './service';
import Form from './form';

export default (): ServiceMeta => {
  return {
    name: 'Notion',
    icon: 'https://www.notion.so/images/favicon.ico',
    type: 'notion',
    homePage: 'https://www.notion.so/',
    service: Service,
    form: Form,
    permission: {
      origins: ['https://api.notion.com/*'],
      permissions: [],
    },
  };
};
