'use client';

import { useTranslations } from 'next-intl';
import {
  AdminProfileView,
  type AdminProfilePasswordForm,
} from '@autix/shared-ui/admin/profile';
import {
  useAuthStore,
  useChangeAdminPasswordMutation,
} from '@autix/shared-store';

function getResponseMessage(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const response = (error as { response?: { data?: { message?: unknown } } }).response;
    const message = response?.data?.message;
    if (typeof message === 'string') return message;
  }

  return undefined;
}

export function AdminProfilePage() {
  const t = useTranslations('profile');
  const { user } = useAuthStore();
  const changePasswordMutation = useChangeAdminPasswordMutation();

  const handleChangePassword = async (data: AdminProfilePasswordForm) => {
    await changePasswordMutation.mutateAsync({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  return (
    <AdminProfileView
      user={user}
      platform="desktop"
      onChangePassword={handleChangePassword}
      getPasswordErrorMessage={(error) =>
        getResponseMessage(error) || t('passwordChangeFailed')
      }
    />
  );
}
