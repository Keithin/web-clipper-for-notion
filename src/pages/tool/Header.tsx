import React, { useEffect, useRef, useMemo } from 'react';
import { Form } from '@ant-design/compatible';
import '@ant-design/compatible/assets/index.less';
import { Input, Button } from 'antd';
import { FormComponentProps } from '@ant-design/compatible/lib/form';
import Section from '@/components/section';
import { FormattedMessage } from 'react-intl';
import styles from './index.less';
import { useSelector, useDispatch } from 'dva';
import { GlobalStore, ClipperHeaderForm } from '@/common/types';
import { updateClipperHeader, asyncCreateDocument } from '@/actions/clipper';
import { isEqual } from 'lodash';
import { ServiceMeta, Repository } from '@/common/backend';
import classNames from 'classnames';
import localeService from '@/common/locales';

type PageProps = FormComponentProps & {
  pathname: string;
  service: ServiceMeta | null;
  currentRepository?: Repository;
};

const ClipperHeader: React.FC<PageProps> = props => {
  const {
    form: { getFieldDecorator, validateFields, getFieldsValue, setFieldsValue },
    form,
    pathname,
    service,
    currentRepository,
  } = props;
  const formValueRef = useRef<ClipperHeaderForm>(getFieldsValue() as ClipperHeaderForm);
  const { loading, clipperHeaderForm } = useSelector((g: GlobalStore) => {
    return {
      loading: g.loading.effects[asyncCreateDocument.started.type],
      clipperHeaderForm: g.clipper.clipperHeaderForm,
    };
  }, isEqual);
  const dispatch = useDispatch();

  // Sync redux → form: when clipperHeaderForm changes externally, push to antd Form
  useEffect(() => {
    if (isEqual(clipperHeaderForm, formValueRef.current)) {
      return;
    }
    setFieldsValue(clipperHeaderForm);
    formValueRef.current = clipperHeaderForm;
  }, [clipperHeaderForm, setFieldsValue]);

  // Sync form → redux: when the user types, push to redux store
  // Use ref for formValue to avoid re-render cycles — getFieldsValue
  // returns a new object reference every time, which can't be used
  // directly in useEffect deps without causing infinite loops.
  useEffect(() => {
    const currentFormValue = getFieldsValue() as ClipperHeaderForm;
    if (isEqual(formValueRef.current, currentFormValue)) {
      return;
    }
    dispatch(updateClipperHeader(currentFormValue));
    formValueRef.current = currentFormValue;
  }, [dispatch, getFieldsValue]);

  const handleSubmit = () => {
    validateFields(err => {
      if (err) {
        return;
      }
      dispatch(asyncCreateDocument.started({ pathname }));
    });
  };

  const headerForm = useMemo(() => {
    const HeaderForm = service?.headerForm;
    return HeaderForm ? <HeaderForm form={form} currentRepository={currentRepository} /> : null;
  }, [currentRepository, form, service]);

  return (
    <Section
      title={<FormattedMessage id="tool.title" defaultMessage="Title" />}
      className={classNames(styles.header, styles.section)}
    >
      <Form.Item>
        {getFieldDecorator('title', {
          rules: [
            {
              required: true,
              message: <FormattedMessage id="tool.title.required" />,
            },
          ],
        })(<Input placeholder="Please Input Title" />)}
      </Form.Item>
      {headerForm}
      <Button
        className={styles.saveButton}
        size="large"
        type="primary"
        title={
          !currentRepository
            ? localeService.format({
                id: 'tool.saveButton.noRepository',
              })
            : ''
        }
        onClick={handleSubmit}
        loading={loading}
        disabled={loading || pathname === '/' || !currentRepository}
        block
      >
        <FormattedMessage id="tool.save" defaultMessage="Save Content" />
      </Button>
    </Section>
  );
};

export default Form.create<PageProps>()(ClipperHeader);
