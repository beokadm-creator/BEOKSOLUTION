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
import { CreditCard, Bell, Mail, Save } from 'lucide-react';
import toast from 'react-hot-toast';

interface InfraSettings {
    payment: {
        domestic: {
            provider: 'TOSS' | 'NICE' | 'KCP' | 'KICC' | '';
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
        channelId: string; // Only Kakao Channel ID needed
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
        channelId: '',
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
                            channelId: data.notification?.channelId || defaultSettings.notification.channelId
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

    if (loading) return <div className="p-10 flex justify-center">인프라 설정 로딩 중...</div>;

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">인프라 설정</h1>
                    <p className="text-gray-500 mt-2">결제 게이트웨이, 알림, 이메일 서비스를 관리하세요.</p>
                </div>
                <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
                    <Save className="w-4 h-4" />
                    {saving ? '저장 중...' : '변경사항 저장'}
                </Button>
            </div>

            {/* Payment Gateway Section - Domestic */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-bold text-sm">🅰️</span>
                        </div>
                        <div>
                            <CardTitle>국내 결제 PG (Domestic Cards)</CardTitle>
                            <CardDescription>한국 발급 카드 전용 결제 처리 (KRW)</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Provider</Label>
                            <Select 
                                value={settings.payment.domestic.provider} 
                                onValueChange={(val) => setSettings(prev => ({ 
                                    ...prev, 
                                    payment: { 
                                        ...prev.payment, 
                                        domestic: { ...prev.payment.domestic, provider: val as any } 
                                    } 
                                }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Provider" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TOSS">Toss Payments</SelectItem>
                                    <SelectItem value="NICE">NicePay (나이스페이)</SelectItem>
                                    <SelectItem value="KCP">NHN KCP</SelectItem>
                                    <SelectItem value="KICC">EasyPay (KICC)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <Label className="text-base">Test Mode</Label>
                                <p className="text-sm text-gray-500">테스트 환경 사용</p>
                            </div>
                            <Switch 
                                checked={settings.payment.domestic.isTestMode}
                                onChange={(e) => setSettings(prev => ({ 
                                    ...prev, 
                                    payment: { 
                                        ...prev.payment, 
                                        domestic: { ...prev.payment.domestic, isTestMode: e.target.checked } 
                                    } 
                                }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Merchant ID (MID)</Label>
                            <Input 
                                value={settings.payment.domestic.merchantId}
                                onChange={(e) => setSettings(prev => ({ 
                                    ...prev, 
                                    payment: { 
                                        ...prev.payment, 
                                        domestic: { ...prev.payment.domestic, merchantId: e.target.value } 
                                    } 
                                }))}
                                placeholder="e.g., toss_12345"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>API Key (Client Key)</Label>
                            <Input 
                                value={settings.payment.domestic.apiKey}
                                onChange={(e) => setSettings(prev => ({ 
                                    ...prev, 
                                    payment: { 
                                        ...prev.payment, 
                                        domestic: { ...prev.payment.domestic, apiKey: e.target.value } 
                                    } 
                                }))}
                                type="password"
                                placeholder="Public API Key"
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>Secret Key</Label>
                            <Input 
                                value={settings.payment.domestic.secretKey}
                                onChange={(e) => setSettings(prev => ({ 
                                    ...prev, 
                                    payment: { 
                                        ...prev.payment, 
                                        domestic: { ...prev.payment.domestic, secretKey: e.target.value } 
                                    } 
                                }))}
                                type="password"
                                placeholder="Private Secret Key"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Payment Gateway Section - Global */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-green-600 font-bold text-sm">🅱️</span>
                        </div>
                        <div>
                            <CardTitle>해외 결제 PG (Foreign Cards - KRW)</CardTitle>
                            <CardDescription>외국 발급 카드 전용 결제 처리 (KRW로 고정)</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                        <div className="flex items-start gap-2">
                            <div className="text-amber-600 mt-0.5">ℹ️</div>
                            <div className="text-sm text-amber-800">
                                <p className="font-medium mb-1">KRW Settlement Only</p>
                                <p>All payments will be processed in KRW currency. Ensure your PG contract supports KRW settlement for international card transactions (Visa, Mastercard, JCB, etc.).</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex items-center justify-between rounded-lg border p-4 md:col-span-2">
                            <div className="space-y-0.5">
                                <Label className="text-base">Enable Global PG</Label>
                                <p className="text-sm text-gray-500">Allow foreign card payments</p>
                            </div>
                            <Switch 
                                checked={settings.payment.global.enabled}
                                onChange={(e) => setSettings(prev => ({ 
                                    ...prev, 
                                    payment: { 
                                        ...prev.payment, 
                                        global: { ...prev.payment.global, enabled: e.target.checked } 
                                    } 
                                }))}
                            />
                        </div>
                        
                        {settings.payment.global.enabled && (
                            <>
                                <div className="space-y-2">
                                    <Label>Global Provider</Label>
                                    <Select 
                                        value={settings.payment.global.provider} 
                                        onValueChange={(val) => setSettings(prev => ({ 
                                            ...prev, 
                                            payment: { 
                                                ...prev.payment, 
                                                global: { ...prev.payment.global, provider: val as any } 
                                            } 
                                        }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Provider" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="EXIMBAY">Eximbay (Recommended)</SelectItem>
                                            <SelectItem value="PAYPAL">PayPal (Optional)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Merchant ID (MID)</Label>
                                    <Input 
                                        value={settings.payment.global.merchantId}
                                        onChange={(e) => setSettings(prev => ({ 
                                            ...prev, 
                                            payment: { 
                                                ...prev.payment, 
                                                global: { ...prev.payment.global, merchantId: e.target.value } 
                                            } 
                                        }))}
                                        placeholder="e.g., eximbay_merchant"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Secret Key</Label>
                                    <Input 
                                        value={settings.payment.global.secretKey}
                                        onChange={(e) => setSettings(prev => ({ 
                                            ...prev, 
                                            payment: { 
                                                ...prev.payment, 
                                                global: { ...prev.payment.global, secretKey: e.target.value } 
                                            } 
                                        }))}
                                        type="password"
                                        placeholder="Global PG Secret Key"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label>Settlement Currency (Fixed)</Label>
                                    <Input 
                                        value={settings.payment.global.currency}
                                        disabled
                                        className="bg-gray-100 text-gray-700"
                                        placeholder="KRW"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Currency is fixed to KRW for all transactions</p>
                                </div>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

{/* Notification Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-amber-600" />
                        <CardTitle>알림톡 설정 (Aligo)</CardTitle>
                    </div>
                    <CardDescription>플랫폼 기본 Aligo 연동. 카카오 채널 ID만 입력하세요.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                        <div className="flex items-start gap-2">
                            <div className="text-blue-600 mt-0.5">ℹ️</div>
                            <div className="text-sm text-blue-800">
                                <p className="font-medium mb-1">플랫폼 기본 제공</p>
                                <p>이제 API 키 설정은 백엔드에서 관리됩니다. 카카오 채널 검색 ID(@포함)만 입력하면 됩니다.</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>카카오 채널 ID</Label>
                        <Input 
                            value={settings.notification.channelId}
                            onChange={(e) => setSettings(prev => ({ ...prev, notification: { channelId: e.target.value } }))}
                            placeholder="@your_society_id"
                        />
                        <p className="text-xs text-gray-500 mt-1">카카오 채널 검색용 ID입니다. @를 포함하여 입력하세요.</p>
                    </div>

                    <div className="mt-4 bg-amber-50 border border-amber-200 p-4 rounded-lg">
                         <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-amber-800">플랫폼 상태</span>
                              <span className="text-sm font-bold text-amber-900">연동됨</span>
                         </div>
                         <div className="w-full bg-amber-200 rounded-full h-2.5 mt-2">
                              <div className="bg-green-500 h-2.5 rounded-full" style={{ width: '100%' }}></div>
                         </div>
                         <p className="text-xs text-amber-600 mt-2">Aligo 연동으로 알림톡 전송이 활성화되어 있습니다.</p>
                    </div>
                </CardContent>
            </Card>

            {/* Email Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Mail className="w-5 h-5 text-purple-600" />
                        <CardTitle>Email (SMTP)</CardTitle>
                    </div>
                    <CardDescription>영수증 및 확인 이메일 발송 설정을 구성하세요.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>SMTP Host</Label>
                            <Input 
                                value={settings.email.host}
                                onChange={(e) => setSettings(prev => ({ ...prev, email: { ...prev.email, host: e.target.value } }))}
                                placeholder="smtp.gmail.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Port</Label>
                            <Input 
                                value={settings.email.port}
                                onChange={(e) => setSettings(prev => ({ ...prev, email: { ...prev.email, port: e.target.value } }))}
                                placeholder="587"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>User / Email</Label>
                            <Input 
                                value={settings.email.user}
                                onChange={(e) => setSettings(prev => ({ ...prev, email: { ...prev.email, user: e.target.value } }))}
                                placeholder="user@domain.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Password</Label>
                            <Input 
                                value={settings.email.pass}
                                onChange={(e) => setSettings(prev => ({ ...prev, email: { ...prev.email, pass: e.target.value } }))}
                                type="password"
                                placeholder="SMTP Password"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>From Email</Label>
                            <Input 
                                value={settings.email.fromEmail}
                                onChange={(e) => setSettings(prev => ({ ...prev, email: { ...prev.email, fromEmail: e.target.value } }))}
                                placeholder="noreply@eregi.co.kr"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>From Name</Label>
                            <Input 
                                value={settings.email.fromName}
                                onChange={(e) => setSettings(prev => ({ ...prev, email: { ...prev.email, fromName: e.target.value } }))}
                                placeholder="eRegi Admin"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
