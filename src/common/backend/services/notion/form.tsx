import React from 'react';
import { Form, Input } from 'antd';
import { FormattedMessage } from 'react-intl';

export default class NotionForm extends React.Component<any, any> {
  render() {
    const { getFieldDecorator } = this.props.form;
    return (
      <Form.Item
        label={
          <FormattedMessage
            id="backend.services.notion.form.token"
            defaultMessage="Notion API Token"
          />
        }
      >
        {getFieldDecorator('token', {
          rules: [
            {
              required: true,
              message: 'Notion API token is required',
            },
            {
              pattern: /^secret_/,
              message: 'Token must start with "secret_"',
            },
          ],
        })(
          <Input
            placeholder="Enter your Notion Integration Token (secret_xxx)"
            type="password"
          />
        )}
        <p style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
          <a
            href="https://www.notion.so/my-integrations"
            target="_blank"
            rel="noopener noreferrer"
          >
            Create a Notion Integration →
          </a>
          &nbsp; and grant it access to your workspace pages.
        </p>
      </Form.Item>
    );
  }
}
