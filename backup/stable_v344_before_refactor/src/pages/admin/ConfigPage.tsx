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
import toast from 'react-hot-toast';
import { Building2 } from 'lucide-react';

const ConfigPage: React.FC = () => {
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
        } catch (e: any) {
            console.error(e);
            toast.error('저장 실패: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    if (!society) {
        return <div className="p-10 text-center">학회 정보를 불러오는 중...</div>;
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8 pb-20">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-700">
                    <Building2 className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">학회 아이덴티티 (Society Identity)</h1>
                    <p className="text-gray-500 mt-1">학회의 로고, 이름 및 법적 푸터 정보를 관리합니다.</p>
                </div>
            </div>

            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Branding Section */}
                <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-xl font-semibold mb-4 border-b pb-2">브랜딩 설정</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <Label className="mb-2 block">학회 로고</Label>
                            <div className="bg-gray-50 p-4 rounded-lg border border-dashed text-center">
                                <ImageUpload 
                                    path={`societies/${society?.id}/logo`} 
                                    onUploadComplete={setSocLogo}
                                    previewUrl={socLogo}
                                    className="mx-auto"
                                />
                                <p className="text-xs text-gray-500 mt-2">추천 크기: 200x80px, 투명 PNG</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <Label>학회명 (한국어)</Label>
                                <Input 
                                    value={socNameKo} 
                                    onChange={e => setSocNameKo(e.target.value)} 
                                    placeholder="대한OO학회" 
                                />
                            </div>
                            <div>
                                <Label>학회명 (영어)</Label>
                                <Input 
                                    value={socNameEn} 
                                    onChange={e => setSocNameEn(e.target.value)} 
                                    placeholder="Korean Society of OO" 
                                />
                            </div>
                            <div>
                                <Label>학회 소개 (설명)</Label>
                                <Textarea 
                                    value={socDesc} 
                                    onChange={e => setSocDesc(e.target.value)} 
                                    placeholder="학회에 대한 간단한 소개를 입력하세요..." 
                                    rows={4}
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Footer Info Section */}
                <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-xl font-semibold mb-4 border-b pb-2">푸터 정보 (법적 필수 정보)</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <Label>사업자등록번호</Label>
                            <Input 
                                value={bizReg} 
                                onChange={e => setBizReg(e.target.value)} 
                                placeholder="123-45-67890" 
                            />
                        </div>
                        <div>
                            <Label>대표자명</Label>
                            <Input 
                                value={repName} 
                                onChange={e => setRepName(e.target.value)} 
                                placeholder="홍길동" 
                            />
                        </div>
                        <div className="md:col-span-2">
                            <Label>주소</Label>
                            <Input 
                                value={address} 
                                onChange={e => setAddress(e.target.value)} 
                                placeholder="서울시 강남구 테헤란로..." 
                            />
                        </div>
                        <div>
                            <Label>연락처 (이메일)</Label>
                            <Input 
                                value={contactEmail} 
                                onChange={e => setContactEmail(e.target.value)} 
                                placeholder="office@society.org" 
                            />
                        </div>
                        <div>
                            <Label>연락처 (전화번호)</Label>
                            <Input 
                                value={contactPhone} 
                                onChange={e => setContactPhone(e.target.value)} 
                                placeholder="02-1234-5678" 
                            />
                        </div>
                    </div>
                </section>

                {/* Legal Documents Section */}
                <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-xl font-semibold mb-4 border-b pb-2">법적 약관 관리 (Legal Documents)</h2>
                    
                    <Tabs defaultValue="ko" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="ko">한국어 (Korean)</TabsTrigger>
                            <TabsTrigger value="en">English</TabsTrigger>
                        </TabsList>

                        <TabsContent value="ko" className="space-y-6">
                            <div>
                                <Label className="mb-2 block font-medium">이용약관 (Terms of Service) - KOREAN</Label>
                                <Textarea 
                                    value={terms} 
                                    onChange={e => setTerms(e.target.value)} 
                                    placeholder="이용약관 전문을 입력하세요..." 
                                    className="min-h-[200px] font-mono text-sm"
                                />
                            </div>
                            <div>
                                <Label className="mb-2 block font-medium">개인정보 처리방침 (Privacy Policy) - KOREAN</Label>
                                <Textarea 
                                    value={privacy} 
                                    onChange={e => setPrivacy(e.target.value)} 
                                    placeholder="개인정보 처리방침 전문을 입력하세요..." 
                                    className="min-h-[200px] font-mono text-sm"
                                />
                            </div>
                            <div>
                                <Label className="mb-2 block font-medium">환불 규정 (Refund Policy) - KOREAN</Label>
                                <Textarea 
                                    value={refund} 
                                    onChange={e => setRefund(e.target.value)} 
                                    placeholder="환불 규정을 입력하세요..." 
                                    className="min-h-[150px] font-mono text-sm"
                                />
                            </div>
                            <div className="pt-4 border-t border-dashed">
                                <Label className="mb-2 block font-medium">제3자 정보 제공 동의 (Third Party Consent) - KOREAN</Label>
                                <Textarea 
                                    value={thirdParty} 
                                    onChange={e => setThirdParty(e.target.value)} 
                                    placeholder="제3자 정보 제공 동의 내용을 입력하세요 (행사 등록 시 노출)..." 
                                    className="min-h-[150px] font-mono text-sm"
                                />
                            </div>
                            <div>
                                <Label className="mb-2 block font-medium">마케팅 정보 수신 동의 (Marketing Consent) - KOREAN</Label>
                                <Textarea 
                                    value={marketingText} 
                                    onChange={e => setMarketingText(e.target.value)} 
                                    placeholder="마케팅 정보 수신 동의 내용을 입력하세요..." 
                                    className="min-h-[100px] font-mono text-sm"
                                />
                            </div>
                            <div>
                                <Label className="mb-2 block font-medium">정보성 수신 동의 (Informational Consent) - KOREAN</Label>
                                <Textarea 
                                    value={infoText} 
                                    onChange={e => setInfoText(e.target.value)} 
                                    placeholder="정보성 알림 수신 동의 내용을 입력하세요..." 
                                    className="min-h-[100px] font-mono text-sm"
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="en" className="space-y-6">
                            <div>
                                <Label className="mb-2 block font-medium">이용약관 (Terms of Service) - ENGLISH</Label>
                                <Textarea 
                                    value={termsEn} 
                                    onChange={e => setTermsEn(e.target.value)} 
                                    placeholder="Enter Terms of Service in English..." 
                                    className="min-h-[200px] font-mono text-sm bg-slate-50"
                                />
                            </div>
                            <div>
                                <Label className="mb-2 block font-medium">개인정보 처리방침 (Privacy Policy) - ENGLISH</Label>
                                <Textarea 
                                    value={privacyEn} 
                                    onChange={e => setPrivacyEn(e.target.value)} 
                                    placeholder="Enter Privacy Policy in English..." 
                                    className="min-h-[200px] font-mono text-sm bg-slate-50"
                                />
                            </div>
                            <div>
                                <Label className="mb-2 block font-medium">환불 규정 (Refund Policy) - ENGLISH</Label>
                                <Textarea 
                                    value={refundEn} 
                                    onChange={e => setRefundEn(e.target.value)} 
                                    placeholder="Enter Refund Policy in English..." 
                                    className="min-h-[150px] font-mono text-sm bg-slate-50"
                                />
                            </div>
                            <div className="pt-4 border-t border-dashed">
                                <Label className="mb-2 block font-medium">제3자 정보 제공 동의 (Third Party Consent) - ENGLISH</Label>
                                <Textarea 
                                    value={thirdPartyEn} 
                                    onChange={e => setThirdPartyEn(e.target.value)} 
                                    placeholder="Enter Third Party Consent in English..." 
                                    className="min-h-[150px] font-mono text-sm bg-slate-50"
                                />
                            </div>
                            <div>
                                <Label className="mb-2 block font-medium">마케팅 정보 수신 동의 (Marketing Consent) - ENGLISH</Label>
                                <Textarea 
                                    value={marketingTextEn} 
                                    onChange={e => setMarketingTextEn(e.target.value)} 
                                    placeholder="Enter Marketing Consent in English..." 
                                    className="min-h-[100px] font-mono text-sm bg-slate-50"
                                />
                            </div>
                            <div>
                                <Label className="mb-2 block font-medium">정보성 수신 동의 (Informational Consent) - ENGLISH</Label>
                                <Textarea 
                                    value={infoTextEn} 
                                    onChange={e => setInfoTextEn(e.target.value)} 
                                    placeholder="Enter Informational Consent in English..." 
                                    className="min-h-[100px] font-mono text-sm bg-slate-50"
                                />
                            </div>
                        </TabsContent>
                    </Tabs>
                </section>

                <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveSociety} disabled={loading} size="lg" className="w-full md:w-auto min-w-[150px]">
                        {loading ? '저장 중...' : '설정 저장'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ConfigPage;
