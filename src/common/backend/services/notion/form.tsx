import React from 'react';
import { Form } from '@ant-design/compatible';
import '@ant-design/compatible/assets/index.less';
import { Input } from 'antd';
import { FormattedMessage } from 'react-intl';

export default class NotionForm extends React.Component<any, any> {
  render() {
    const { getFieldDecorator } = this.props.form;
    return (
      <Form.Item
        label={
          <FormattedMessage
            id="backend.services.notion.form.token"
            defaultMessage="Notion Integration Token"
          />
        }
        extra={
          <span>
            <FormattedMessage
              id="backend.services.notion.form.tokenTip"
              defaultMessage="Go to {link} to create a token, then share your pages with the integration."
              values={{
                link: (
                  <a
                    href="https://www.notion.so/my-integrations"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Notion Integrations
                  </a>
                ),
              }}
            />
          </span>
        }
      >
        {getFieldDecorator('token', {
          rules: [
            {
              required: true,
              message: 'Notion API token is required',
            },
          ],
        })(
          <Input
            placeholder="secret_xxx"
            type="password"
            size="large"
          />
        )}
      </Form.Item>
    );
  }
}
