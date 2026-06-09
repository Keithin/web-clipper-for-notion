import React from 'react';
import { Icon as LegacyIcon } from '@ant-design/compatible';
import { createFromIconfontCN } from '@ant-design/icons';
import Container from 'typedi';
import { IConfigService } from '@/service/common/config';
import { Observer, useObserver } from 'mobx-react';

const IconFont: React.FC<any> = (props) => {
  const configService = Container.get(IConfigService);
  const IconFontComponent = useObserver(() => {
    return createFromIconfontCN({ scriptUrl: './icon.js' });
  });
  return (
    <Observer>
      {() => {
        if (!props.type) {
          throw new Error('Type is required');
        }
        // Icon is in the iconfont set — use the custom SVG iconfont component
        if (configService.remoteIconSet.has(props.type)) {
          return <IconFontComponent {...props} type={props.type} />;
        }
        // Not in iconfont — fall back to antd's LegacyIcon.
        // Extension icons (link, copy, qrcode, delete, etc.) are all valid
        // antd icon names; LegacyIcon renders them correctly without warnings.
        return <LegacyIcon {...props} />;
      }}
    </Observer>
  );
};

export default IconFont;
