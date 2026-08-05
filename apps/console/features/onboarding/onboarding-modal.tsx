'use client';

import {
  type CreateTenantInput,
  createTenantSchema,
  type JoinTenantInput,
  joinTenantSchema,
} from '@chatbot/contracts';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { TextField } from '@/components/ui/text-field';
import { useAuthForm } from '@/features/auth/use-auth-form';
import { createTenant, joinTenant } from './api';

type Step = 'choose' | 'create' | 'join';

type OnboardingModalProps = {
  displayName: string;
  onDone: () => Promise<void>;
};

const CHOICE_CLASS =
  'hover:border-accent border-border cursor-pointer rounded-xl border p-4 text-left transition-colors';
const BACK_CLASS =
  'text-muted hover:text-foreground cursor-pointer self-start bg-transparent text-sm';
const FORM_CLASS = 'flex flex-col gap-4';

export const OnboardingModal = ({
  displayName,
  onDone,
}: OnboardingModalProps) => {
  const [step, setStep] = useState<Step>('choose');

  const createForm = useAuthForm<CreateTenantInput>({
    schema: createTenantSchema,
    initialValues: { companyName: '' },
    onSubmit: async (input) => {
      await createTenant(input);
      await onDone();
    },
  });

  const joinForm = useAuthForm<JoinTenantInput>({
    schema: joinTenantSchema,
    initialValues: { inviteCode: '' },
    onSubmit: async (input) => {
      await joinTenant(input);
      await onDone();
    },
  });

  if (step === 'choose') {
    return (
      <Modal
        title={`Chào ${displayName}`}
        subtitle="Còn một bước nữa là xong. Công ty của bạn đã dùng hệ thống này chưa?"
        step={1}
        totalSteps={2}
      >
        <div className="flex flex-col gap-3">
          <button
            type="button"
            className={CHOICE_CLASS}
            onClick={() => setStep('create')}
          >
            <span className="block font-medium">Tôi tạo công ty mới</span>
            <span className="text-muted mt-0.5 block text-sm">
              Bạn sẽ là quản trị viên và mời đồng nghiệp vào sau
            </span>
          </button>

          <button
            type="button"
            className={CHOICE_CLASS}
            onClick={() => setStep('join')}
          >
            <span className="block font-medium">Tôi có mã mời</span>
            <span className="text-muted mt-0.5 block text-sm">
              Đồng nghiệp đã tạo công ty và gửi mã cho bạn
            </span>
          </button>
        </div>
      </Modal>
    );
  }

  if (step === 'create') {
    return (
      <Modal
        title="Tên công ty của bạn"
        subtitle="Tên này hiện trong hệ thống và trên lời mời gửi cho đồng nghiệp"
        step={2}
        totalSteps={2}
      >
        <form
          className={FORM_CLASS}
          onSubmit={createForm.handleSubmit}
          noValidate
        >
          {createForm.formError !== null && (
            <Alert tone="danger">{createForm.formError}</Alert>
          )}

          <TextField
            label="Tên công ty"
            name="companyName"
            value={createForm.values.companyName ?? ''}
            onChange={(value) => createForm.setValue('companyName', value)}
            error={createForm.fieldErrors.companyName}
            disabled={createForm.submitting}
          />

          <Button type="submit" block disabled={createForm.submitting}>
            {createForm.submitting ? 'Đang tạo...' : 'Tạo công ty'}
          </Button>

          <button
            type="button"
            className={BACK_CLASS}
            onClick={() => setStep('choose')}
          >
            ← Quay lại
          </button>
        </form>
      </Modal>
    );
  }

  return (
    <Modal
      title="Nhập mã mời"
      subtitle="Mã gồm 8 ký tự, do quản trị viên công ty bạn cấp"
      step={2}
      totalSteps={2}
    >
      <form className={FORM_CLASS} onSubmit={joinForm.handleSubmit} noValidate>
        {joinForm.formError !== null && (
          <Alert tone="danger">{joinForm.formError}</Alert>
        )}

        <TextField
          label="Mã mời"
          name="inviteCode"
          value={joinForm.values.inviteCode ?? ''}
          onChange={(value) =>
            joinForm.setValue('inviteCode', value.toUpperCase())
          }
          error={joinForm.fieldErrors.inviteCode}
          disabled={joinForm.submitting}
        />

        <Button type="submit" block disabled={joinForm.submitting}>
          {joinForm.submitting ? 'Đang vào...' : 'Vào công ty'}
        </Button>

        <button
          type="button"
          className={BACK_CLASS}
          onClick={() => setStep('choose')}
        >
          ← Quay lại
        </button>
      </form>
    </Modal>
  );
};
