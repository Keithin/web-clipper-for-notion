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
        // IMPORTANT: Check remoteIconSet FIRST — LegacyIcon safely handles
        // undefined/missing types by rendering nothing (no crash).
        // Only throw for null type when icon IS in the iconfont set
        // (where we need a valid name to render the SVG).
        if (!configService.remoteIconSet.has(props.type)) {
          return <LegacyIcon {...props} />;
        }
        if (!props.type) {
          throw new Error('Type is required');
        }
        return <IconFontComponent {...props} type={props.type} />;
      }}
    </Observer>
  );
};

export default IconFont;
