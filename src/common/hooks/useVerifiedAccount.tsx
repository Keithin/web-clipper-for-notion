import { UserPreferenceStore } from '@/common/types';
import { FormComponentProps } from '@ant-design/compatible/lib/form';
import React, { useState, useMemo, useCallback } from 'react';
import { omit } from 'lodash';
import { FormattedMessage } from 'react-intl';
import { message } from 'antd';
import { useFetch } from '@shihengtech/hooks';

type UseVerifiedAccountProps = FormComponentProps & {
  services: UserPreferenceStore['servicesMeta'];
  initAccount?: any;
};

const useVerifiedAccount = ({ form, services, initAccount }: UseVerifiedAccountProps) => {
  const [type, _setType] = useState<string>(
    initAccount ? initAccount.type : Object.values(services)[0].type
  );
  const service = services[type];
  const changeType = (type: string) => {
    _setType(type);
    const values = form.getFieldsValue();
    form.resetFields(Object.keys(omit(values, ['type'])));
  };
  const { data, run, loading } = useFetch(
    async (info: any) => {
      const Service = service.service;
      const instance = new Service(info);
      const userInfo = await instance.getUserInfo();
      const repositories = await instance.getRepositories();
      const id = await instance.getId();
      return { userInfo, repositories, id };
    },
    [service],
    {
      auto: false,
      onError: e => {
        message.error(e.message);
      },
    }
  );

  let loadAccount = useCallback(() => {
    form.validateFields((error, values) => {
      if (error) {
        return;
      }
      const { type, defaultRepositoryId, imageHosting, ...info } = values;
      run(info);
    });
  }, [form, run]);

  const accountStatus = {
    repositories: data?.repositories ?? [],
    userInfo: data?.userInfo ?? null,
    verified: !!data && !loading,
    id: data?.id ?? null,
  };

  let serviceForm = useMemo(() => {
    if (!service.form) {
      return null;
    }
    return (
      <service.form
        form={form}
        verified={accountStatus.verified}
        info={initAccount}
        loadAccount={loadAccount}
      />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountStatus.verified, form, initAccount, loadAccount, service.form]);

  const okText = useMemo(() => {
    if (loading) {
      return <FormattedMessage id="preference.accountList.verifying" defaultMessage="Verifying" />;
    }
    return accountStatus.verified ? (
      <FormattedMessage id="preference.accountList.add" defaultMessage="Add" />
    ) : (
      <FormattedMessage id="preference.accountList.verify" defaultMessage="Verify" />
    );
  }, [accountStatus.verified, loading]);

  let oauthLink = useMemo(() => {
    return service.oauthUrl ? (
      <a href={service.oauthUrl} target="_blank">
        <FormattedMessage id="preference.accountList.login" defaultMessage="Login" />
      </a>
    ) : null;
  }, [service.oauthUrl]);

  // Auto-reverify useEffect removed: user explicitly clicks "Verify",
  // no need for automatic re-verification when form values change.
  // The edit modal (editAccountModal.tsx) handles its own initial
  // verification via a separate useEffect.

  return {
    type,
    service,
    accountStatus: accountStatus,
    verifying: loading,
    verifyAccount: run,
    loadAccount,
    changeType,
    serviceForm,
    okText,
    oauthLink,
  };
};
export default useVerifiedAccount;
