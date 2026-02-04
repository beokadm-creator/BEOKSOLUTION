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
import { Bell, Mail, Save, CreditCard, Globe, Info, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge } from '../../components/ui/badge';

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

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
            <p className="text-slate-500 font-medium">Loading infrastructure settings...</p>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Infrastructure Settings</h1>
                    <p className="text-slate-500 mt-2 font-medium">Manage payment gateways, notification channels, and email services.</p>
                </div>
                <Button onClick={handleSave} disabled={saving} size="lg" className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 px-8 rounded-xl font-bold transition-all active:scale-95">
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Saving Changes...' : 'Save Configuration'}
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 1. Domestic Payment Gateway */}
                <Card className="border-none shadow-lg shadow-slate-200/50 overflow-hidden bg-white rounded-2xl">
                    <CardHeader className="bg-blue-50/50 border-b border-blue-100 pb-4">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-100 rounded-xl text-blue-600">
                                    <CreditCard className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-bold text-slate-800">Domestic Payment (PG)</CardTitle>
                                    <CardDescription className="text-blue-600/80 font-medium mt-0.5">Korean Issued Cards (KRW)</CardDescription>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-blue-100 shadow-sm">
                                <span className={`w-2 h-2 rounded-full ${settings.payment.domestic.isTestMode ? 'bg-amber-400' : 'bg-green-500 animate-pulse'}`} />
                                <span className="text-xs font-bold text-slate-600 uppercase">
                                    {settings.payment.domestic.isTestMode ? 'Test Mode' : 'Live Mode'}
                                </span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 gap-5">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase">PG Provider</Label>
                                <Select
                                    value={settings.payment.domestic.provider}
                                    onValueChange={(val) => setSettings(prev => ({
                                        ...prev,
                                        payment: {
                                            ...prev.payment,
                                            domestic: { ...prev.payment.domestic, provider: val as 'TOSS' | 'NICE' | 'KCP' | 'KICC' }
                                        }
                                    }))}
                                >
                                    <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200 focus:ring-blue-500/20 font-medium">
                                        <SelectValue placeholder="Select a Provider" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="TOSS">Toss Payments (Recommended)</SelectItem>
                                        <SelectItem value="NICE">NicePay</SelectItem>
                                        <SelectItem value="KCP">NHN KCP</SelectItem>
                                        <SelectItem value="KICC">EasyPay (KICC)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between group hover:border-blue-200 transition-colors">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-bold text-slate-700">Sandbox Environment</Label>
                                    <p className="text-xs text-slate-500">Enable for testing transactions without real charges.</p>
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
                                    <Label className="text-xs font-bold text-slate-500 uppercase">Merchant ID (MID)</Label>
                                    <Input
                                        value={settings.payment.domestic.merchantId}
                                        onChange={(e) => setSettings(prev => ({ ...prev, payment: { ...prev.payment, domestic: { ...prev.payment.domestic, merchantId: e.target.value } } }))}
                                        className="h-11 font-mono text-sm bg-slate-50 border-slate-200 focus:bg-white transition-colors rounded-xl"
                                        placeholder="e.g. tosspayments"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">Client API Key</Label>
                                    <Input
                                        value={settings.payment.domestic.apiKey}
                                        onChange={(e) => setSettings(prev => ({ ...prev, payment: { ...prev.payment, domestic: { ...prev.payment.domestic, apiKey: e.target.value } } }))}
                                        type="password"
                                        className="h-11 font-mono text-sm bg-slate-50 border-slate-200 focus:bg-white transition-colors rounded-xl tracking-widest"
                                        placeholder="Starting with test_ck_..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">Secret Key</Label>
                                    <Input
                                        value={settings.payment.domestic.secretKey}
                                        onChange={(e) => setSettings(prev => ({ ...prev, payment: { ...prev.payment, domestic: { ...prev.payment.domestic, secretKey: e.target.value } } }))}
                                        type="password"
                                        className="h-11 font-mono text-sm bg-slate-50 border-slate-200 focus:bg-white transition-colors rounded-xl tracking-widest"
                                        placeholder="Starting with test_sk_..."
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Global Payment Gateway */}
                <Card className="border-none shadow-lg shadow-slate-200/50 overflow-hidden bg-white rounded-2xl h-fit">
                    <CardHeader className="bg-indigo-50/50 border-b border-indigo-100 pb-4">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-100 rounded-xl text-indigo-600">
                                    <Globe className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-bold text-slate-800">Global Payment (PG)</CardTitle>
                                    <CardDescription className="text-indigo-600/80 font-medium mt-0.5">International Cards (KRW Settlement)</CardDescription>
                                </div>
                            </div>
                            <Badge variant={settings.payment.global.enabled ? 'default' : 'secondary'} className={settings.payment.global.enabled ? "bg-indigo-600 hover:bg-indigo-700 h-7" : "bg-slate-200 text-slate-500 h-7"}>
                                {settings.payment.global.enabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="bg-amber-50 border border-amber-200/60 p-4 rounded-xl flex gap-3">
                            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="text-xs text-amber-900 leading-relaxed">
                                <p className="font-bold mb-1">KRW Settlement Requirement</p>
                                All international transactions will be processed and settled in <span className="font-bold underline">KRW</span>. Ensure your global PG contract supports this to avoid settlement failures.
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-colors">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-bold text-slate-700">Accept Global Payments</Label>
                                <p className="text-xs text-slate-500">Allow payments via Visa, Mastercard, JCB from overseas.</p>
                            </div>
                            <Switch
                                checked={settings.payment.global.enabled}
                                onChange={(e) => setSettings(prev => ({
                                    ...prev,
                                    payment: { ...prev.payment, global: { ...prev.payment.global, enabled: e.target.checked } }
                                }))}
                                className="data-[state=checked]:bg-indigo-600"
                            />
                        </div>

                        {settings.payment.global.enabled && (
                            <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">Provider</Label>
                                    <Select
                                        value={settings.payment.global.provider}
                                        onValueChange={(val) => setSettings(prev => ({
                                            ...prev,
                                            payment: { ...prev.payment, global: { ...prev.payment.global, provider: val as 'EXIMBAY' | 'STRIPE' | 'PAYPAL' } }
                                        }))}
                                    >
                                        <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200 font-medium">
                                            <SelectValue placeholder="Select Global Provider" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="EXIMBAY">Eximbay (Recommended)</SelectItem>
                                            <SelectItem value="PAYPAL">PayPal</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">Merchant ID (MID)</Label>
                                    <Input
                                        value={settings.payment.global.merchantId}
                                        onChange={(e) => setSettings(prev => ({ ...prev, payment: { ...prev.payment, global: { ...prev.payment.global, merchantId: e.target.value } } }))}
                                        className="h-11 font-mono text-sm bg-slate-50 border-slate-200 rounded-xl"
                                        placeholder="e.g., eximbay_mid"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">Secret Key</Label>
                                    <Input
                                        value={settings.payment.global.secretKey}
                                        onChange={(e) => setSettings(prev => ({ ...prev, payment: { ...prev.payment, global: { ...prev.payment.global, secretKey: e.target.value } } }))}
                                        type="password"
                                        className="h-11 font-mono text-sm bg-slate-50 border-slate-200 rounded-xl tracking-widest"
                                        placeholder="Global secret key..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">Settlement Currency</Label>
                                    <div className="flex items-center bg-gray-100 rounded-xl h-11 px-4 border border-gray-200 text-gray-500 font-bold text-sm">
                                        KRW (Fixed)
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 3. Notification Service */}
                <Card className="border-none shadow-lg shadow-slate-200/50 overflow-hidden bg-white rounded-2xl h-fit">
                    <CardHeader className="bg-amber-50/50 border-b border-amber-100 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-amber-100 rounded-xl text-amber-600">
                                <Bell className="w-5 h-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-bold text-slate-800">Notification Service</CardTitle>
                                <CardDescription className="text-amber-600/80 font-medium mt-0.5">Aligo KakaoTalk Integration</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3">
                            <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                            <div className="text-xs text-blue-900 leading-relaxed">
                                <p className="font-bold mb-1">Platform Managed Service</p>
                                API keys are now managed securely by the backend platform. You only need to provide your Kakao Channel ID.
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase">Kakao Channel ID</Label>
                            <Input
                                value={settings.notification.channelId}
                                onChange={(e) => setSettings(prev => ({ ...prev, notification: { channelId: e.target.value } }))}
                                placeholder="@your_channel_id"
                                className="h-11 font-medium text-sm bg-slate-50 border-slate-200 rounded-xl"
                            />
                            <p className="text-[11px] text-slate-400 pl-1">Must include the '@' symbol (e.g., @mysociety).</p>
                        </div>

                        <div className="mt-2 bg-amber-50/50 border border-amber-100 p-4 rounded-xl">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-amber-800 uppercase">Integration Status</span>
                                <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none py-0.5 h-5 text-[10px]">ACTIVE</Badge>
                            </div>
                            <div className="w-full bg-amber-200/30 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full w-full animate-pulse"></div>
                            </div>
                            <p className="text-[10px] text-amber-600/70 mt-2 font-medium text-right">Service operational and ready.</p>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. Email Service */}
                <Card className="border-none shadow-lg shadow-slate-200/50 overflow-hidden bg-white rounded-2xl h-fit">
                    <CardHeader className="bg-purple-50/50 border-b border-purple-100 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-purple-100 rounded-xl text-purple-600">
                                <Mail className="w-5 h-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-bold text-slate-800">Email Service (SMTP)</CardTitle>
                                <CardDescription className="text-purple-600/80 font-medium mt-0.5">Receipts & System Emails</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase">SMTP Host</Label>
                                <Input
                                    value={settings.email.host}
                                    onChange={(e) => setSettings(prev => ({ ...prev, email: { ...prev.email, host: e.target.value } }))}
                                    placeholder="smtp.gmail.com"
                                    className="h-11 text-sm bg-slate-50 border-slate-200 rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase">Port</Label>
                                <Input
                                    value={settings.email.port}
                                    onChange={(e) => setSettings(prev => ({ ...prev, email: { ...prev.email, port: e.target.value } }))}
                                    placeholder="587"
                                    className="h-11 text-sm bg-slate-50 border-slate-200 rounded-xl"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase">Username / Email</Label>
                            <Input
                                value={settings.email.user}
                                onChange={(e) => setSettings(prev => ({ ...prev, email: { ...prev.email, user: e.target.value } }))}
                                placeholder="notifications@eregi.co.kr"
                                className="h-11 text-sm bg-slate-50 border-slate-200 rounded-xl"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase">SMTP Password</Label>
                            <Input
                                value={settings.email.pass}
                                onChange={(e) => setSettings(prev => ({ ...prev, email: { ...prev.email, pass: e.target.value } }))}
                                type="password"
                                placeholder="••••••••••••"
                                className="h-11 text-sm bg-slate-50 border-slate-200 rounded-xl tracking-widest"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase">Sender Email</Label>
                                <Input
                                    value={settings.email.fromEmail}
                                    onChange={(e) => setSettings(prev => ({ ...prev, email: { ...prev.email, fromEmail: e.target.value } }))}
                                    placeholder="noreply@..."
                                    className="h-11 text-sm bg-slate-50 border-slate-200 rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase">Sender Name</Label>
                                <Input
                                    value={settings.email.fromName}
                                    onChange={(e) => setSettings(prev => ({ ...prev, email: { ...prev.email, fromName: e.target.value } }))}
                                    placeholder="eRegi System"
                                    className="h-11 text-sm bg-slate-50 border-slate-200 rounded-xl"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
