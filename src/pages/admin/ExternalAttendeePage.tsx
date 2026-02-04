import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useConference } from '../../hooks/useConference';
import { useAuth } from '../../hooks/useAuth';
import { collection, getDoc, doc, setDoc, updateDoc, Timestamp, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { UserPlus, Upload, Download, FileText, Badge, CheckCircle2, Trash2, Loader2, Eye, EyeOff, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ExternalAttendee } from '../../types/schema';

const ExternalAttendeePage: React.FC = () => {
    const navigate = useNavigate();
    const { cid } = useParams<{ cid: string }>();
    const { id: confId, info } = useConference(cid);
    const { auth } = useAuth(confId || '');

    const [externalAttendees, setExternalAttendees] = useState<ExternalAttendee[]>([]);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // Fetch external attendees with real-time updates
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

    // Individual Registration Form
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        organization: '',
        licenseNumber: '',
        amount: 0,
        password: ''
    });
    const [showPassword, setShowPassword] = useState(false);

    // Bulk Upload
    const [bulkPreview, setBulkPreview] = useState<Array<{ name: string; email: string; phone: string; organization: string; licenseNumber?: string; amount?: number; password?: string }>>([]);

    // Voucher Modal
    const [showVoucherModal, setShowVoucherModal] = useState(false);
    const [selectedAttendee, setSelectedAttendee] = useState<ExternalAttendee | null>(null);

    // Badge Modal
    const [showBadgeModal, setShowBadgeModal] = useState(false);

    // Receipt Config
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
            }
        };

        fetchConfig();
    }, [confId]);

    // Generate unique UID and QR codes
    const generateAttendeeData = (data: { name: string; email: string; phone: string; organization: string; licenseNumber?: string; amount?: number; password?: string }, registrationType: 'MANUAL_INDIVIDUAL' | 'MANUAL_BULK') => {
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
            licenseNumber: data.licenseNumber || '',
            password: data.password || undefined, // Store password for Firebase Auth creation
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
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };
    };

    // Handle individual registration
    const handleIndividualRegister = async () => {
        if (!formData.name || !formData.email || !formData.phone || !formData.organization) {
            toast.error('모든 필수 항목을 입력해주세요.');
            return;
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

            const attendeeData = generateAttendeeData(formData, 'MANUAL_INDIVIDUAL');

            await setDoc(doc(db, `conferences/${confId}/external_attendees`, attendeeData.id), attendeeData);

            // Update receipt serial number
            if (receiptConfig) {
                await updateDoc(doc(db, `conferences/${confId}/settings/receipt_config`), {
                    nextSerialNo: receiptConfig.nextSerialNo + 1
                });
            }

            // Add log
            await addDoc(collection(db, `conferences/${confId}/external_attendees/${attendeeData.id}/logs`), {
                type: 'REGISTERED',
                timestamp: Timestamp.now(),
                method: 'MANUAL_INDIVIDUAL',
                operator: auth.user?.email
            });

            // [SCENARIO FIX] Force Signup & Generate UID immediately
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
                        licenseNumber: formData.licenseNumber
                    }) as { data: { success: boolean; uid: string; message: string } };

                    if (authResult.data.success) {
                        toast.success('회원 계정이 자동으로 생성되었습니다.');
                        // Update local state with new userId
                        attendeeData.userId = authResult.data.uid;
                    }
                } catch (authError) {
                    console.error('Failed to auto-create auth user:', authError);
                    toast.error('회원 계정 생성 실패 (나중에 명찰 발급 시 재시도됩니다)');
                }
            }

            setExternalAttendees(prev => [attendeeData, ...prev]);
            setFormData({ name: '', email: '', phone: '', organization: '', licenseNumber: '', amount: 0, password: '' });
            toast.success('외부 참석자가 등록되었습니다.');
        } catch (error) {
            console.error('Registration failed:', error);
            toast.error('등록에 실패했습니다.');
        } finally {
            setIsProcessing(false);
        }
    };

    // Handle CSV file upload
    const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const lines = text.split('\n');
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

            const data = lines.slice(1).filter(line => line.trim()).map(line => {
                const values = line.split(',');
                const obj: Record<string, string> = {};
                headers.forEach((header, index) => {
                    obj[header] = values[index]?.trim() || '';
                });
                // Type assertion to match expected interface
                return {
                    name: obj.name || '',
                    email: obj.email || '',
                    phone: obj.phone || '',
                    organization: obj.organization || '',
                    licenseNumber: obj.licensenumber,
                    amount: obj.amount ? parseFloat(obj.amount) : 0,
                    password: obj.password
                } as { name: string; email: string; phone: string; organization: string; licenseNumber?: string; amount?: number; password?: string };
            });

            setBulkPreview(data);
        };
        reader.readAsText(file);
    };

    // Handle bulk registration
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

            const batch = bulkPreview.map(data => generateAttendeeData(data, 'MANUAL_BULK'));

            // Process one by one to avoid overwhelming Cloud Functions
            for (const attendee of batch) {
                try {
                    // 1. Create Firestore Document
                    await setDoc(doc(db, `conferences/${confId}/external_attendees`, attendee.id), attendee);

                    await addDoc(collection(db, `conferences/${confId}/external_attendees/${attendee.id}/logs`), {
                        type: 'REGISTERED',
                        timestamp: Timestamp.now(),
                        method: 'MANUAL_BULK',
                        operator: auth.user?.email
                    });

                    // 2. Auto-create Auth User
                    // Use provided password or fallback to phone last 4 digits or default
                    const passwordToUse = attendee.password || (attendee.phone ? attendee.phone.slice(-4) : '123456');

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
                        // Update with generated password if it was auto-generated
                        if (!attendee.password) {
                            await updateDoc(doc(db, `conferences/${confId}/external_attendees`, attendee.id), {
                                password: passwordToUse,
                                userId: authResult.data.uid, // Ensure sync
                                authCreated: true
                            });
                        } else {
                            // Just sync UID
                            await updateDoc(doc(db, `conferences/${confId}/external_attendees`, attendee.id), {
                                userId: authResult.data.uid,
                                authCreated: true
                            });
                        }
                    }

                    successCount++;
                } catch (err) {
                    console.error(`Failed to register ${attendee.name}:`, err);
                    failCount++;
                }
            }

            // Update receipt serial number
            if (receiptConfig) {
                await updateDoc(doc(db, `conferences/${confId}/settings/receipt_config`), {
                    nextSerialNo: receiptConfig.nextSerialNo + batch.length
                });
            }

            setExternalAttendees(prev => [...batch, ...prev]); // Optimistic update, but snapshot will correct it
            setBulkPreview([]);

            if (failCount > 0) {
                toast(`완료되었으나 ${failCount}명의 처리에 실패했습니다.`, { icon: '⚠️' });
            } else {
                toast.success(`${successCount}명의 외부 참석자가 등록되었습니다.`);
            }

        } catch (error) {
            console.error('Bulk registration main error:', error);
            toast.error('대량 등록 중 오류가 발생했습니다.');
        } finally {
            setIsProcessing(false);
        }
    };

    // Handle delete attendee
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

    // Handle create account manually
    const handleCreateAccount = async (attendee: ExternalAttendee) => {
        if (!confirm(`${attendee.name} 님의 회원 계정을 생성하시겠습니까?\n(비밀번호가 없으면 전화번호 뒷 4자리가 사용됩니다)`)) return;
        if (!confId) return;

        setIsProcessing(true);
        try {
            const passwordToUse = attendee.password || (attendee.phone ? attendee.phone.slice(-4) : '123456');

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
                // Update local state is handled by onSnapshot, but let's force update if needed or just wait
                // Actually onSnapshot might not catch the deep update if it only listens to doc changes? 
                // Wait, generateAuthUserFn updates the doc with userId, so onSnapshot WILL pick it up.
                toast.success(`계정이 생성되었습니다.\n비밀번호: ${passwordToUse}`);

                // If password was auto-generated, update the doc so we have record of it (optional, but good for admin to know)
                if (!attendee.password) {
                    await updateDoc(doc(db, `conferences/${confId}/external_attendees`, attendee.id), {
                        password: passwordToUse
                    });
                }
            } else {
                throw new Error(authResult.data.message);
            }
        } catch (error: any) {
            console.error('Account creation failed:', error);
            toast.error(`계정 생성 실패: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // Handle issue badge
    const handleIssueBadge = async (attendee: ExternalAttendee) => {
        if (!confirm(`${attendee.name} 님의 명찰을 발급하시겠습니까?`)) return;
        if (!confId) return;

        setIsProcessing(true);
        try {
            // STEP 1: Generate Firebase Auth User if not exists
            let firebaseUid = attendee.userId || attendee.uid;

            // Check if we need to generate auth user (if userId is missing or placeholder)
            if (!firebaseUid || firebaseUid.startsWith('EXT-') || !attendee.authCreated) {
                try {
                    const functions = getFunctions();
                    const generateAuthUserFn = httpsCallable(functions, 'generateFirebaseAuthUserForExternalAttendee');
                    const authResult = await generateAuthUserFn({
                        confId,
                        externalId: attendee.id,
                        password: attendee.password || (attendee.phone ? attendee.phone.slice(-4) : '123456')
                    }) as { data: { success: boolean; uid: string; message: string } };

                    if (authResult.data.success) {
                        firebaseUid = authResult.data.uid;
                    }
                } catch (e) {
                    console.warn("Auto-creation of auth user failed during badge issue, proceeding with simple badge...", e);
                    // Decide if we stop or continue. Let's continue but warn.
                }
            }

            // STEP 2: Generate badge prep token if not exists
            if (!attendee.badgePrepToken) {
                const tokenChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                let token = 'TKN-';
                for (let i = 0; i < 32; i++) {
                    token += tokenChars.charAt(Math.floor(Math.random() * tokenChars.length));
                }

                await updateDoc(doc(db, `conferences/${confId}/external_attendees`, attendee.id), {
                    badgePrepToken: token,
                    userId: firebaseUid, // Use Firebase UID
                    updatedAt: Timestamp.now()
                });

                // Create badge token document
                await setDoc(doc(db, `conferences/${confId}/badge_tokens`, token), {
                    token,
                    registrationId: attendee.id,
                    conferenceId: confId,
                    userId: firebaseUid, // Use Firebase UID
                    status: 'ACTIVE',
                    createdAt: Timestamp.now(),
                    expiresAt: Timestamp.now()
                });

                // Update attendee with token
                setExternalAttendees(prev => prev.map(a =>
                    a.id === attendee.id ? { ...a, badgePrepToken: token, userId: firebaseUid } : a
                ));
            }

            // STEP 3: Issue badge using Cloud Function
            const functions = getFunctions();
            const issueDigitalBadgeFn = httpsCallable(functions, 'issueDigitalBadge');
            const result = await issueDigitalBadgeFn({
                confId,
                regId: attendee.id,
                issueOption: 'DIGITAL_PRINT',
                isExternalAttendee: true
            }) as { data: { success: boolean; badgeQr: string } };

            if (!result.data.success) {
                throw new Error('Failed to issue digital badge');
            }

            // Update local state
            setExternalAttendees(prev => prev.map(a =>
                a.id === attendee.id ? { ...a, badgeIssued: true, badgeIssuedAt: Timestamp.now(), badgeQr: result.data.badgeQr } : a
            ));

            setShowBadgeModal(true);
            setSelectedAttendee(attendee);
            toast.success('명찰이 발급되었습니다.');
        } catch (error) {
            console.error('Badge issue failed:', error);
            toast.error('명찰 발급에 실패했습니다.');
        } finally {
            setIsProcessing(false);
        }
    };

    // Download CSV template
    const downloadTemplate = () => {
        const template = 'name,email,phone,organization,licenseNumber,amount,password\n홍길동,hong@example.com,010-1234-5678,서울대학교,12345,0,mypassword123';
        const blob = new Blob([template], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'external_attendees_template.csv';
        a.click();
        void URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto py-8 px-4">
                <div className="mb-8">
                    <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
                        ← 뒤로가기
                    </Button>
                    <h1 className="text-3xl font-bold text-gray-900">외부 참석자 관리</h1>
                    <p className="text-gray-600 mt-2">
                        {info?.title?.ko || '학술대회'}의 외부 참석자를 수동으로 등록하고 관리합니다.
                    </p>
                </div>

                <Tabs defaultValue="individual" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="individual">개별등록</TabsTrigger>
                        <TabsTrigger value="bulk">대량등록</TabsTrigger>
                        <TabsTrigger value="list">등록현황 ({externalAttendees.length})</TabsTrigger>
                    </TabsList>

                    {/* Individual Registration Tab */}
                    <TabsContent value="individual">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <UserPlus className="w-5 h-5" />
                                    개별 등록
                                </CardTitle>
                                <CardDescription>
                                    외부 참석자를 한 명씩 수동으로 등록합니다. <br />
                                    <span className="text-blue-600 font-semibold">* 등록 시 회원 계정이 자동으로 생성됩니다. (비밀번호 미입력 시 전화번호 뒷 4자리)</span>
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>이름 <span className="text-red-500">*</span></Label>
                                        <Input
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="홍길동"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>이메일 <span className="text-red-500">*</span></Label>
                                        <Input
                                            type="email"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="example@email.com"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>전화번호 <span className="text-red-500">*</span></Label>
                                        <Input
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="010-1234-5678"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>소속 <span className="text-red-500">*</span></Label>
                                        <Input
                                            value={formData.organization}
                                            onChange={e => setFormData({ ...formData, organization: e.target.value })}
                                            placeholder="병원/학교명"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>면허번호 (선택)</Label>
                                        <Input
                                            value={formData.licenseNumber}
                                            onChange={e => setFormData({ ...formData, licenseNumber: e.target.value })}
                                            placeholder="면허번호"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>등록비 (선택)</Label>
                                        <Input
                                            type="number"
                                            value={formData.amount}
                                            onChange={e => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>비밀번호 (선택)</Label>
                                        <div className="relative">
                                            <Input
                                                type={showPassword ? 'text' : 'password'}
                                                value={formData.password}
                                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                                placeholder="미입력 시 전화번호 뒷 4자리"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-500">회원가입에 사용될 비밀번호입니다.</p>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button onClick={handleIndividualRegister} disabled={isProcessing} className="w-full">
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            처리 중...
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus className="w-4 h-4 mr-2" />
                                            등록 및 계정 생성
                                        </>
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>

                    {/* Bulk Registration Tab */}
                    <TabsContent value="bulk">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Upload className="w-5 h-5" />
                                    대량 등록
                                </CardTitle>
                                <CardDescription>
                                    CSV 파일로 외부 참석자를 일괄 등록합니다. <br />
                                    <span className="text-blue-600 font-semibold">* 등록된 모든 참석자에 대해 회원 계정이 자동 생성됩니다.</span>
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-2">
                                    <Button onClick={downloadTemplate} variant="outline">
                                        <Download className="w-4 h-4 mr-2" />
                                        템플릿 다운로드
                                    </Button>
                                    <div className="flex-1">
                                        <Input
                                            type="file"
                                            accept=".csv"
                                            onChange={handleCsvUpload}
                                            className="cursor-pointer"
                                        />
                                    </div>
                                </div>

                                {bulkPreview.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-sm text-gray-600">등록 예정: {bulkPreview.length}명</p>
                                        <div className="border rounded-lg max-h-64 overflow-y-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 sticky top-0">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left">이름</th>
                                                        <th className="px-4 py-2 text-left">이메일</th>
                                                        <th className="px-4 py-2 text-left">전화번호</th>
                                                        <th className="px-4 py-2 text-left">소속</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {bulkPreview.map((item) => (
                                                        <tr key={`${item.email}-${item.name}`} className="border-t">
                                                            <td className="px-4 py-2">{item.name}</td>
                                                            <td className="px-4 py-2">{item.email}</td>
                                                            <td className="px-4 py-2">{item.phone}</td>
                                                            <td className="px-4 py-2">{item.organization}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter>
                                <Button
                                    onClick={handleBulkRegister}
                                    disabled={isProcessing || bulkPreview.length === 0}
                                    className="w-full"
                                >
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            일괄 등록 및 계정 생성 중...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4 mr-2" />
                                            {bulkPreview.length}명 일괄 등록
                                        </>
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>

                    {/* List Tab */}
                    <TabsContent value="list">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <UserPlus className="w-5 h-5" />
                                    등록된 외부 참석자 ({externalAttendees.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-semibold">이름</th>
                                                <th className="px-4 py-3 text-left font-semibold">이메일</th>
                                                <th className="px-4 py-3 text-left font-semibold">전화번호 / 소속</th>
                                                <th className="px-4 py-3 text-center font-semibold">계정상태</th>
                                                <th className="px-4 py-3 text-center font-semibold">명찰</th>
                                                <th className="px-4 py-3 text-center font-semibold">관리</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {externalAttendees.map(attendee => {
                                                const hasAccount = attendee.authCreated || (attendee.userId && !attendee.userId.startsWith('EXT-'));
                                                return (
                                                    <tr key={attendee.id} className="border-t hover:bg-gray-50">
                                                        <td className="px-4 py-3 font-medium">{attendee.name}</td>
                                                        <td className="px-4 py-3">{attendee.email}</td>
                                                        <td className="px-4 py-3">
                                                            <div>{attendee.phone}</div>
                                                            <div className="text-gray-500 text-xs">{attendee.organization}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {hasAccount ? (
                                                                <div className="flex flex-col items-center">
                                                                    <span className="text-green-600 text-xs font-semibold bg-green-100 px-2 py-1 rounded-full">생성완료</span>
                                                                    {attendee.password && (
                                                                        <span className="text-xs text-gray-400 mt-1 cursor-pointer" onClick={() => {
                                                                            navigator.clipboard.writeText(attendee.password!);
                                                                            toast.success('비밀번호 복사됨');
                                                                        }} title="비밀번호 복사">PW복사</span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <Button
                                                                    size="sm"
                                                                    variant="default"
                                                                    className='bg-blue-600 hover:bg-blue-700 h-7 text-xs'
                                                                    onClick={() => handleCreateAccount(attendee)}
                                                                    disabled={isProcessing}
                                                                >
                                                                    계정 생성
                                                                </Button>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {attendee.badgeIssued ? (
                                                                <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" />
                                                            ) : (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-7 text-xs"
                                                                    onClick={() => handleIssueBadge(attendee)}
                                                                    disabled={isProcessing}
                                                                >
                                                                    <Badge className="w-3 h-3 mr-1" />
                                                                    발급
                                                                </Button>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex justify-center gap-1">
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 p-0"
                                                                    onClick={() => {
                                                                        setSelectedAttendee(attendee);
                                                                        setShowVoucherModal(true);
                                                                    }}
                                                                >
                                                                    <FileText className="w-4 h-4" />
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                    onClick={() => handleDelete(attendee)}
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Voucher Modal */}
            <Dialog open={showVoucherModal} onOpenChange={setShowVoucherModal}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>바우처</DialogTitle>
                    </DialogHeader>
                    {selectedAttendee && (
                        <div className="mt-4 p-6 bg-white border rounded-lg">
                            <div className="text-center space-y-4">
                                <h2 className="text-2xl font-bold">영수증</h2>
                                <div className="border-t border-b py-4 space-y-2">
                                    <p><strong>발행처:</strong> {receiptConfig?.issuerName || 'eRegi'}</p>
                                    <p><strong>영수증 번호:</strong> {selectedAttendee.receiptNumber}</p>
                                    <p><strong>성명:</strong> {selectedAttendee.name}</p>
                                    <p><strong>소속:</strong> {selectedAttendee.organization}</p>
                                    <p><strong>등록비:</strong> ₩{selectedAttendee.amount.toLocaleString()}</p>
                                    <p><strong>등록일:</strong> {selectedAttendee.createdAt.toDate().toLocaleDateString('ko-KR')}</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded">
                                    <p className="text-sm text-gray-600 mb-2">확인용 QR 코드</p>
                                    <div className="text-2xl font-mono font-bold tracking-widest">
                                        {selectedAttendee.confirmationQr}
                                    </div>
                                </div>
                                {selectedAttendee.password && (
                                    <div className="p-4 bg-blue-50 rounded border border-blue-200">
                                        <p className="text-sm text-gray-600 mb-2">비밀번호 (Firebase Auth)</p>
                                        <div className="flex items-center justify-center gap-2">
                                            <span className="text-xl font-mono font-bold text-blue-800">
                                                {selectedAttendee.password}
                                            </span>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(selectedAttendee.password!);
                                                    toast.success('비밀번호가 복사되었습니다.');
                                                }}
                                            >
                                                <Copy className="w-4 h-4 mr-1" />
                                                복사
                                            </Button>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">
                                            이 비밀번호로 마이페이지에 로그인할 수 있습니다.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Badge Modal */}
            <Dialog open={showBadgeModal} onOpenChange={setShowBadgeModal}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>명찰 발급 완료</DialogTitle>
                    </DialogHeader>
                    {selectedAttendee && (
                        <div className="mt-4 p-6 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg text-white text-center">
                            <h3 className="text-xl font-bold mb-2">{selectedAttendee.name}</h3>
                            <p className="text-sm mb-4">{selectedAttendee.organization}</p>
                            <div className="bg-white p-4 rounded-lg inline-block">
                                <div className="text-3xl font-mono font-black text-blue-900 tracking-widest">
                                    {selectedAttendee.badgeQr}
                                </div>
                            </div>
                            <p className="text-xs mt-4 opacity-80">디지털 명찰 QR 코드</p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ExternalAttendeePage;
