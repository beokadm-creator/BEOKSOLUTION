import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAdminStore } from '../../store/adminStore';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Bell, Mail, Save, CreditCard, Globe, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge } from '../../components/ui/badge';

interface InfraSettings {
    payment: {
        domestic: {
            provider: 'TOSS' | 'KCP' | 'KICC' | '';
            merchantId: string;
            apiKey: string;
            secretKey: string;
            isTestMode: boolean;
        };
        global: {
            enabled: boolean;
            provider: 'EXIMBAY' | 'PAYPAL' | '';
            merchantId: string;
            secretKey: string;
            currency: string; // Always "KRW"
        };
    };
    notification: {
        // channelId removed (legacy Aligo)
        nhnAlimTalk?: {
            enabled: boolean;
            senderKey: string; // NHN Cloud 발신 프로필 키 (학회별로 다름)
            resendSendNo?: string; // 대체 발송용 발신번호
        };
    };
    email: {
        host: string;
        port: string;
        user: string;
        pass: string;
        fromEmail: string;
        fromName: string;
    };
}

const defaultSettings: InfraSettings = {
    payment: {
        domestic: {
            provider: '',
            merchantId: '',
            apiKey: '',
            secretKey: '',
            isTestMode: true,
        },
        global: {
            enabled: false,
            provider: '',
            merchantId: '',
            secretKey: '',
            currency: 'KRW',
        },
    },
    notification: {
        // channelId removed

        nhnAlimTalk: {
            enabled: false,
            senderKey: '',
            resendSendNo: '',
        },
    },
    email: {
        host: '',
        port: '',
        user: '',
        pass: '',
        fromEmail: '',
        fromName: '',
    },
};

export default function InfraPage() {
    const { selectedSocietyId } = useAdminStore();
    const [settings, setSettings] = useState<InfraSettings>(defaultSettings);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            // Determine society ID from URL if store is empty
            const hostname = window.location.hostname;
            const parts = hostname.split('.');
            let targetId = selectedSocietyId;

            if (!targetId && parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') {
                targetId = parts[0];
            }
            if (!targetId && (hostname === 'localhost' || hostname === '127.0.0.1')) {
                targetId = 'kap'; // Fallback
            }

            if (!targetId) {
                setLoading(false);
                return;
            }

            try {
                const docRef = doc(db, 'societies', targetId, 'settings', 'infrastructure');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    // Merge with default to ensure all fields exist
                    const data = docSnap.data() as Partial<InfraSettings>;
                    setSettings({
                        payment: {
                            domestic: { ...defaultSettings.payment.domestic, ...(data.payment?.domestic || {}) },
                            global: { ...defaultSettings.payment.global, ...(data.payment?.global || {}) },
                        },
                        notification: {
                            // channelId removed
                            nhnAlimTalk: {
                                ...defaultSettings.notification.nhnAlimTalk,
                                ...(data.notification?.nhnAlimTalk || {}),
                            },
                        },
                        email: { ...defaultSettings.email, ...data.email },
                    });
                }
            } catch (error) {
                console.error("Failed to fetch infra settings:", error);
                toast.error("설정을 불러오는데 실패했습니다.");
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, [selectedSocietyId]);

    const handleSave = async () => {
        // Determine society ID same as fetch
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        let targetId = selectedSocietyId;
        if (!targetId && parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') {
            targetId = parts[0];
        }
        if (!targetId && (hostname === 'localhost' || hostname === '127.0.0.1')) {
            targetId = 'kap';
        }

        if (!targetId) {
            toast.error("학회 정보가 없습니다.");
            return;
        }

        setSaving(true);
        try {
            const docRef = doc(db, 'societies', targetId, 'settings', 'infrastructure');
            await setDoc(docRef, settings);
            toast.success("설정이 저장되었습니다.");
        } catch (error) {
            console.error("Failed to save infra settings:", error);
            toast.error("설정 저장에 실패했습니다.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#003366] mb-4" />
            <p className="text-slate-500 font-medium">설정 로딩 중...</p>
        </div>
    );

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-[#003366]" />
                        인프라 설정
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">결제 게이트웨이, 알림 채널, 이메일 서비스를 관리합니다.</p>
                </div>
                <Button onClick={handleSave} disabled={saving} className="bg-[#003366] hover:bg-[#002244] text-white rounded-xl gap-2 transition-colors">
                    <Save className="w-4 h-4" />
                    {saving ? '저장 중...' : '설정 저장'}
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Domestic Payment Gateway */}
                <Card className="rounded-2xl border border-[#c3daee] shadow-sm overflow-hidden bg-white">
                    <CardHeader className="bg-[#f0f5fa] border-b border-[#c3daee] px-6 py-4">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-[#f0f5fa] rounded-xl text-[#003366]">
                                    <CreditCard className="w-4 h-4 text-[#003366]" />
                                </div>
                                <div>
                                    <CardTitle className="text-base font-semibold text-gray-800">국내 결제 (PG)</CardTitle>
                                    <CardDescription className="text-sm text-gray-500 mt-0.5">국내 발급 카드 (원화)</CardDescription>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-[#c3daee] shadow-sm">
                                <span className={`w-2 h-2 rounded-full ${settings.payment.domestic.isTestMode ? 'bg-amber-400' : 'bg-green-500 animate-pulse'}`} />
                                <span className="text-xs font-bold text-slate-600">
                                    {settings.payment.domestic.isTestMode ? '테스트 모드' : '라이브 모드'}
                                </span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <div className="grid grid-cols-1 gap-5">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-gray-700">PG사</Label>
                                <Select
                                    value={settings.payment.domestic.provider}
                                    onValueChange={(val) => setSettings(prev => ({
                                        ...prev,
                                        payment: {
                                            ...prev.payment,
                                            domestic: { ...prev.payment.domestic, provider: val as 'TOSS' | 'KCP' | 'KICC' }
                                        }
                                    }))}
                                >
                                    <SelectTrigger className="h-11 rounded-xl border-[#c3daee] focus:ring-[#003366]/20 font-medium">
                                        <SelectValue placeholder="PG사 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="TOSS">Toss Payments (권장)</SelectItem>
                                        <SelectItem value="KCP">NHN KCP</SelectItem>
                                        <SelectItem value="KICC">EasyPay (KICC)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="bg-[#f0f5fa] p-4 rounded-xl border border-[#c3daee] flex items-center justify-between group transition-colors">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-medium text-gray-700">샌드박스 환경 (테스트)</Label>
                                    <p className="text-xs text-slate-500">실제 결제 없이 테스트 거래를 활성화합니다.</p>
                                </div>
                                <Switch
                                    checked={settings.payment.domestic.isTestMode}
                                    onChange={(e) => setSettings(prev => ({
                                        ...prev,
                                        payment: { ...prev.payment, domestic: { ...prev.payment.domestic, isTestMode: e.target.checked } }
                                    }))}
                                    className="data-[state=checked]:bg-amber-500"
                                />
                            </div>

                            <div className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700">가맹점 ID (MID)</Label>
                                    <Input
                                        value={settings.payment.domestic.merchantId}
                                        onChange={(e) => setSettings(prev => ({ ...prev, payment: { ...prev.payment, domestic: { ...prev.payment.domestic, merchantId: e.target.value } } }))}
                                        className="h-11 font-mono text-sm border-[#c3daee] focus:bg-white transition-colors rounded-xl"
                                        placeholder="e.g. tosspayments"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700">API 키</Label>
                                    <Input
                                        value={settings.payment.domestic.apiKey}
                                        onChange={(e) => setSettings(prev => ({ ...prev, payment: { ...prev.payment, domestic: { ...prev.payment.domestic, apiKey: e.target.value } } }))}
                                        type="password"
                                        className="h-11 font-mono text-sm border-[#c3daee] focus:bg-white transition-colors rounded-xl tracking-widest"
                                        placeholder="test_ck_..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700">시크릿 키</Label>
                                    <Input
                                        value={settings.payment.domestic.secretKey}
                                        onChange={(e) => setSettings(prev => ({ ...prev, payment: { ...prev.payment, domestic: { ...prev.payment.domestic, secretKey: e.target.value } } }))}
                                        type="password"
                                        className="h-11 font-mono text-sm border-[#c3daee] focus:bg-white transition-colors rounded-xl tracking-widest"
                                        placeholder="test_sk_..."
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Global Payment Gateway */}
                <Card className="rounded-2xl border border-[#c3daee] shadow-sm overflow-hidden bg-white h-fit">
                    <CardHeader className="bg-[#f0f5fa] border-b border-[#c3daee] px-6 py-4">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-[#f0f5fa] rounded-xl text-[#003366]">
                                    <Globe className="w-4 h-4 text-[#003366]" />
                                </div>
                                <div>
                                    <CardTitle className="text-base font-semibold text-gray-800">해외 결제 (PG)</CardTitle>
                                    <CardDescription className="text-sm text-gray-500 mt-0.5">해외 카드 (원화 정산)</CardDescription>
                                </div>
                            </div>
                            <Badge variant={settings.payment.global.enabled ? 'default' : 'secondary'} className={settings.payment.global.enabled ? "bg-[#003366] hover:bg-[#002244] h-7" : "bg-slate-200 text-slate-500 h-7"}>
                                {settings.payment.global.enabled ? '활성' : '비활성'}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <div className="bg-amber-50 border border-amber-200/60 p-4 rounded-xl flex gap-3">
                            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="text-xs text-amber-900 leading-relaxed">
                                <p className="font-bold mb-1">KRW Settlement Requirement</p>
                                All international transactions will be processed and settled in <span className="font-bold underline">KRW</span>. Ensure your global PG contract supports this to avoid settlement failures.
                            </div>
                        </div>

                        <div className="bg-[#f0f5fa] p-4 rounded-xl border border-[#c3daee] flex items-center justify-between group transition-colors">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-medium text-gray-700">해외 결제 허용</Label>
                                <p className="text-xs text-slate-500">Visa, Mastercard, JCB 해외 결제를 허용합니다.</p>
                            </div>
                            <Switch
                                checked={settings.payment.global.enabled}
                                onChange={(e) => setSettings(prev => ({
                                    ...prev,
                                    payment: { ...prev.payment, global: { ...prev.payment.global, enabled: e.target.checked } }
                                }))}
                                className="data-[state=checked]:bg-[#003366]"
                            />
                        </div>

                        {settings.payment.global.enabled && (
                            <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700">PG사</Label>
                                    <Select
                                        value={settings.payment.global.provider}
                                        onValueChange={(val) => setSettings(prev => ({
                                            ...prev,
                                            payment: { ...prev.payment, global: { ...prev.payment.global, provider: val as 'EXIMBAY' | 'STRIPE' | 'PAYPAL' } }
                                        }))}
                                    >
                                        <SelectTrigger className="h-11 rounded-xl border-[#c3daee] font-medium">
                                            <SelectValue placeholder="해외 PG사 선택" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="EXIMBAY">Eximbay (권장)</SelectItem>
                                            <SelectItem value="PAYPAL">PayPal</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700">가맹점 ID (MID)</Label>
                                    <Input
                                        value={settings.payment.global.merchantId}
                                        onChange={(e) => setSettings(prev => ({ ...prev, payment: { ...prev.payment, global: { ...prev.payment.global, merchantId: e.target.value } } }))}
                                        className="h-11 font-mono text-sm border-[#c3daee] rounded-xl"
                                        placeholder="e.g., eximbay_mid"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700">시크릿 키</Label>
                                    <Input
                                        value={settings.payment.global.secretKey}
                                        onChange={(e) => setSettings(prev => ({ ...prev, payment: { ...prev.payment, global: { ...prev.payment.global, secretKey: e.target.value } } }))}
                                        type="password"
                                        className="h-11 font-mono text-sm border-[#c3daee] rounded-xl tracking-widest"
                                        placeholder="해외 결제 시크릿 키..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700">정산 통화</Label>
                                    <div className="flex items-center bg-gray-100 rounded-xl h-11 px-4 border border-gray-200 text-gray-500 font-bold text-sm">
                                        KRW (고정)
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 3. Notification Service */}
                <Card className="rounded-2xl border border-[#c3daee] shadow-sm overflow-hidden bg-white h-fit">
                    <CardHeader className="bg-[#f0f5fa] border-b border-[#c3daee] px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-[#f0f5fa] rounded-xl text-[#003366]">
                                <Bell className="w-4 h-4 text-[#003366]" />
                            </div>
                            <div>
                                <CardTitle className="text-base font-semibold text-gray-800">알림 서비스</CardTitle>
                                <CardDescription className="text-sm text-gray-500 mt-0.5">카카오 알림톡 연동</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">


                        {/* NHN AlimTalk Section */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700">NHN 클라우드 알림톡</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">학회별 발신 프로필</p>
                                </div>
                                <Badge variant={settings.notification.nhnAlimTalk?.enabled ? 'default' : 'secondary'}
                                    className={settings.notification.nhnAlimTalk?.enabled ? "bg-emerald-600 hover:bg-emerald-700 h-7" : "bg-slate-200 text-slate-500 h-7"}>
                                    {settings.notification.nhnAlimTalk?.enabled ? '활성' : '비활성'}
                                </Badge>
                            </div>

                            <div className="bg-[#f0f5fa] p-4 rounded-xl border border-[#c3daee] flex items-center justify-between group transition-colors">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-medium text-gray-700">NHN 알림톡 활성화</Label>
                                    <p className="text-xs text-slate-500">이 학회의 알림에 NHN Cloud를 사용합니다.</p>
                                </div>
                                <Switch
                                    checked={settings.notification.nhnAlimTalk?.enabled || false}
                                    onChange={(e) => setSettings(prev => ({
                                        ...prev,
                                        notification: {
                                            ...prev.notification,
                                            nhnAlimTalk: {
                                                ...prev.notification.nhnAlimTalk!,
                                                enabled: e.target.checked
                                            }
                                        }
                                    }))}
                                    className="data-[state=checked]:bg-emerald-600"
                                />
                            </div>

                            {settings.notification.nhnAlimTalk?.enabled && (
                                <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-4 duration-300">
                                    <div className="bg-[#f0f5fa] border border-[#c3daee] p-4 rounded-xl flex gap-3">
                                        <Info className="w-5 h-5 text-[#003366] shrink-0 mt-0.5" />
                                        <div className="text-xs text-slate-900 leading-relaxed">
                                            <p className="font-bold mb-1">학회별 설정</p>
                                            <span className="font-bold">senderKey</span>만 학회별로 다릅니다. appKey와 secretKey는 관리자가 관리하는 시스템 공통 설정입니다. NHN Cloud 콘솔의 카카오톡 채널 등록에서 senderKey를 확인하세요.
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Label className="text-sm font-medium text-gray-700">발신 프로필 키</Label>
                                            <Badge className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5">필수</Badge>
                                        </div>
                                        <Input
                                            value={settings.notification.nhnAlimTalk?.senderKey || ''}
                                            onChange={(e) => setSettings(prev => ({
                                                ...prev,
                                                notification: {
                                                    ...prev.notification,
                                                    nhnAlimTalk: {
                                                        ...prev.notification.nhnAlimTalk!,
                                                        senderKey: e.target.value
                                                    }
                                                }
                                            }))}
                                            placeholder="e.g., 514116f024d8e322cc2a82a3503bb2eb178370f3"
                                            className="h-11 font-mono text-sm bg-amber-50 border-amber-200 focus:ring-amber-500/20 rounded-xl"
                                        />
                                        <p className="text-[11px] text-slate-400 pl-1"><span className="font-bold text-amber-600">Society-specific:</span> 40-character hexadecimal string from NHN Cloud console</p>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Label className="text-sm font-medium text-gray-700">대체 발신번호 (SMS)</Label>
                                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5">선택</Badge>
                                        </div>
                                        <Input
                                            value={settings.notification.nhnAlimTalk?.resendSendNo || ''}
                                            onChange={(e) => setSettings(prev => ({
                                                ...prev,
                                                notification: {
                                                    ...prev.notification,
                                                    nhnAlimTalk: {
                                                        ...prev.notification.nhnAlimTalk!,
                                                        resendSendNo: e.target.value
                                                    }
                                                }
                                            }))}
                                            placeholder="01012345678"
                                            className="h-11 font-mono text-sm bg-slate-50 border-slate-200 rounded-xl"
                                        />
                                        <p className="text-[11px] text-slate-400 pl-1">For SMS fallback when AlimTalk fails (no hyphens)</p>
                                    </div>

                                    <div className="mt-2 bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold text-emerald-800 uppercase">NHN Cloud Status</span>
                                            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none py-0.5 h-5 text-[10px]">CONFIGURED</Badge>
                                        </div>
                                        <div className="w-full bg-emerald-200/30 rounded-full h-1.5 overflow-hidden">
                                            <div className="bg-emerald-500 h-full rounded-full w-full animate-pulse"></div>
                                        </div>
                                        <p className="text-[10px] text-emerald-600/70 mt-2 font-medium text-right">Ready to send notifications.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* 4. Email Service */}
                <Card className="rounded-2xl border border-[#c3daee] shadow-sm overflow-hidden bg-white h-fit">
                    <CardHeader className="bg-[#f0f5fa] border-b border-[#c3daee] px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-[#f0f5fa] rounded-xl text-[#003366]">
                                <Mail className="w-4 h-4 text-[#003366]" />
                            </div>
                            <div>
                                <CardTitle className="text-base font-semibold text-gray-800">이메일 서비스 (SMTP)</CardTitle>
                                <CardDescription className="text-sm text-gray-500 mt-0.5">영수증 및 시스템 이메일</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-gray-700">SMTP 호스트</Label>
                                <Input
                                    value={settings.email.host}
                                    onChange={(e) => setSettings(prev => ({ ...prev, email: { ...prev.email, host: e.target.value } }))}
                                    placeholder="smtp.gmail.com"
                                    className="h-11 text-sm border-[#c3daee] rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-gray-700">포트</Label>
                                <Input
                                    value={settings.email.port}
                                    onChange={(e) => setSettings(prev => ({ ...prev, email: { ...prev.email, port: e.target.value } }))}
                                    placeholder="587"
                                    className="h-11 text-sm border-[#c3daee] rounded-xl"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">계정 / 이메일</Label>
                            <Input
                                value={settings.email.user}
                                onChange={(e) => setSettings(prev => ({ ...prev, email: { ...prev.email, user: e.target.value } }))}
                                placeholder="notifications@eregi.co.kr"
                                className="h-11 text-sm border-[#c3daee] rounded-xl"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">SMTP 비밀번호</Label>
                            <Input
                                value={settings.email.pass}
                                onChange={(e) => setSettings(prev => ({ ...prev, email: { ...prev.email, pass: e.target.value } }))}
                                type="password"
                                placeholder="••••••••••••"
                                className="h-11 text-sm border-[#c3daee] rounded-xl tracking-widest"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#c3daee]">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-gray-700">발신 이메일</Label>
                                <Input
                                    value={settings.email.fromEmail}
                                    onChange={(e) => setSettings(prev => ({ ...prev, email: { ...prev.email, fromEmail: e.target.value } }))}
                                    placeholder="noreply@..."
                                    className="h-11 text-sm border-[#c3daee] rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-gray-700">발신자 이름</Label>
                                <Input
                                    value={settings.email.fromName}
                                    onChange={(e) => setSettings(prev => ({ ...prev, email: { ...prev.email, fromName: e.target.value } }))}
                                    placeholder="eRegi System"
                                    className="h-11 text-sm border-[#c3daee] rounded-xl"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
