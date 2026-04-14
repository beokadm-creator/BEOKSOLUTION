import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  runTransaction,
  updateDoc,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

import { db } from '@/firebase';
import type {
  ExternalAttendeeBulkRow,
  ExternalAttendeeDoc,
  ReceiptConfig,
} from '../types';

type GenerateAttendeeInput = {
  name: string;
  email: string;
  phone: string;
  organization: string;
  licenseNumber?: string;
  amount?: number;
  password?: string;
};

type Params = {
  confId: string | null;
  externalAttendees: ExternalAttendeeDoc[];
  setExternalAttendees: Dispatch<SetStateAction<ExternalAttendeeDoc[]>>;
  operatorId?: string;
  operatorEmail?: string;
  isProcessing: boolean;
  setIsProcessing: Dispatch<SetStateAction<boolean>>;
  progress: number;
  setProgress: Dispatch<SetStateAction<number>>;
};

export const useExternalAttendeeRegistration = ({
  confId,
  externalAttendees,
  setExternalAttendees,
  operatorId,
  operatorEmail,
  isProcessing,
  setIsProcessing,
  progress,
  setProgress,
}: Params) => {
  const [receiptConfig, setReceiptConfig] = useState<ReceiptConfig | null>(null);

  useEffect(() => {
    if (!confId) return;

    const fetchConfig = async () => {
      try {
        const confDoc = await getDoc(doc(db, `conferences/${confId}/settings/receipt_config`));
        if (confDoc.exists()) {
          setReceiptConfig(confDoc.data() as ReceiptConfig);
        }
      } catch (error) {
        console.error('Failed to fetch receipt config:', error);
      }
    };

    fetchConfig();
  }, [confId]);

  const generateAttendeeData = useCallback(
    (
      data: GenerateAttendeeInput,
      registrationType: 'MANUAL_INDIVIDUAL' | 'MANUAL_BULK',
    ): ExternalAttendeeDoc => {
      const uid = uuidv4();
      const externalId = `EXT-${uid.substring(0, 8).toUpperCase()}`;
      const confirmationQr = `CONF-${externalId}`;
      const badgeQr = `BADGE-${externalId}`;
      const receiptNumber = receiptConfig
        ? `${receiptConfig.nextSerialNo.toString().padStart(3, '0')}`
        : `EXT-${Date.now()}`;

      return {
        id: externalId,
        uid,
        conferenceId: confId || '',
        name: data.name,
        email: data.email,
        phone: data.phone,
        organization: data.organization,
        licenseNumber: data.licenseNumber || '',
        ...(data.password ? { password: data.password } : {}),
        paymentStatus: 'PAID',
        paymentMethod: 'ADMIN_FREE',
        amount: data.amount || 0,
        receiptNumber,
        confirmationQr,
        badgeQr,
        badgePrepToken: null,
        isCheckedIn: false,
        checkInTime: null,
        badgeIssued: false,
        badgeIssuedAt: null,
        registrationType,
        registeredBy: operatorId || 'ADMIN',
        deleted: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
    },
    [confId, operatorId, receiptConfig],
  );

  const registerIndividual = useCallback(
    async (formData: {
      name: string;
      email: string;
      phone: string;
      organization: string;
      licenseNumber: string;
      amount: number;
      password: string;
      noEmail: boolean;
    }): Promise<boolean> => {
      if (isProcessing) return false;

      if (!formData.name || !formData.phone || !formData.organization) {
        toast.error('이름, 전화번호, 소속은 필수 항목입니다.');
        return false;
      }

      let emailToUse = formData.email;
      if (!emailToUse) {
        if (formData.noEmail && formData.phone) {
          const cleanPhone = formData.phone.replace(/[^0-9]/g, '');
          emailToUse = `${cleanPhone}@no-email.placeholder`;
        } else {
          toast.error('이메일을 입력해주세요.');
          return false;
        }
      }

      if (formData.password && formData.password.length < 6) {
        toast.error('비밀번호는 최소 6자 이상이어야 합니다.');
        return false;
      }

      if (!confId) {
        toast.error('컨퍼런스 ID를 찾을 수 없습니다.');
        return false;
      }

      setIsProcessing(true);
      try {
        const emailExists = externalAttendees.some((a) => a.email === emailToUse);
        if (emailExists) {
          if (!confirm(`이메일 ${emailToUse} 이미 등록되어 있습니다. 계속하시겠습니까?`)) {
            setIsProcessing(false);
            return false;
          }
        }

        const configRef = doc(db, `conferences/${confId}/settings/receipt_config`);
        const attendeeData = generateAttendeeData(
          {
            name: formData.name,
            email: emailToUse,
            phone: formData.phone,
            organization: formData.organization,
            licenseNumber: formData.licenseNumber,
            amount: formData.amount,
            password: formData.password || undefined,
          },
          'MANUAL_INDIVIDUAL',
        );
        let assignedReceiptNumber = '';

        await runTransaction(db, async (transaction) => {
          const configDoc = await transaction.get(configRef);

          let nextSerialNo = 1;
          if (configDoc.exists()) {
            nextSerialNo = configDoc.data().nextSerialNo || 0;
          }

          assignedReceiptNumber = nextSerialNo.toString().padStart(3, '0');
          attendeeData.receiptNumber = assignedReceiptNumber;

          transaction.set(configRef, { nextSerialNo: nextSerialNo + 1 }, { merge: true });
          transaction.set(doc(db, `conferences/${confId}/external_attendees`, attendeeData.id), attendeeData);
        });

        await addDoc(collection(db, `conferences/${confId}/external_attendees/${attendeeData.id}/logs`), {
          type: 'REGISTERED',
          timestamp: Timestamp.now(),
          method: 'MANUAL_INDIVIDUAL',
          operator: operatorEmail,
        });

        if (formData.password) {
          try {
            const functions = getFunctions();
            const generateAuthUserFn = httpsCallable(
              functions,
              'generateFirebaseAuthUserForExternalAttendee',
            );
            const authResult = (await generateAuthUserFn({
              confId,
              externalId: attendeeData.id,
              password: formData.password,
              email: emailToUse,
              name: formData.name,
              phone: formData.phone,
              organization: formData.organization,
              licenseNumber: formData.licenseNumber,
            })) as { data: { success: boolean; uid: string; message: string } };

            if (authResult.data.success) {
              toast.success('회원 계정이 자동으로 생성되었습니다.');
              attendeeData.userId = authResult.data.uid;
            }
          } catch (authError) {
            console.error('Failed to auto-create auth user:', authError);
            toast.error('회원 계정 생성 실패 (나중에 명찰 발급 시 재시도됩니다)');
          }
        }

        setExternalAttendees((prev) => [attendeeData, ...prev]);
        toast.success('외부 참석자가 등록되었습니다.');
        return true;
      } catch (error) {
        console.error('Registration failed:', error);
        toast.error('등록에 실패했습니다.');
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [
      confId,
      externalAttendees,
      generateAttendeeData,
      isProcessing,
      operatorEmail,
      setExternalAttendees,
      setIsProcessing,
    ],
  );

  const registerBulk = useCallback(
    async (bulkPreview: ExternalAttendeeBulkRow[]): Promise<boolean> => {
      if (isProcessing) return false;

      if (!confId || bulkPreview.length === 0) {
        toast.error('등록할 데이터가 없습니다.');
        return false;
      }

      setIsProcessing(true);
      let successCount = 0;
      let failCount = 0;

      try {
        const duplicateEmails: string[] = [];
        bulkPreview.forEach((data) => {
          const exists = externalAttendees.some((a) => a.email === data.email);
          if (exists) duplicateEmails.push(data.email);
        });

        if (duplicateEmails.length > 0) {
          if (
            !confirm(
              `다음 이메일이 이미 등록되어 있습니다:\n${duplicateEmails.join('\n')}\n\n계속하시겠습니까?`,
            )
          ) {
            setIsProcessing(false);
            return false;
          }
        }

        const configRef = doc(db, `conferences/${confId}/settings/receipt_config`);
        const batchData = bulkPreview.map((data) => generateAttendeeData(data, 'MANUAL_BULK'));

        await runTransaction(db, async (transaction) => {
          const configDoc = await transaction.get(configRef);
          let currentSerialNo = 0;

          if (configDoc.exists()) {
            currentSerialNo = configDoc.data().nextSerialNo || 0;
          }

          batchData.forEach((attendee, index) => {
            attendee.receiptNumber = (currentSerialNo + index).toString().padStart(3, '0');
            transaction.set(doc(db, `conferences/${confId}/external_attendees`, attendee.id), attendee);
          });

          transaction.set(
            configRef,
            { nextSerialNo: currentSerialNo + batchData.length },
            { merge: true },
          );
        });

        const total = batchData.length;
        for (let i = 0; i < batchData.length; i++) {
          const attendee = batchData[i];
          setProgress(Math.round(((i + 1) / total) * 100));
          try {
            await addDoc(collection(db, `conferences/${confId}/external_attendees/${attendee.id}/logs`), {
              type: 'REGISTERED',
              timestamp: Timestamp.now(),
              method: 'MANUAL_BULK',
              operator: operatorEmail,
            });

            const passwordToUse =
              attendee.password && attendee.password.length >= 6
                ? attendee.password
                : attendee.phone
                  ? attendee.phone.replace(/[^0-9]/g, '').slice(-6).padStart(6, '0')
                  : '123456';

            const functions = getFunctions();
            const generateAuthUserFn = httpsCallable(
              functions,
              'generateFirebaseAuthUserForExternalAttendee',
            );
            const authResult = (await generateAuthUserFn({
              confId,
              externalId: attendee.id,
              password: passwordToUse,
              email: attendee.email,
              name: attendee.name,
              phone: attendee.phone,
              organization: attendee.organization,
              licenseNumber: attendee.licenseNumber,
            })) as { data: { success: boolean; uid: string; message: string } };

            if (authResult.data.success) {
              if (!attendee.password) {
                await updateDoc(doc(db, `conferences/${confId}/external_attendees`, attendee.id), {
                  password: passwordToUse,
                  userId: authResult.data.uid,
                  authCreated: true,
                });
              } else {
                await updateDoc(doc(db, `conferences/${confId}/external_attendees`, attendee.id), {
                  userId: authResult.data.uid,
                  authCreated: true,
                });
              }
            }

            successCount++;
          } catch (err) {
            console.error(`Failed to register auth for ${attendee.name}:`, err);
            failCount++;
          }
        }

        setExternalAttendees((prev) => [...batchData, ...prev]);

        if (failCount > 0) {
          toast(`DB저장은 완료되었으나 ${failCount}명의 계정 생성에 실패했습니다.`, { icon: '⚠️' });
        } else {
          toast.success(`${successCount}명의 외부 참석자가 등록되었습니다.`);
        }
        return true;
      } catch (error) {
        console.error('Bulk registration main error:', error);
        toast.error('대량 등록 중 오류가 발생했습니다.');
        return false;
      } finally {
        setIsProcessing(false);
        setProgress(0);
      }
    },
    [
      confId,
      externalAttendees,
      generateAttendeeData,
      isProcessing,
      operatorEmail,
      setExternalAttendees,
      setIsProcessing,
      setProgress,
    ],
  );

  return { receiptConfig, registerIndividual, registerBulk, progress };
};
