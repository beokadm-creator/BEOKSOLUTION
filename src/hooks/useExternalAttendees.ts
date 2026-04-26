import { useState, useEffect, useCallback } from 'react';
import { collection, getDoc, getDocs, doc, updateDoc, Timestamp, addDoc, query, where, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '@/firebase';
import { safeFormatDate } from '@/utils/dateUtils';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { v4 as uuidv4 } from 'uuid';
import { useExcel } from '@/hooks/useExcel';
import { useBixolon } from '@/hooks/useBixolon';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import type { ExternalAttendee, BadgeElement } from '@/types/schema';
import { normalizeFieldSettings } from '@/utils/registrationFieldSettings';
import type { RegistrationFieldSettings } from '@/types/schema';

export interface UseExternalAttendeesReturn {
  // Data
  externalAttendees: ExternalAttendee[];
  loading: boolean;
  isProcessing: boolean;
  progress: number;
  fieldSettings: RegistrationFieldSettings;
  receiptConfig: { issuerName: string; stampUrl: string; nextSerialNo: number } | null;

  // Individual form
  formData: {
    name: string;
    email: string;
    phone: string;
    organization: string;
    position: string;
    licenseNumber: string;
    amount: number;
    password: string;
  };
  setFormData: React.Dispatch<React.SetStateAction<{
    name: string;
    email: string;
    phone: string;
    organization: string;
    position: string;
    licenseNumber: string;
    amount: number;
    password: string;
  }>>;
  noEmail: boolean;
  handleNoEmailChange: (checked: boolean) => void;
  showPassword: boolean;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  handleIndividualRegister: () => Promise<void>;

  // Bulk
  bulkPreview: Array<{
    name: string;
    email: string;
    phone: string;
    organization: string;
    licenseNumber?: string;
    amount?: number;
    password?: string;
  }>;
  setBulkPreview: React.Dispatch<React.SetStateAction<Array<{
    name: string;
    email: string;
    phone: string;
    organization: string;
    licenseNumber?: string;
    amount?: number;
    password?: string;
  }>>>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleBulkRegister: () => Promise<void>;
  downloadTemplate: () => void;

  // List actions
  selectedIds: string[];
  toggleSelection: (e: React.MouseEvent, id: string) => void;
  toggleSelectAll: () => void;
  handleExport: () => void;
  handleDelete: (attendee: ExternalAttendee) => Promise<void>;
  handleResendNotification: (attendee: ExternalAttendee) => Promise<void>;
  handleBulkResendNotification: (mode: 'selected' | 'all') => Promise<void>;
  handleCreateAccount: (attendee: ExternalAttendee) => Promise<void>;
  handleIssueBadge: (attendee: ExternalAttendee) => Promise<void>;
  handleBixolonPrint: (attendee: ExternalAttendee) => Promise<void>;

  // Voucher modal
  showVoucherModal: boolean;
  setShowVoucherModal: React.Dispatch<React.SetStateAction<boolean>>;
  selectedAttendee: ExternalAttendee | null;
  setSelectedAttendee: React.Dispatch<React.SetStateAction<ExternalAttendee | null>>;

  // Helpers
  confBaseUrl: string;
  confSlug: string;

  // External states
  exporting: boolean;
  bixolonPrinting: boolean;
}

export function useExternalAttendees(
  confId: string | undefined,
  slug: string | undefined,
  societyId: string | undefined
): UseExternalAttendeesReturn {
  const { auth } = useAuth();
  const { printBadge, printing: bixolonPrinting, error: bixolonError } = useBixolon();
  const { exportToExcel, importFromExcel, processing: exporting } = useExcel();

  // ── URL helpers ──
  const confBaseUrl = useCallback(() => {
    const hostname = window.location.hostname;
    if (hostname.includes('localhost') || hostname.includes('.web.app') || hostname.includes('firebaseapp.com')) {
      return window.location.origin;
    }
    if (societyId) {
      const parts = hostname.split('.');
      const tldPartsLength = hostname.match(/\.(co\.kr|or\.kr|ac\.kr|go\.kr|ne\.kr)$/) ? 3 : 2;
      const domain = parts.slice(-tldPartsLength).join('.');
      return `https://${societyId}.${domain}`;
    }
    return window.location.origin;
  }, [societyId]);

  const confSlug = useCallback(() => {
    if (slug) return slug;
    if (confId && confId.includes('_')) return confId.split('_').slice(1).join('_');
    return confId || '';
  }, [slug, confId]);



  // ── Core state ──
  const [externalAttendees, setExternalAttendees] = useState<ExternalAttendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // ── Fetch external attendees with real-time updates ──
  useEffect(() => {
    if (!confId) return;

    setLoading(true);
    const attendeesRef = collection(db, `conferences/${confId}/external_attendees`);
    const q = query(attendeesRef, where('deleted', '==', false));

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => doc.data() as ExternalAttendee);
      data.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
      setExternalAttendees(data);
      setLoading(false);
    }, (error) => {
      console.error('Failed to fetch external attendees:', error);
      toast.error('외부 참석자 목록을 불러오는데 실패했습니다.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [confId]);

  // ── Individual Registration Form ──
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    organization: '',
    position: '',
    licenseNumber: '',
    amount: 0,
    password: ''
  });
  const [noEmail, setNoEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldSettings, setFieldSettings] = useState<RegistrationFieldSettings>(normalizeFieldSettings());

  // Fetch fieldSettings from registration settings
  useEffect(() => {
    if (!confId) return;
    const fetchSettings = async () => {
      try {
        const regDoc = await getDoc(doc(db, `conferences/${confId}/settings/registration`));
        if (regDoc.exists()) {
          setFieldSettings(normalizeFieldSettings(regDoc.data().fieldSettings));
        }
      } catch (err) {
        console.error("Failed to fetch fieldSettings", err);
        toast.error('신청서 설정을 불러오지 못했습니다.');
      }
    };
    fetchSettings();
  }, [confId]);

  // Update email when phone changes if noEmail is checked
  useEffect(() => {
    if (noEmail && formData.phone) {
      const cleanPhone = formData.phone.replace(/[^0-9]/g, '');
      if (cleanPhone) {
        setFormData(prev => ({ ...prev, email: `${cleanPhone}@no-email.placeholder` }));
      }
    }
  }, [formData.phone, noEmail]);

  const handleNoEmailChange = (checked: boolean) => {
    setNoEmail(checked);
    if (checked) {
      if (formData.phone) {
        const cleanPhone = formData.phone.replace(/[^0-9]/g, '');
        setFormData(prev => ({ ...prev, email: `${cleanPhone}@no-email.placeholder` }));
      } else {
        setFormData(prev => ({ ...prev, email: '' }));
      }
    } else {
      setFormData(prev => ({ ...prev, email: '' }));
    }
  };

  // ── Bulk Upload ──
  const [bulkPreview, setBulkPreview] = useState<Array<{ name: string; email: string; phone: string; organization: string; licenseNumber?: string; amount?: number; password?: string }>>([]);

  // ── Voucher Modal ──
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [selectedAttendee, setSelectedAttendee] = useState<ExternalAttendee | null>(null);

  // ── Receipt Config ──
  const [receiptConfig, setReceiptConfig] = useState<{ issuerName: string; stampUrl: string; nextSerialNo: number } | null>(null);

  // Fetch receipt config
  useEffect(() => {
    if (!confId) return;

    const fetchConfig = async () => {
      try {
        const confDoc = await getDoc(doc(db, `conferences/${confId}/settings/receipt_config`));
        if (confDoc.exists()) {
          setReceiptConfig(confDoc.data() as { issuerName: string; stampUrl: string; nextSerialNo: number });
        }
      } catch (error) {
        console.error('Failed to fetch receipt config:', error);
        toast.error('영수증 설정을 불러오지 못했습니다.');
      }
    };

    fetchConfig();
  }, [confId]);

  // ── Handle export to Excel ──
  const handleExport = () => {
    const data = externalAttendees.map(a => ({
      'ID': a.id,
      '이름': a.name,
      '이메일': a.email || '-',
      '전화번호': a.phone || '-',
      '소속': a.organization || '-',
      '면허번호': a.licenseNumber || '-',
      '등록비': a.amount || 0,
      '수령번호': a.receiptNumber || '-',
      '명찰발급': a.badgeIssued ? '발급완료' : '미발급',
      '체크인': a.isCheckedIn ? '완료' : '대기',
      '등록일': safeFormatDate(a.createdAt),
    }));
    exportToExcel(data, `ExternalAttendees_${confId}_${new Date().toISOString().slice(0, 10)}`);
  };

  // ── Generate unique UID and QR codes ──
  const generateAttendeeData = (data: { name: string; email: string; phone: string; organization: string; licenseNumber?: string; amount?: number; password?: string; position?: string }, registrationType: 'MANUAL_INDIVIDUAL' | 'MANUAL_BULK') => {
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
      conferenceId: confId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      organization: data.organization,
      position: data.position || '',
      licenseNumber: data.licenseNumber || '',
      ...(data.password ? { password: data.password } : {}),
      paymentStatus: 'PAID' as const,
      paymentMethod: 'ADMIN_FREE' as const,
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
      registeredBy: auth.user?.id || 'ADMIN',
      deleted: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
  };

  // ── Handle individual registration ──
  const handleIndividualRegister = async () => {
    // Dynamic Validation based on fieldSettings
    const missingRequired = [];
    if (fieldSettings.name.required && !formData.name) missingRequired.push('name');
    if (fieldSettings.phone.required && !formData.phone) missingRequired.push('phone');
    if (fieldSettings.affiliation.required && !formData.organization) missingRequired.push('organization');
    if (fieldSettings.position.required && !formData.position) missingRequired.push('position');

    // If email is required, it must be provided unless 'noEmail' is checked
    if (fieldSettings.email.required && !noEmail && !formData.email) missingRequired.push('email');
    if (fieldSettings.licenseNumber.required && !formData.licenseNumber) missingRequired.push('licenseNumber');

    if (missingRequired.length > 0) {
      toast.error('필수 항목을 모두 입력해주세요.');
      return;
    }

    // Generate placeholder email if missing
    if (!formData.email) {
      const cleanPhone = formData.phone.replace(/[^0-9]/g, '');
      if (!cleanPhone) {
        toast.error('이메일 또는 전화번호 중 하나는 반드시 입력해야 합니다.');
        return;
      }

      if (noEmail && formData.phone) {
        formData.email = `${cleanPhone}@no-email.placeholder`;
      } else if (!fieldSettings.email.required) {
        formData.email = `${cleanPhone}@no-email.placeholder`;
      } else {
        toast.error('이메일을 입력해주세요.');
        return;
      }
    }

    // Password validation
    if (formData.password && formData.password.length < 6) {
      toast.error('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    if (!confId) {
      toast.error('컨퍼런스 ID를 찾을 수 없습니다.');
      return;
    }

    setIsProcessing(true);
    try {
      // Check for duplicate email
      const emailExists = externalAttendees.some(a => a.email === formData.email);
      if (emailExists) {
        if (!confirm(`이메일 ${formData.email} 이미 등록되어 있습니다. 계속하시겠습니까?`)) {
          setIsProcessing(false);
          return;
        }
      }

      // Transaction for receipt number and document creation
      const configRef = doc(db, `conferences/${confId}/settings/receipt_config`);
      const attendeeData = generateAttendeeData(formData, 'MANUAL_INDIVIDUAL');

      await runTransaction(db, async (transaction) => {
        const configDoc = await transaction.get(configRef);

        let nextSerialNo = 1;
        if (configDoc.exists()) {
          nextSerialNo = (configDoc.data().nextSerialNo || 0);
        }

        // Assign receipt number carefully
        attendeeData.receiptNumber = nextSerialNo.toString().padStart(3, '0');

        // Update config
        transaction.set(configRef, { nextSerialNo: nextSerialNo + 1 }, { merge: true });

        // Set attendee doc
        transaction.set(doc(db, `conferences/${confId}/external_attendees`, attendeeData.id), attendeeData);
      });

      // Add log (outside transaction as it's less critical)
      await addDoc(collection(db, `conferences/${confId}/external_attendees/${attendeeData.id}/logs`), {
        type: 'REGISTERED',
        timestamp: Timestamp.now(),
        method: 'MANUAL_INDIVIDUAL',
        operator: auth.user?.email
      });

      // Force Signup & Generate UID immediately
      if (formData.password) {
        try {
          const functions = getFunctions();
          const generateAuthUserFn = httpsCallable(functions, 'generateFirebaseAuthUserForExternalAttendee');
          const authResult = await generateAuthUserFn({
            confId,
            externalId: attendeeData.id,
            password: formData.password,
            email: formData.email,
            name: formData.name,
            phone: formData.phone,
            organization: formData.organization,
            position: formData.position,
            licenseNumber: formData.licenseNumber
          }) as { data: { success: boolean; uid: string; message: string } };

          if (authResult.data.success) {
            toast.success('회원 계정이 자동으로 생성되었습니다.');
            (attendeeData as Record<string, unknown>).userId = authResult.data.uid;
          }
        } catch (authError) {
          console.error('Failed to auto-create auth user:', authError);
          toast.error('회원 계정 생성 실패 (나중에 명찰 발급 시 재시도됩니다)');
        }
      }

      setExternalAttendees(prev => [attendeeData, ...prev]);
      setFormData({ name: '', email: '', phone: '', organization: '', licenseNumber: '', amount: 0, password: '' });
      setNoEmail(false);
      toast.success('외부 참석자가 등록되었습니다.');
    } catch (error) {
      console.error('Registration failed:', error);
      toast.error('등록에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Handle Excel/CSV file upload ──
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rawData = await importFromExcel(file);

      const mappedData = rawData.map((row: Record<string, string>) => {
        const name = String(row.name || row['이름'] || row['성명'] || '').trim();
        const phone = String(row.phone || row['전화번호'] || row['핸드폰'] || row['연락처'] || '').trim();
        let email = String(row.email || row['이메일'] || '').trim();

        // If email is missing but phone exists, generate placeholder email
        if (!email && phone) {
          const cleanPhone = phone.replace(/[^0-9]/g, '');
          if (cleanPhone.length >= 8) {
            email = `${cleanPhone}@no-email.placeholder`;
          }
        }

        return {
          name,
          email,
          phone,
          organization: String(row.organization || row['소속'] || row['직장'] || '').trim(),
          position: String(row.position || row['직급'] || row['직책'] || '').trim(),
          licenseNumber: String(row.licenseNumber || row['면허번호'] || '').trim(),
          amount: Number(row.amount || row['등록비'] || row['결제금액'] || 0),
          password: row.password || row['비밀번호'] ? String(row.password || row['비밀번호']) : undefined
        };
      }).filter(item => {
        if (fieldSettings.name.required && !item.name) return false;
        if (fieldSettings.phone.required && !item.phone) return false;
        if (fieldSettings.affiliation.required && !item.organization) return false;
        if (fieldSettings.position.required && !item.position) return false;

        // Email is mandatory for Auth
        if (!item.email && !item.phone) return false;

        if (fieldSettings.email.required && !item.email) return false;
        if (fieldSettings.licenseNumber.required && !item.licenseNumber) return false;
        return true;
      });

      if (mappedData.length === 0) {
        toast.error('유효한 데이터가 없습니다. 파일의 컬럼명을 확인해주세요.');
        return;
      }

      setBulkPreview(mappedData);
      toast.success(`${mappedData.length}명의 데이터를 불러왔습니다.`);
    } catch (error) {
      console.error('File import failed:', error);
      toast.error('파일을 읽는 중 오류가 발생했습니다.');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // ── Handle bulk registration ──
  const handleBulkRegister = async () => {
    if (!confId || bulkPreview.length === 0) {
      toast.error('등록할 데이터가 없습니다.');
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // Check for duplicate emails
      const duplicateEmails: string[] = [];
      bulkPreview.forEach(data => {
        const exists = externalAttendees.some(a => a.email === data.email);
        if (exists) duplicateEmails.push(data.email);
      });

      if (duplicateEmails.length > 0) {
        if (!confirm(`다음 이메일이 이미 등록되어 있습니다:\n${duplicateEmails.join('\n')}\n\n계속하시겠습니까?`)) {
          setIsProcessing(false);
          return;
        }
      }

      // Transaction for receipt numbers and batch creation
      const configRef = doc(db, `conferences/${confId}/settings/receipt_config`);
      const batchData = bulkPreview.map(data => generateAttendeeData(data, 'MANUAL_BULK'));

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

        transaction.set(configRef, { nextSerialNo: currentSerialNo + batchData.length }, { merge: true });
      });

      // Process Auth User creation one by one
      const total = batchData.length;
      for (let i = 0; i < batchData.length; i++) {
        const attendee = batchData[i];
        setProgress(Math.round(((i + 1) / total) * 100));
        try {
          // Log creation
          await addDoc(collection(db, `conferences/${confId}/external_attendees/${attendee.id}/logs`), {
            type: 'REGISTERED',
            timestamp: Timestamp.now(),
            method: 'MANUAL_BULK',
            operator: auth.user?.email
          });

          // Auto-create Auth User
          const passwordToUse = (attendee.password && attendee.password.length >= 6 ? attendee.password : (attendee.phone ? attendee.phone.replace(/[^0-9]/g, '').slice(-6).padStart(6, '0') : '123456'));

          const functions = getFunctions();
          const generateAuthUserFn = httpsCallable(functions, 'generateFirebaseAuthUserForExternalAttendee');
          const authResult = await generateAuthUserFn({
            confId,
            externalId: attendee.id,
            password: passwordToUse,
            email: attendee.email,
            name: attendee.name,
            phone: attendee.phone,
            organization: attendee.organization,
            licenseNumber: attendee.licenseNumber
          }) as { data: { success: boolean; uid: string; message: string } };

          if (authResult.data.success) {
            if (!attendee.password) {
              await updateDoc(doc(db, `conferences/${confId}/external_attendees`, attendee.id), {
                password: passwordToUse,
                userId: authResult.data.uid,
                authCreated: true
              });
            } else {
              await updateDoc(doc(db, `conferences/${confId}/external_attendees`, attendee.id), {
                userId: authResult.data.uid,
                authCreated: true
              });
            }
          }

          successCount++;
        } catch (err) {
          console.error(`Failed to register auth for ${attendee.name}:`, err);
          failCount++;
        }
      }

      setExternalAttendees(prev => [...batchData, ...prev]);
      setBulkPreview([]);

      if (failCount > 0) {
        toast(`DB저장은 완료되었으나 ${failCount}명의 계정 생성에 실패했습니다.`, { icon: '⚠️' });
      } else {
        toast.success(`${successCount}명의 외부 참석자가 등록되었습니다.`);
      }

    } catch (error) {
      console.error('Bulk registration main error:', error);
      toast.error('대량 등록 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  // ── Handle delete attendee ──
  const handleDelete = async (attendee: ExternalAttendee) => {
    if (!confirm(`${attendee.name} 님을 삭제하시겠습니까?`)) return;

    if (!confId) return;

    try {
      await updateDoc(doc(db, `conferences/${confId}/external_attendees`, attendee.id), {
        deleted: true,
        updatedAt: Timestamp.now()
      });

      await addDoc(collection(db, `conferences/${confId}/external_attendees/${attendee.id}/logs`), {
        type: 'DELETED',
        timestamp: Timestamp.now(),
        operator: auth.user?.email
      });

      toast.success('삭제되었습니다.');
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('삭제에 실패했습니다.');
    }
  };

  // ── Handle resend notification ──
  const handleResendNotification = async (attendee: ExternalAttendee) => {
    if (attendee.badgeIssued) {
      toast.error("이미 명찰이 발급되었습니다.");
      return;
    }
    if (!confirm(`${attendee.name} 님에게 바우처 알림톡을 재발송하시겠습니까?`)) return;
    if (!confId) return;

    setIsProcessing(true);
    try {
      const functions = getFunctions();
      const resendNotificationFn = httpsCallable(functions, 'resendBadgePrepToken');
      const result = await resendNotificationFn({
        confId,
        regId: attendee.id
      }) as { data: { success: boolean; newToken: string } };

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
  };

  // ── Handle bulk resend notifications ──
  const handleBulkResendNotification = async (mode: 'selected' | 'all') => {
    let targetAttendees = mode === 'selected'
      ? externalAttendees.filter(a => selectedIds.includes(a.id))
      : externalAttendees;

    const originalCount = targetAttendees.length;
    targetAttendees = targetAttendees.filter(a => !a.badgeIssued);

    if (originalCount > targetAttendees.length) {
      toast.error(`이미 명찰이 발급된 ${originalCount - targetAttendees.length}명은 제외되었습니다.`, { duration: 4000 });
    }

    if (targetAttendees.length === 0) {
      toast.error('발송할 대상을 선택해주세요.');
      return;
    }

    if (!confirm(`${targetAttendees.length}명의 참석자에게 알림톡을 ${mode === 'selected' ? '선택' : '전체'} 발송하시겠습니까?`)) return;
    if (!confId) return;

    setIsProcessing(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const chunkSize = 5;
      for (let i = 0; i < targetAttendees.length; i += chunkSize) {
        const chunk = targetAttendees.slice(i, i + chunkSize);
        setProgress(Math.round(((i + chunk.length) / targetAttendees.length) * 100));

        await Promise.all(chunk.map(async (attendee) => {
          try {
            const functions = getFunctions();
            const resendNotificationFn = httpsCallable(functions, 'resendBadgePrepToken');
            await resendNotificationFn({ confId, regId: attendee.id });
            successCount++;
          } catch (err) {
            console.error(`Failed notification for ${attendee.name}:`, err);
            failCount++;
          }
        }));
      }
      toast.success(`${successCount}명 발송 완료, ${failCount}명 실패.`);
      setSelectedIds([]);
    } catch (error) {
      console.error('Bulk notification failed:', error);
      toast.error('일괄 발송 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const toggleSelection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === externalAttendees.length && externalAttendees.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(externalAttendees.map(r => r.id));
    }
  };

  // ── Handle create account manually ──
  const handleCreateAccount = async (attendee: ExternalAttendee) => {
    if (!confirm(`${attendee.name} 님의 회원 계정을 생성하시겠습니까?\n(비밀번호가 없으면 전화번호 뒷 6자리가 사용됩니다)`)) return;
    if (!confId) return;

    setIsProcessing(true);
    try {
      const passwordToUse = (attendee.password && attendee.password.length >= 6 ? attendee.password : (attendee.phone ? attendee.phone.replace(/[^0-9]/g, '').slice(-6).padStart(6, '0') : '123456'));

      const functions = getFunctions();
      const generateAuthUserFn = httpsCallable(functions, 'generateFirebaseAuthUserForExternalAttendee');
      const authResult = await generateAuthUserFn({
        confId,
        externalId: attendee.id,
        password: passwordToUse,
        email: attendee.email,
        name: attendee.name,
        phone: attendee.phone,
        organization: attendee.organization,
        licenseNumber: attendee.licenseNumber
      }) as { data: { success: boolean; uid: string; message: string } };

      if (authResult.data.success) {
        toast.success(`계정이 생성되었습니다.\n비밀번호: ${passwordToUse}`);

        if (!attendee.password) {
          await updateDoc(doc(db, `conferences/${confId}/external_attendees`, attendee.id), {
            password: passwordToUse
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
  };

  // ── Handle issue badge ──
  const handleIssueBadge = async (attendee: ExternalAttendee) => {
    if (!confirm(`${attendee.name} 님의 명찰을 발급 처리하시겠습니까?`)) return;
    if (!confId) return;

    setIsProcessing(true);
    try {
      const functions = getFunctions();
      const issueBadgeFn = httpsCallable(functions, 'issueDigitalBadge');
      const result = await issueBadgeFn({
        confId,
        regId: attendee.id,
        issueOption: 'DIGITAL_PRINT'
      }) as { data: { success: boolean, badgeQr?: string } };

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
  };

  const handleBixolonPrint = async (attendee: ExternalAttendee) => {
    if (bixolonPrinting) return;

    const qrData = attendee.badgeQr || attendee.id;
    toast.loading("라벨 프린터 전송 중...", { id: 'bixolon-print' });

    try {
      let badgeLayout = null;

      // 1. Load Badge Layout from Settings
      if (confId) {
        try {
          const cfgSnap = await getDoc(doc(db, `conferences/${confId}/settings/badge_config`));
          if (cfgSnap.exists()) {
            const data = cfgSnap.data();
            if (data.badgeLayoutEnabled && data.badgeLayout) {
              badgeLayout = {
                ...data.badgeLayout,
                width: data.badgeLayout.width || 100,
                height: data.badgeLayout.height || 240,
                elements: data.badgeLayout.elements || [],
                enableCutting: data.badgeLayout.enableCutting || false
              };
            }
          }
        } catch (fetchErr) {
          console.error('[Bixolon] badge_config fetch failed:', fetchErr);
        }
      }

      // 2. Fallback to Slug if still missing
      if (!badgeLayout && slug) {
        try {
          const q = query(collection(db, 'conferences'), where('slug', '==', slug));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const cid = snap.docs[0].id;
            const cfgSnap = await getDoc(doc(db, `conferences/${cid}/settings/badge_config`));
            if (cfgSnap.exists()) {
              const data = cfgSnap.data();
              if (data.badgeLayoutEnabled && data.badgeLayout) {
                badgeLayout = {
                  ...data.badgeLayout,
                  width: data.badgeLayout.width || 100,
                  height: data.badgeLayout.height || 240,
                  elements: data.badgeLayout.elements || [],
                  enableCutting: data.badgeLayout.enableCutting || false
                };
              }
            }
          }
        } catch (fetchErr) {
          console.debug('Failed to fetch config by slug', fetchErr);
        }
      }

      // 3. Default layout fallback
      const activeLayout = badgeLayout || {
        width: 100,
        height: 240,
        unit: 'mm',
        elements: [
          { x: 50, y: 20, fontSize: 25, isVisible: true, type: 'QR' } as BadgeElement,
          { x: 50, y: 60, fontSize: 6, isVisible: true, type: 'NAME' } as BadgeElement,
          { x: 50, y: 80, fontSize: 4, isVisible: true, type: 'ORG' } as BadgeElement
        ]
      };

      const printSuccess = await printBadge(activeLayout, {
        name: attendee.name || '',
        org: attendee.organization || '',
        position: attendee.position || '',
        category: '외부참석자',
        license: attendee.licenseNumber || '',
        price: (attendee.amount || 0).toLocaleString() + '원',
        affiliation: attendee.organization || '',
        qrData: qrData
      });

      if (printSuccess) {
        toast.success("라벨 출력 성공", { id: 'bixolon-print' });
      } else {
        toast.error(bixolonError || '라벨 출력 실패', { id: 'bixolon-print', duration: 6000 });
      }
    } catch (error) {
      console.error('Bixolon print error:', error);
      toast.error("프린터 오류 발생", { id: 'bixolon-print' });
    }
  };

  // ── Download Excel template ──
  const downloadTemplate = () => {
    const templateData = [{
      '이름': '홍길동',
      '이메일': 'hong@example.com',
      '전화번호': '010-1234-5678',
      '소속': '서울대학교',
      '면허번호': '12345',
      '등록비': 0,
      '비밀번호': 'mypassword123 (미입력시 전화번호 뒷 6자리)'
    }];
    exportToExcel(templateData, 'external_attendees_template', 'Template');
  };

  return {
    // Data
    externalAttendees,
    loading,
    isProcessing,
    progress,
    fieldSettings,
    receiptConfig,

    // Individual form
    formData,
    setFormData,
    noEmail,
    handleNoEmailChange,
    showPassword,
    setShowPassword,
    handleIndividualRegister,

    // Bulk
    bulkPreview,
    setBulkPreview,
    handleFileUpload,
    handleBulkRegister,
    downloadTemplate,

    // List actions
    selectedIds,
    toggleSelection,
    toggleSelectAll,
    handleExport,
    handleDelete,
    handleResendNotification,
    handleBulkResendNotification,
    handleCreateAccount,
    handleIssueBadge,
    handleBixolonPrint,

    // Voucher modal
    showVoucherModal,
    setShowVoucherModal,
    selectedAttendee,
    setSelectedAttendee,

  // Helpers
  confBaseUrl,
  confSlug,

  // External states
    exporting,
    bixolonPrinting,
  };
}
