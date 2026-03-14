import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Bell, Save, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge } from '../../components/ui/badge';

interface InfraSettings {
    notification: {
        nhnAlimTalk?: {
            enabled: boolean;
            senderKey: string;
            resendSendNo?: string;
        };
    };
}

const defaultSettings: InfraSettings = {
    notification: {
        nhnAlimTalk: {
            enabled: false,
            senderKey: '',
            resendSendNo: '',
        },
    },
};

interface PartnerInfraSettingsProps {
    vendorId: string;
}

export default function PartnerInfraSettings({ vendorId }: PartnerInfraSettingsProps) {
    const [settings, setSettings] = useState<InfraSettings>(defaultSettings);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            if (!vendorId) {
                setLoading(false);
                return;
            }

            try {
                const docRef = doc(db, 'vendors', vendorId, 'settings', 'infrastructure');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data() as Partial<InfraSettings>;
                    setSettings({
                        notification: {
                            nhnAlimTalk: {
                                ...defaultSettings.notification.nhnAlimTalk,
                                ...(data.notification?.nhnAlimTalk || {}),
                            },
                        },
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
    }, [vendorId]);

    const handleSave = async () => {
        if (!vendorId) {
            toast.error("파트너 정보가 없습니다.");
            return;
        }

        setSaving(true);
        try {
            const docRef = doc(db, 'vendors', vendorId, 'settings', 'infrastructure');
            await setDoc(docRef, settings, { merge: true });
            toast.success("설정이 저장되었습니다.");
        } catch (error) {
            console.error("Failed to save infra settings:", error);
            toast.error("설정 저장에 실패했습니다.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
                <p className="text-slate-500 font-medium">Loading notification settings...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Infrastructure Settings</h2>
                    <p className="text-slate-500 mt-1">Configure your notification service settings</p>
                </div>
                <Button onClick={handleSave} disabled={saving} size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg">
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Saving Changes...' : 'Save Configuration'}
                </Button>
            </div>

            <Card className="border-none shadow-lg shadow-slate-200/50 overflow-hidden bg-white rounded-2xl">
                <CardHeader className="bg-amber-50/50 border-b border-amber-100 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-100 rounded-xl text-amber-600">
                            <Bell className="w-5 h-5" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-bold text-slate-800">Notification Service</CardTitle>
                            <CardDescription className="text-amber-600/80 font-medium mt-0.5">KakaoTalk AlimTalk Integration</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    {/* NHN AlimTalk Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-slate-700">NHN Cloud AlimTalk</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Partner-specific sender profile</p>
                            </div>
                            <Badge variant={settings.notification.nhnAlimTalk?.enabled ? 'default' : 'secondary'}
                                className={settings.notification.nhnAlimTalk?.enabled ? "bg-emerald-600 hover:bg-emerald-700 h-7" : "bg-slate-200 text-slate-500 h-7"}>
                                {settings.notification.nhnAlimTalk?.enabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between group hover:border-emerald-200 transition-colors">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-bold text-slate-700">Enable NHN AlimTalk</Label>
                                <p className="text-xs text-slate-500">Use NHN Cloud for booth visit notifications</p>
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
                                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3">
                                    <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                    <div className="text-xs text-blue-900 leading-relaxed">
                                        <p className="font-bold mb-1">Partner-Specific Configuration</p>
                                        Only <span className="font-bold">senderKey</span> is partner-specific. The appKey and secretKey are system-wide common settings managed by the administrator. Obtain senderKey from your KakaoTalk channel registration in NHN Cloud Console.
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Label className="text-xs font-bold text-slate-500 uppercase">Sender Profile Key</Label>
                                        <Badge className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5">Required</Badge>
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
                                    <p className="text-[11px] text-slate-400 pl-1"><span className="font-bold text-amber-600">Partner-specific:</span> 40-character hexadecimal string from NHN Cloud console</p>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Label className="text-xs font-bold text-slate-500 uppercase">Resend Phone Number</Label>
                                        <Badge variant="secondary" className="text-[10px] px-2 py-0.5">Optional</Badge>
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
        </div>
    );
}
