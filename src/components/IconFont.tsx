import React from 'react';
import { IconProps } from '@ant-design/compatible/es/icon';
import { createFromIconfontCN } from '@ant-design/icons';
import Container from 'typedi';
import { IConfigService } from '@/service/common/config';
import { Observer, useObserver } from 'mobx-react';

const IconFont: React.FC<IconProps> = (props) => {
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
        if (!configService.remoteIconSet.has(props.type)) {
          // Icon not in remote set — render as text to avoid LegacyIcon warning
          const { type, style, ...rest } = props as any;
          return <span style={{ fontSize: 14, ...style }} title={type} {...rest} />;
        }
        return <IconFontComponent {...props} type={props.type} />;
      }}
    </Observer>
  );
};

export default IconFont;
