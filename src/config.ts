interface WebClipperConfig {
  icon: string;
  iconDark: string;
}

export interface RemoteConfig {
  iconfont: string;
  chromeWebStoreVersion: string;
}

let config: WebClipperConfig = {
  icon: 'icons/icon.png',
  iconDark: 'icons/icon-dark.png',
};

if (process.env.NODE_ENV === 'development') {
  config = Object.assign({}, config, {
    icon: 'icons/icon-dev.png',
  });
}

export default config;
