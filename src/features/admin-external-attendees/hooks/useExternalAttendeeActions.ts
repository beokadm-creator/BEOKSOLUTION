import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';

import { db } from '@/firebase';
import { useBixolon } from '@/hooks/useBixolon';
import type { BadgeElement } from '@/types/schema';
import type { ExternalAttendeeDoc } from '../types';
import { badgeConfigRepo } from '@/features/admin-registrations/services/badgeConfigRepo';

type Params = {
  confId: string | null;
  slug?: string;
  operatorEmail?: string;
  setIsProcessing: Dispatch<SetStateAction<boolean>>;
  setProgress: Dispatch<SetStateAction<number>>;
};

export const useExternalAttendeeActions = ({
  confId,
  slug,
  operatorEmail,
  setIsProcessing,
  setProgress,
}: Params) => {
  const { printBadge, printing: bixolonPrinting, error: bixolonError } = useBixolon();

  const deleteAttendee = useCallback(
    async (attendee: ExternalAttendeeDoc) => {
      if (!confirm(`${attendee.name} 님을 삭제하시겠습니까?`)) return;
      if (!confId) return;

      try {
        await updateDoc(doc(db, `conferences/${confId}/external_attendees`, attendee.id), {
          deleted: true,
          updatedAt: Timestamp.now(),
        });

        await addDoc(collection(db, `conferences/${confId}/external_attendees/${attendee.id}/logs`), {
          type: 'DELETED',
          timestamp: Timestamp.now(),
          operator: operatorEmail,
        });

        toast.success('삭제되었습니다.');
      } catch (error) {
        console.error('Delete failed:', error);
        toast.error('삭제에 실패했습니다.');
      }
    },
    [confId, operatorEmail],
  );

  const resendBadgePrepToken = useCallback(
    async (attendee: ExternalAttendeeDoc) => {
      if (attendee.badgeIssued) {
        toast.error('이미 명찰이 발급되었습니다.');
        return;
      }
      if (!confirm(`${attendee.name} 님에게 바우처 알림톡을 재발송하시겠습니까?`)) return;
      if (!confId) return;

      setIsProcessing(true);
      try {
        const functions = getFunctions();
        const resendNotificationFn = httpsCallable(functions, 'resendBadgePrepToken');
        const result = (await resendNotificationFn({
          confId,
          regId: attendee.id,
        })) as { data: { success: boolean; newToken: string } };

        if (result.data.success) {
          toast.success('알림톡이 발송되었습니다.');
        } else {
          throw new Error('Failed to send notification');
        }
      } catch (error) {
        console.error('Failed to delete attendee:', error);
        toast.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [confId, setIsProcessing],
  );

  const bulkResendBadgePrepToken = useCallback(
    async (attendees: ExternalAttendeeDoc[], mode: 'selected' | 'all'): Promise<boolean> => {
      if (!confId) return false;

      if (attendees.length === 0) {
        toast.error('발송할 대상을 선택해주세요.');
        return false;
      }

      const originalCount = attendees.length;
      const targetAttendees = attendees.filter((a) => !a.badgeIssued);

      if (originalCount > targetAttendees.length) {
        toast.error(`이미 명찰이 발급된 ${originalCount - targetAttendees.length}명은 제외되었습니다.`, {
          duration: 4000,
        });
      }

      if (targetAttendees.length === 0) {
        toast.error('발송할 대상을 선택해주세요.');
        return false;
      }

      if (
        !confirm(
          `${targetAttendees.length}명의 참석자에게 알림톡을 ${mode === 'selected' ? '선택' : '전체'} 발송하시겠습니까?`,
        )
      )
        return false;

      setIsProcessing(true);
      let successCount = 0;
      let failCount = 0;

      try {
        const chunkSize = 5;
        for (let i = 0; i < targetAttendees.length; i += chunkSize) {
          const chunk = targetAttendees.slice(i, i + chunkSize);
          setProgress(Math.round(((i + chunk.length) / targetAttendees.length) * 100));

          await Promise.all(
            chunk.map(async (attendee) => {
              try {
                const functions = getFunctions();
                const resendNotificationFn = httpsCallable(functions, 'resendBadgePrepToken');
                await resendNotificationFn({ confId, regId: attendee.id });
                successCount++;
              } catch (err) {
                console.error(`Failed notification for ${attendee.name}:`, err);
                failCount++;
              }
            }),
          );
        }
        toast.success(`${successCount}명 발송 완료, ${failCount}명 실패.`);
        return true;
      } catch (error) {
        console.error('Bulk notification failed:', error);
        toast.error('일괄 발송 중 오류가 발생했습니다.');
        return false;
      } finally {
        setIsProcessing(false);
        setProgress(0);
      }
    },
    [confId, setIsProcessing, setProgress],
  );

  const createAccount = useCallback(
    async (attendee: ExternalAttendeeDoc) => {
      if (
        !confirm(
          `${attendee.name} 님의 회원 계정을 생성하시겠습니까?\n(비밀번호가 없으면 전화번호 뒷 6자리가 사용됩니다)`,
        )
      )
        return;
      if (!confId) return;

      setIsProcessing(true);
      try {
        const passwordToUse =
          attendee.password && attendee.password.length >= 6
            ? attendee.password
            : attendee.phone
              ? attendee.phone.replace(/[^0-9]/g, '').slice(-6).padStart(6, '0')
              : '123456';

        const functions = getFunctions();
        const generateAuthUserFn = httpsCallable(functions, 'generateFirebaseAuthUserForExternalAttendee');
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
          toast.success(`계정이 생성되었습니다.\n비밀번호: ${passwordToUse}`);

          if (!attendee.password) {
            await updateDoc(doc(db, `conferences/${confId}/external_attendees`, attendee.id), {
              password: passwordToUse,
            });
          }
        } else {
          throw new Error(authResult.data.message);
        }
      } catch (error: unknown) {
        console.error('Account creation failed:', error);
        toast.error(`계정 생성 실패: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [confId, setIsProcessing],
  );

  const issueBadge = useCallback(
    async (attendee: ExternalAttendeeDoc) => {
      if (!confirm(`${attendee.name} 님의 명찰을 발급 처리하시겠습니까?`)) return;
      if (!confId) return;

      setIsProcessing(true);
      try {
        const functions = getFunctions();
        const issueBadgeFn = httpsCallable(functions, 'issueDigitalBadge');
        const result = (await issueBadgeFn({
          confId,
          regId: attendee.id,
          issueOption: 'DIGITAL_PRINT',
        })) as { data: { success: boolean; badgeQr?: string } };

        if (result.data.success) {
          toast.success('명찰 발급 처리 완료');
        } else {
          throw new Error('발급 처리에 실패했습니다.');
        }
      } catch (err) {
        console.error('Failed to Issue Badge:', err);
        toast.error(err instanceof Error ? err.message : '처리 실패');
      } finally {
        setIsProcessing(false);
      }
    },
    [confId, setIsProcessing],
  );

  const bixolonPrint = useCallback(
    async (attendee: ExternalAttendeeDoc) => {
      if (bixolonPrinting) return;

      const qrData = attendee.badgeQr || attendee.id;
      const toastId = 'bixolon-print';
      toast.loading('라벨 프린터 전송 중...', { id: toastId });

      try {
        const tryGetLegacyBadgeLayout = async (conferenceId: string) => {
          const snap = await getDoc(doc(db, `conferences/${conferenceId}/info/general`));
          if (!snap.exists()) return null;
          const data = snap.data() as { badgeLayout?: unknown };
          return data.badgeLayout as
            | {
                width: number;
                height: number;
                elements: BadgeElement[];
                unit?: 'px' | 'mm';
                enableCutting?: boolean;
                printerDpmm?: number;
                printOffsetXmm?: number;
                printOffsetYmm?: number;
              }
            | null;
        };

        let badgeLayout:
          | {
              width: number;
              height: number;
              elements: BadgeElement[];
              unit?: 'px' | 'mm';
              enableCutting?: boolean;
              printerDpmm?: number;
              printOffsetXmm?: number;
              printOffsetYmm?: number;
            }
          | null = null;
        let layoutSource = 'fallback';

        if (confId) {
          try {
            badgeLayout = await badgeConfigRepo.getActiveBadgeLayout(confId);
            if (badgeLayout) layoutSource = `badge_config:${confId}`;
          } catch (fetchErr) {
            console.error('[Bixolon] badge_config fetch failed:', fetchErr);
          }
        }

        if (!badgeLayout && slug) {
          try {
            const q = query(collection(db, 'conferences'), where('slug', '==', slug));
            const snap = await getDocs(q);
            if (!snap.empty) {
              const cid = snap.docs[0].id;
              badgeLayout = await badgeConfigRepo.getActiveBadgeLayout(cid);
              if (badgeLayout) layoutSource = `badge_config(slug):${cid}`;
            }
          } catch (fetchErr) {
            console.debug('Failed to fetch config by slug', fetchErr);
          }
        }

        if (!badgeLayout && confId) {
          try {
            badgeLayout = await tryGetLegacyBadgeLayout(confId);
            if (badgeLayout) layoutSource = `info/general:${confId}`;
          } catch (fetchErr) {
            console.error('[Bixolon] legacy badgeLayout fetch failed:', fetchErr);
          }
        }

        if (!badgeLayout && slug) {
          try {
            const q = query(collection(db, 'conferences'), where('slug', '==', slug));
            const snap = await getDocs(q);
            if (!snap.empty) {
              const cid = snap.docs[0].id;
              badgeLayout = await tryGetLegacyBadgeLayout(cid);
              if (badgeLayout) layoutSource = `info/general(slug):${cid}`;
            }
          } catch (fetchErr) {
            console.debug('Failed to fetch legacy layout by slug', fetchErr);
          }
        }

        const activeLayout = badgeLayout || {
          width: 100,
          height: 240,
          unit: 'mm',
          elements: [
            { x: 50, y: 20, fontSize: 25, isVisible: true, type: 'QR' } as BadgeElement,
            { x: 50, y: 60, fontSize: 6, isVisible: true, type: 'NAME' } as BadgeElement,
            { x: 50, y: 80, fontSize: 4, isVisible: true, type: 'ORG' } as BadgeElement,
          ],
        };

        // DEBUG: 실제 로드된 레이아웃 확인
        console.log('🔍 [EXTERNAL DEBUG] Loaded Layout:', {
          source: layoutSource,
          width: activeLayout.width,
          height: activeLayout.height,
          unit: activeLayout.unit,
          fromDB: badgeLayout ? 'YES' : 'NO (fallback)'
        });

        toast.loading(
          `라벨 프린터 전송 중... (${layoutSource}, ${activeLayout.width}×${activeLayout.height}${activeLayout.unit ? ` ${activeLayout.unit}` : ''})`,
          { id: toastId },
        );

        const printSuccess = await printBadge(activeLayout, {
          name: attendee.name || '',
          org: attendee.organization || '',
          category: '외부참석자',
          license: attendee.licenseNumber || '',
          price: (attendee.amount || 0).toLocaleString() + '원',
          affiliation: attendee.organization || '',
          qrData: qrData,
        });

        if (printSuccess) {
          toast.success('라벨 출력 성공', { id: toastId });
        } else {
          toast.error(bixolonError || '라벨 출력 실패', { id: toastId, duration: 6000 });
        }
      } catch (error) {
        console.error('Bixolon print error:', error);
        toast.error('프린터 오류 발생', { id: toastId });
      }
    },
    [bixolonError, bixolonPrinting, confId, printBadge, slug],
  );

  return {
    deleteAttendee,
    resendBadgePrepToken,
    bulkResendBadgePrepToken,
    createAccount,
    issueBadge,
    bixolonPrint,
    bixolonPrinting,
    bixolonError,
  };
};
