'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui';
import { ChangePasswordForm } from './ChangePasswordForm';
import { ChangeEmailForm } from './ChangeEmailForm';
import { DeleteAccountForm } from './DeleteAccountForm';
import type { OAuthStepUpStarter } from './StepUpController';

/**
 * AccountSelfServiceView 是账号安全设置页面的组装层。
 * 由 client (Next.js page) 传入当前用户状态；本视图不请求 API。
 */
export interface AccountSelfServiceViewProps {
  currentEmail: string | null | undefined;
  pendingEmail?: string | null;
  hasPassword: boolean;
  /** 若提供 username，则展示危险区（注销账号） */
  currentUsername?: string | null;
  /**
   * spec §3.2 F：超级管理员不能自助注销（后端 softDelete 也会 409 SUPER_ADMIN_CANNOT_SELF_DELETE）。
   * 为 true 时危险区隐藏"注销账号"入口，改为展示提示文案。
   */
  isSuperAdmin?: boolean;
  onAccountDeleted?: (result: { deletedAt: string }) => void;
  startOAuthStepUp?: OAuthStepUpStarter;
}

export function AccountSelfServiceView(props: AccountSelfServiceViewProps) {
  const t = useTranslations('auth.selfService');
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('sectionAccount')}</CardTitle>
          <CardDescription>{t('sectionAccountDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-8 md:grid-cols-2 md:divide-x md:divide-border">
          <div className="min-w-0 md:pr-8">
            <ChangePasswordForm hasPassword={props.hasPassword} startOAuthStepUp={props.startOAuthStepUp} />
          </div>
          <div className="min-w-0 border-t border-border pt-8 md:border-t-0 md:pl-8 md:pt-0">
            <ChangeEmailForm
              currentEmail={props.currentEmail}
              pendingEmail={props.pendingEmail}
              hasPassword={props.hasPassword}
              startOAuthStepUp={props.startOAuthStepUp}
            />
          </div>
        </CardContent>
      </Card>
      {props.currentUsername ? (
        <Card className="ring-destructive/25">
          <CardHeader>
            <CardTitle className="text-destructive">{t('sectionDanger')}</CardTitle>
            <CardDescription>{t('sectionDangerDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {props.isSuperAdmin ? (
              <p className="text-sm text-muted-foreground">{t('superAdminBlocked')}</p>
            ) : (
              <DeleteAccountForm
                currentUsername={props.currentUsername}
                hasPassword={props.hasPassword}
                onDeleted={props.onAccountDeleted}
                startOAuthStepUp={props.startOAuthStepUp}
              />
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
