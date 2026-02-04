import React, { useState, useEffect } from 'react';
import { useSociety } from '../../hooks/useSociety';
import { doc, updateDoc, Timestamp, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import ImageUpload from '../../components/ui/ImageUpload';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import toast from 'react-hot-toast';
import { Building2, Save, BadgeCheck, Scale, LayoutTemplate, FileText } from 'lucide-react';
import { Badge } from '../../components/ui/badge';

const IdentityPage: React.FC = () => {
    // Context
    const { society } = useSociety();

    // Society State
    const [socNameKo, setSocNameKo] = useState('');
    const [socNameEn, setSocNameEn] = useState('');
    const [socDesc, setSocDesc] = useState('');
    const [socLogo, setSocLogo] = useState('');

    // Footer Info
    const [bizReg, setBizReg] = useState('');
    const [repName, setRepName] = useState('');
    const [address, setAddress] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactPhone, setContactPhone] = useState('');

    // Loading State
    const [loading, setLoading] = useState(false);

    // Terms State
    const [terms, setTerms] = useState('');
    const [termsEn, setTermsEn] = useState('');
    const [privacy, setPrivacy] = useState('');
    const [privacyEn, setPrivacyEn] = useState('');
    const [refund, setRefund] = useState(''); // Added Refund
    const [refundEn, setRefundEn] = useState(''); // Added Refund
    const [thirdParty, setThirdParty] = useState('');
    const [thirdPartyEn, setThirdPartyEn] = useState('');
    const [marketingText, setMarketingText] = useState('');
    const [marketingTextEn, setMarketingTextEn] = useState('');
    const [infoText, setInfoText] = useState('');
    const [infoTextEn, setInfoTextEn] = useState('');

    // Initialize Data
    useEffect(() => {
        if (society) {
            setSocNameKo(society.name.ko || '');
            setSocNameEn(society.name.en || '');
            setSocDesc(society.description?.ko || '');
            setSocLogo(society.logoUrl || '');

            const footer = society.footerInfo || {};
            setBizReg(footer.bizRegNumber || '');
            setRepName(footer.representativeName || '');
            setAddress(footer.address || '');
            setContactEmail(footer.contactEmail || '');
            setContactPhone(footer.contactPhone || '');

            // Fetch Terms (Config)
            const fetchTerms = async () => {
                try {
                    // Try to fetch from 'identity' doc first (new standard)
                    const identityRef = doc(db, 'societies', society.id, 'settings', 'identity');
                    const identitySnap = await getDoc(identityRef);

                    if (identitySnap.exists()) {
                        const data = identitySnap.data();
                        setTerms(data.termsOfService || '');
                        setTermsEn(data.termsOfService_en || '');
                        setPrivacy(data.privacyPolicy || '');
                        setPrivacyEn(data.privacyPolicy_en || '');
                        setRefund(data.refundPolicy || ''); // Load Refund
                        setRefundEn(data.refundPolicy_en || ''); // Load Refund
                        setThirdParty(data.thirdPartyConsent || '');
                        setThirdPartyEn(data.thirdPartyConsent_en || '');
                        setMarketingText(data.marketingConsentText || '');
                        setMarketingTextEn(data.marketingConsentText_en || '');
                        setInfoText(data.infoConsentText || '');
                        setInfoTextEn(data.infoConsentText_en || '');
                    } else {
                        // Fallback logic for migration
                        const termsRef = doc(db, 'societies', society.id, 'settings', 'terms');
                        const termsSnap = await getDoc(termsRef);
                        if (termsSnap.exists()) {
                            const data = termsSnap.data();
                            setTerms(data.termsOfService || '');
                            setPrivacy(data.privacyPolicy || '');
                            setThirdParty(data.thirdPartyConsent || '');
                        }
                    }
                } catch (e) {
                    console.error("Failed to fetch terms", e);
                }
            };
            fetchTerms();
        }
    }, [society]);

    // Save Handlers
    const handleSaveSociety = async () => {
        if (!society) return;
        setLoading(true);
        try {
            const footerInfo = {
                bizRegNumber: bizReg,
                representativeName: repName,
                address,
                contactEmail,
                contactPhone
            };

            // 1. Save Basic Info
            await updateDoc(doc(db, 'societies', society.id), {
                name: { ko: socNameKo, en: socNameEn },
                description: { ko: socDesc, en: '' },
                logoUrl: socLogo,
                footerInfo,
                updatedAt: Timestamp.now()
            });

            // 2. Save Terms to 'identity' (Consolidated)
            await setDoc(doc(db, 'societies', society.id, 'settings', 'identity'), {
                termsOfService: terms,
                termsOfService_en: termsEn,
                privacyPolicy: privacy,
                privacyPolicy_en: privacyEn,
                refundPolicy: refund,
                refundPolicy_en: refundEn,
                thirdPartyConsent: thirdParty,
                thirdPartyConsent_en: thirdPartyEn,
                marketingConsentText: marketingText,
                marketingConsentText_en: marketingTextEn,
                infoConsentText: infoText,
                infoConsentText_en: infoTextEn,
                updatedAt: Timestamp.now()
            }, { merge: true });

            toast.success('학회 정보가 저장되었습니다.');
        } catch (e) {
            console.error(e);
            toast.error('저장 실패: ' + (e instanceof Error ? e.message : 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    if (!society) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
                <p className="text-slate-500 font-medium">Loading society profile...</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-24 p-6">

            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Admin Console</Badge>
                        <span className="text-slate-300">|</span>
                        <span className="text-sm font-medium text-slate-500 uppercase tracking-wide">{society.id}</span>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Society Identity</h1>
                    <p className="text-slate-500 mt-2 font-medium">Manage branding, footer information, and legal documents.</p>
                </div>
                <div className="hidden md:block">
                    <Button onClick={handleSaveSociety} disabled={loading} size="lg" className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 px-8 rounded-xl font-bold transition-all active:scale-95">
                        <Save className="w-4 h-4 mr-2" />
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* 1. Branding Section */}
                <Card className="border-none shadow-lg shadow-slate-200/50 overflow-hidden bg-white rounded-2xl">
                    <CardHeader className="bg-blue-50/50 border-b border-blue-100 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-100 rounded-xl text-blue-600">
                                <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-bold text-slate-800">Branding & Identity</CardTitle>
                                <CardDescription className="text-blue-600/80 font-medium mt-0.5">Society Logo and Naming</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                            {/* Logo Column */}
                            <div className="lg:col-span-4 space-y-3">
                                <Label className="text-base font-bold text-slate-700 flex justify-between items-center">
                                    Society Logo
                                    <Badge variant="secondary" className="text-[10px] h-5">PNG / SVG</Badge>
                                </Label>
                                <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center justify-center min-h-[240px] hover:border-blue-300 transition-colors group">
                                    <div className="relative w-full flex-1 flex items-center justify-center">
                                        <ImageUpload
                                            path={`societies/${society?.id}/logo`}
                                            onUploadComplete={setSocLogo}
                                            previewUrl={socLogo}
                                            className="mx-auto max-w-[200px] object-contain transition-transform group-hover:scale-105"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 mt-4 text-center font-medium">
                                        Recommended: Transparent PNG<br />Height: 80px+
                                    </p>
                                </div>
                            </div>
                            {/* Inputs Column */}
                            <div className="lg:col-span-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-500 uppercase">Society Name (Korean)</Label>
                                        <Input
                                            value={socNameKo}
                                            onChange={e => setSocNameKo(e.target.value)}
                                            placeholder="대한OO학회"
                                            className="h-11 bg-slate-50/50 border-slate-200 rounded-xl focus:bg-white transition-all text-base"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-500 uppercase">Society Name (English)</Label>
                                        <Input
                                            value={socNameEn}
                                            onChange={e => setSocNameEn(e.target.value)}
                                            placeholder="Korean Society of OO"
                                            className="h-11 bg-slate-50/50 border-slate-200 rounded-xl focus:bg-white transition-all text-base"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">Description</Label>
                                    <Textarea
                                        value={socDesc}
                                        onChange={e => setSocDesc(e.target.value)}
                                        placeholder="Brief introduction of the society..."
                                        rows={4}
                                        className="resize-none bg-slate-50/50 border-slate-200 rounded-xl focus:bg-white transition-all leading-relaxed"
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Footer Info Section */}
                <Card className="border-none shadow-lg shadow-slate-200/50 overflow-hidden bg-white rounded-2xl">
                    <CardHeader className="bg-slate-50/80 border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 shadow-sm">
                                <LayoutTemplate className="w-5 h-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-bold text-slate-800">Footer Information</CardTitle>
                                <CardDescription className="text-slate-500 font-medium mt-0.5">Official Business Information displayed in footer</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase">Business Registration No.</Label>
                                <Input
                                    value={bizReg}
                                    onChange={e => setBizReg(e.target.value)}
                                    placeholder="000-00-00000"
                                    className="h-11 border-slate-200 rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase">Representative Name</Label>
                                <Input
                                    value={repName}
                                    onChange={e => setRepName(e.target.value)}
                                    placeholder="President Name"
                                    className="h-11 border-slate-200 rounded-xl"
                                />
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase">Office Address</Label>
                                <Input
                                    value={address}
                                    onChange={e => setAddress(e.target.value)}
                                    placeholder="Full street address..."
                                    className="h-11 border-slate-200 rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase">Contact Email</Label>
                                <Input
                                    value={contactEmail}
                                    onChange={e => setContactEmail(e.target.value)}
                                    placeholder="office@example.org"
                                    className="h-11 border-slate-200 rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase">Contact Phone</Label>
                                <Input
                                    value={contactPhone}
                                    onChange={e => setContactPhone(e.target.value)}
                                    placeholder="02-0000-0000"
                                    className="h-11 border-slate-200 rounded-xl"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Legal Documents Section */}
                <Card className="border-none shadow-lg shadow-slate-200/50 overflow-hidden bg-white rounded-2xl">
                    <CardHeader className="bg-slate-50/80 border-b border-slate-100 pb-0">
                        <div className="flex items-center justify-between pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 shadow-sm">
                                    <Scale className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-bold text-slate-800">Legal Documents</CardTitle>
                                    <CardDescription className="text-slate-500 font-medium mt-0.5">Terms, Privacy Policy, and Consent Forms</CardDescription>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Tabs defaultValue="ko" className="w-full">
                            <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
                                <TabsList className="grid w-full grid-cols-2 max-w-md h-12 p-1.5 bg-slate-200/50 rounded-xl">
                                    <TabsTrigger value="ko" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">한국어 (Korean)</TabsTrigger>
                                    <TabsTrigger value="en" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">English (Global)</TabsTrigger>
                                </TabsList>
                            </div>

                            {/* Korean Content */}
                            <TabsContent value="ko" className="p-8 space-y-10 mt-0">
                                {/* Core Policies */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <BadgeCheck className="w-5 h-5 text-blue-600" />
                                        <h3 className="text-md font-bold text-slate-800">기본 정책 (Core Policies)</h3>
                                    </div>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div className="space-y-2 lg:col-span-2">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">이용약관 (Terms)</Label>
                                            <Textarea
                                                value={terms}
                                                onChange={e => setTerms(e.target.value)}
                                                placeholder="이용약관 전문..."
                                                className="min-h-[200px] font-mono text-sm bg-slate-50/30 border-slate-200 rounded-xl leading-relaxed focus:bg-white"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">개인정보 처리방침 (Privacy)</Label>
                                            <Textarea
                                                value={privacy}
                                                onChange={e => setPrivacy(e.target.value)}
                                                placeholder="개인정보 처리방침 전문..."
                                                className="min-h-[200px] font-mono text-sm bg-slate-50/30 border-slate-200 rounded-xl leading-relaxed focus:bg-white"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">환불 규정 (Refund)</Label>
                                            <Textarea
                                                value={refund}
                                                onChange={e => setRefund(e.target.value)}
                                                placeholder="환불 규정 및 취소 정책..."
                                                className="min-h-[200px] font-mono text-sm bg-slate-50/30 border-slate-200 rounded-xl leading-relaxed focus:bg-white"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="h-px bg-slate-100 my-2" />

                                {/* Consents */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <FileText className="w-5 h-5 text-emerald-600" />
                                        <h3 className="text-md font-bold text-slate-800">사용자 동의 항목 (User Consents)</h3>
                                    </div>
                                    <div className="grid grid-cols-1 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">제3자 정보 제공 동의</Label>
                                            <Textarea
                                                value={thirdParty}
                                                onChange={e => setThirdParty(e.target.value)}
                                                placeholder="행사 등록 시 노출되는 제3자 정보 제공 동의 문구..."
                                                className="min-h-[150px] font-mono text-sm border-slate-200 rounded-xl focus:bg-white"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold text-slate-500 uppercase">마케팅 정보 수신 동의</Label>
                                                <Textarea
                                                    value={marketingText}
                                                    onChange={e => setMarketingText(e.target.value)}
                                                    placeholder="문구 입력..."
                                                    className="min-h-[150px] font-mono text-sm border-slate-200 rounded-xl focus:bg-white"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold text-slate-500 uppercase">정보성 수신 동의</Label>
                                                <Textarea
                                                    value={infoText}
                                                    onChange={e => setInfoText(e.target.value)}
                                                    placeholder="문구 입력..."
                                                    className="min-h-[150px] font-mono text-sm border-slate-200 rounded-xl focus:bg-white"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* English Content */}
                            <TabsContent value="en" className="p-8 space-y-10 mt-0 bg-slate-50/30">
                                {/* Core Policies */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <BadgeCheck className="w-5 h-5 text-indigo-600" />
                                        <h3 className="text-md font-bold text-slate-800">Core Policies (English)</h3>
                                    </div>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div className="space-y-2 lg:col-span-2">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">Terms of Service</Label>
                                            <Textarea
                                                value={termsEn}
                                                onChange={e => setTermsEn(e.target.value)}
                                                placeholder="Terms of Service..."
                                                className="min-h-[200px] font-mono text-sm bg-white border-slate-200 rounded-xl leading-relaxed"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">Privacy Policy</Label>
                                            <Textarea
                                                value={privacyEn}
                                                onChange={e => setPrivacyEn(e.target.value)}
                                                placeholder="Privacy Policy..."
                                                className="min-h-[200px] font-mono text-sm bg-white border-slate-200 rounded-xl leading-relaxed"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">Refund Policy</Label>
                                            <Textarea
                                                value={refundEn}
                                                onChange={e => setRefundEn(e.target.value)}
                                                placeholder="Refund Policy..."
                                                className="min-h-[200px] font-mono text-sm bg-white border-slate-200 rounded-xl leading-relaxed"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="h-px bg-slate-200 my-2" />

                                {/* Consents */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <FileText className="w-5 h-5 text-purple-600" />
                                        <h3 className="text-md font-bold text-slate-800">User Consents (English)</h3>
                                    </div>
                                    <div className="grid grid-cols-1 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">Third Party Consent</Label>
                                            <Textarea
                                                value={thirdPartyEn}
                                                onChange={e => setThirdPartyEn(e.target.value)}
                                                placeholder="Third Party Consent Text..."
                                                className="min-h-[150px] font-mono text-sm bg-white border-slate-200 rounded-xl"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold text-slate-500 uppercase">Marketing Consent</Label>
                                                <Textarea
                                                    value={marketingTextEn}
                                                    onChange={e => setMarketingTextEn(e.target.value)}
                                                    placeholder="Marketing Consent Text..."
                                                    className="min-h-[150px] font-mono text-sm bg-white border-slate-200 rounded-xl"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold text-slate-500 uppercase">Informational Consent</Label>
                                                <Textarea
                                                    value={infoTextEn}
                                                    onChange={e => setInfoTextEn(e.target.value)}
                                                    placeholder="Informational Consent Text..."
                                                    className="min-h-[150px] font-mono text-sm bg-white border-slate-200 rounded-xl"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

            </div>

            {/* Bottom Floating Action Bar for mobile/ease */}
            <div className="md:hidden fixed bottom-6 right-6 z-50">
                <Button onClick={handleSaveSociety} disabled={loading} size="lg" className="rounded-full shadow-2xl h-14 w-14 bg-slate-900 text-white flex items-center justify-center p-0 hover:scale-105 transition-transform">
                    <Save className="w-6 h-6" />
                </Button>
            </div>
        </div>
    );
};

export default IdentityPage;