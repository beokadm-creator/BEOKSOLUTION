import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Settings, ShieldCheck, Key, Save } from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useSuperAdminSettings } from '../hooks/useSuperAdminSettings';

export const SettingsTab: React.FC = () => {
    const {
        settingsLang,
        setSettingsLang,
        termsService,
        setTermsService,
        termsServiceEn,
        setTermsServiceEn,
        privacy,
        setPrivacy,
        privacyEn,
        setPrivacyEn,
        thirdParty,
        setThirdParty,
        thirdPartyEn,
        setThirdPartyEn,
        termsMarketing,
        setTermsMarketing,
        termsMarketingEn,
        setTermsMarketingEn,
        termsAdInfo,
        setTermsAdInfo,
        termsAdInfoEn,
        setTermsAdInfoEn,
        loadingSettings,
        handleSaveSettings
    } = useSuperAdminSettings();

    return (
        <div className="max-w-4xl mx-auto">
            <Card className="shadow-lg border-t-4 border-t-slate-800">
                <CardHeader className="pb-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-2xl font-bold flex items-center gap-2">
                                <Settings className="w-6 h-6 text-slate-800" /> Platform Legal Documents
                            </CardTitle>
                            <CardDescription>
                                Manage global Terms of Service, Privacy Policy, and Consent forms.<br />
                                These texts apply to <span className="font-semibold text-slate-700">ALL societies and conferences</span> unless overridden.
                            </CardDescription>
                        </div>

                        <div className="bg-slate-100 p-1.5 rounded-xl flex gap-1">
                            <button
                                onClick={() => setSettingsLang('KO')}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all
                                    ${settingsLang === 'KO' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}
                                `}
                            >
                                <span className="text-lg">🇰🇷</span> KOREAN
                            </button>
                            <button
                                onClick={() => setSettingsLang('EN')}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all
                                    ${settingsLang === 'EN' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}
                                `}
                            >
                                <span className="text-lg">🇺🇸</span> ENGLISH
                            </button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-8">
                    {loadingSettings ? (
                        <div className="py-20 flex justify-center"><LoadingSpinner /></div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <Label className="flex items-center gap-2 text-base">
                                        <ShieldCheck className="w-4 h-4 text-blue-600" /> Terms of Service
                                    </Label>
                                    <div className="relative">
                                        <div className="absolute top-3 right-3 text-xs font-bold text-slate-300">{settingsLang}</div>
                                        <Textarea
                                            value={settingsLang === 'KO' ? termsService : termsServiceEn}
                                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => settingsLang === 'KO' ? setTermsService(e.target.value) : setTermsServiceEn(e.target.value)}
                                            className="min-h-[250px] font-mono text-sm leading-relaxed resize-none focus:ring-2 focus:ring-blue-500"
                                            placeholder={settingsLang === 'KO' ? "서비스 이용약관 내용을 입력하세요..." : "Enter Terms of Service content..."}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <Label className="flex items-center gap-2 text-base">
                                        <Key className="w-4 h-4 text-green-600" /> Privacy Policy
                                    </Label>
                                    <div className="relative">
                                        <div className="absolute top-3 right-3 text-xs font-bold text-slate-300">{settingsLang}</div>
                                        <Textarea
                                            value={settingsLang === 'KO' ? privacy : privacyEn}
                                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => settingsLang === 'KO' ? setPrivacy(e.target.value) : setPrivacyEn(e.target.value)}
                                            className="min-h-[250px] font-mono text-sm leading-relaxed resize-none focus:ring-2 focus:ring-green-500"
                                            placeholder={settingsLang === 'KO' ? "개인정보 처리방침 내용을 입력하세요..." : "Enter Privacy Policy content..."}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="h-px bg-slate-100" />

                            <div className="space-y-6">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">User Consent Forms</h3>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-slate-600">Third Party Provision</Label>
                                        <Textarea
                                            value={settingsLang === 'KO' ? thirdParty : thirdPartyEn}
                                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => settingsLang === 'KO' ? setThirdParty(e.target.value) : setThirdPartyEn(e.target.value)}
                                            className="min-h-[120px] text-xs font-mono"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-blue-600">Marketing Consent (Opt)</Label>
                                        <Textarea
                                            value={settingsLang === 'KO' ? termsMarketing : termsMarketingEn}
                                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => settingsLang === 'KO' ? setTermsMarketing(e.target.value) : setTermsMarketingEn(e.target.value)}
                                            className="min-h-[120px] text-xs font-mono bg-blue-50/30 border-blue-100 focus:border-blue-300"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-blue-600">Ad Info Transmission (Opt)</Label>
                                        <Textarea
                                            value={settingsLang === 'KO' ? termsAdInfo : termsAdInfoEn}
                                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => settingsLang === 'KO' ? setTermsAdInfo(e.target.value) : setTermsAdInfoEn(e.target.value)}
                                            className="min-h-[120px] text-xs font-mono bg-blue-50/30 border-blue-100 focus:border-blue-300"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4">
                                <Button onClick={handleSaveSettings} className="w-full h-12 text-lg font-bold bg-slate-900 hover:bg-slate-800">
                                    <Save className="w-5 h-5 mr-2" /> Save All Settings
                                </Button>
                                <p className="text-center text-xs text-slate-400 mt-3">
                                    Last Updated: {new Date().toLocaleDateString()} • Updates apply immediately to all registration forms.
                                </p>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
