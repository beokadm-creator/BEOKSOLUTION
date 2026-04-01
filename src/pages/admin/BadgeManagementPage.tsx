import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Loader2, Eye, Save, ArrowLeft, Link as LinkIcon, Download, Badge, Settings, Gift, Sparkles, QrCode, MessageSquareMore } from 'lucide-react';
import toast from 'react-hot-toast';

import { useConference } from '../../hooks/useConference';
import BadgeTemplate from '../../components/print/BadgeTemplate';
import { convertBadgeLayoutToConfig } from '../../utils/badgeConverter';

const BadgeManagementPage: React.FC = () => {
    const navigate = useNavigate();
    const { cid } = useParams<{ cid: string }>();
    const { info } = useConference(cid);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Digital Badge Settings
    const [materialsUrls, setMaterialsUrls] = useState<{ name: string; url: string }[]>([]);
    const [translationUrl, setTranslationUrl] = useState('');
    const [stampTourConfig, setStampTourConfig] = useState<{
        enabled?: boolean;
        completionRule?: { type?: 'COUNT' | 'ALL'; requiredCount?: number };
        rewards?: Array<{ id?: string; name?: string; remainingQty?: number }>;
        completionMessage?: string;
    } | null>(null);

    // Print Badge Settings
    const [badgeLayoutEnabled, setBadgeLayoutEnabled] = useState(false);
    const [demoStep, setDemoStep] = useState<'badge' | 'scanned' | 'consent' | 'reward'>('badge');
    const [demoGuestbook, setDemoGuestbook] = useState('?뚰듃??遺?ㅼ뿉???곷떞諛쏄퀬 ?띠뒿?덈떎.');
    const [demoStamps, setDemoStamps] = useState(0);
    const [demoReward, setDemoReward] = useState('');

    useEffect(() => {
        if (!cid) return;

        const fetchSettings = async () => {
            try {
                const [settingsDoc, stampTourDoc] = await Promise.all([
                    getDoc(doc(db, `conferences/${cid}/settings`, 'badge_config')),
                    getDoc(doc(db, `conferences/${cid}/settings`, 'stamp_tour'))
                ]);

                if (settingsDoc.exists()) {
                    const data = settingsDoc.data();
                    setMaterialsUrls(data.materialsUrls || []);
                    setTranslationUrl(data.translationUrl || '');
                    setBadgeLayoutEnabled(data.badgeLayoutEnabled || false);
                }

                if (stampTourDoc.exists()) {
                    setStampTourConfig(stampTourDoc.data());
                } else {
                    setStampTourConfig(null);
                }
            } catch (error) {
                console.error('Failed to fetch badge settings:', error);
                toast.error('紐낆같 ?ㅼ젙??遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎.');
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, [cid]);

    const handleSave = async () => {
        if (!cid) return;

        setSaving(true);
        try {
            await setDoc(doc(db, `conferences/${cid}/settings`, 'badge_config'), {
                materialsUrls,
                translationUrl,
                badgeLayoutEnabled,
                updatedAt: Timestamp.now()
            }, { merge: true });

            toast.success('紐낆같 ?ㅼ젙????λ릺?덉뒿?덈떎.');
        } catch (error) {
            console.error('Failed to save badge settings:', error);
            toast.error('紐낆같 ?ㅼ젙 ??μ뿉 ?ㅽ뙣?덉뒿?덈떎.');
        } finally {
            setSaving(false);
        }
    };

    const addMaterialUrl = () => {
        setMaterialsUrls([...materialsUrls, { name: '', url: '' }]);
    };

    const updateMaterialUrl = (index: number, field: 'name' | 'url', value: string) => {
        const updated = [...materialsUrls];
        updated[index][field] = value;
        setMaterialsUrls(updated);
    };

    const removeMaterialUrl = (index: number) => {
        setMaterialsUrls(materialsUrls.filter((_, i) => i !== index));
    };

    const requiredStampCount = useMemo(() => {
        if (!stampTourConfig?.enabled) return 0;
        if (stampTourConfig.completionRule?.type === 'ALL') {
            return 5;
        }
        return Math.max(1, stampTourConfig.completionRule?.requiredCount || 3);
    }, [stampTourConfig]);

    const demoRewards = stampTourConfig?.rewards?.length
        ? stampTourConfig.rewards.map((reward) => reward.name || '寃쏀뭹')
        : ['?ㅽ?踰낆뒪 移대뱶', '釉뚮옖??援우쫰', '而ㅽ뵾 荑좏룿'];

    const runDemoScan = () => {
        setDemoStep('scanned');
        setDemoReward('');
    };

    const runDemoConsent = () => {
        const nextStampCount = Math.min(requiredStampCount || 1, demoStamps + 1);
        setDemoStamps(nextStampCount);
        setDemoStep(nextStampCount >= (requiredStampCount || 1) ? 'consent' : 'badge');
    };

    const runDemoReward = () => {
        const reward = demoRewards[demoStamps % demoRewards.length] || '?꾩옣 寃쏀뭹';
        setDemoReward(reward);
        setDemoStep('reward');
    };

    const resetDemo = () => {
        setDemoStep('badge');
        setDemoStamps(0);
        setDemoReward('');
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
            <div className="max-w-6xl mx-auto py-8 px-4">
                <div className="mb-8">
                    <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        ?ㅻ줈媛湲?
                    </Button>
                    <h1 className="text-3xl font-bold text-gray-900">명찰 관리</h1>
                    <p className="text-gray-600 mt-2">
                        ?붿???紐낆같怨?異쒕젰 紐낆같???ㅼ젙?섍퀬 愿由ы빀?덈떎.
                    </p>
                </div>

                <Tabs defaultValue="digital" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="digital">
                            <Badge className="w-4 h-4 mr-2" />
                            ?붿???紐낆같
                        </TabsTrigger>
                        <TabsTrigger value="print">
                            <Download className="w-4 h-4 mr-2" />
                            異쒕젰 紐낆같
                        </TabsTrigger>
                        <TabsTrigger value="preview">
                            <Eye className="w-4 h-4 mr-2" />
                            誘몃━蹂닿린
                        </TabsTrigger>
                    </TabsList>

                    {/* Digital Badge Settings */}
                    <TabsContent value="digital">
                        <Card>
                            <CardHeader>
                                <CardTitle>?붿???紐낆같 ?ㅼ젙</CardTitle>
                                <CardDescription>
                                    ?붿???紐낆같 ?붾㈃???쒖떆???먮즺 留곹겕? 踰덉뿭 URL???ㅼ젙?⑸땲??
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Materials URLs */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-base font-semibold">?먮즺 ?ㅼ슫濡쒕뱶 留곹겕</Label>
                                        <Button onClick={addMaterialUrl} size="sm" variant="outline">
                                            <LinkIcon className="w-4 h-4 mr-1" />
                                            留곹겕 異붽?
                                        </Button>
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        ?붿???紐낆같??'?먮즺' ??뿉 ?쒖떆???ㅼ슫濡쒕뱶 留곹겕瑜??ㅼ젙?⑸땲??
                                    </p>

                                    {materialsUrls.map((material, index) => (
                                        <div key={index} className="flex gap-2 items-start">
                                            <div className="flex-1 space-y-2">
                                                <Input
                                                    placeholder="留곹겕 ?대쫫 (?? 媛뺤쓽 ?먮즺??"
                                                    value={material.name}
                                                    onChange={(e) => updateMaterialUrl(index, 'name', e.target.value)}
                                                />
                                                <Input
                                                    placeholder="URL (https://...)"
                                                    value={material.url}
                                                    onChange={(e) => updateMaterialUrl(index, 'url', e.target.value)}
                                                />
                                            </div>
                                            <Button
                                                onClick={() => removeMaterialUrl(index)}
                                                variant="destructive"
                                                size="sm"
                                                className="mt-6"
                                            >
                                                ??젣
                                            </Button>
                                        </div>
                                    ))}

                                    {materialsUrls.length === 0 && (
                                        <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                                            異붽???留곹겕媛 ?놁뒿?덈떎. '留곹겕 異붽?' 踰꾪듉???대┃?섏뿬 留곹겕瑜?異붽??섏꽭??
                                        </div>
                                    )}
                                </div>

                                {/* Translation URL */}
                                <div className="space-y-2">
                                    <Label className="text-base font-semibold">?ㅼ떆媛?踰덉뿭 URL</Label>
                                    <Input
                                        placeholder="https://translation-service.example.com/conference/..."
                                        value={translationUrl}
                                        onChange={(e) => setTranslationUrl(e.target.value)}
                                    />
                                    <p className="text-sm text-gray-500">
                                        ?ㅼ떆媛?踰덉뿭 ?쒕퉬??URL???낅젰?⑸땲?? (異뷀썑 湲곕뒫)
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Print Badge Settings */}
                    <TabsContent value="print">
                        <Card>
                            <CardHeader>
                                <CardTitle>異쒕젰 紐낆같 ?ㅼ젙</CardTitle>
                                <CardDescription>
                                    紐낆같 ?몄쭛湲곕줈 ?대룞?섏뿬 異쒕젰??紐낆같 ?붿옄?몄쓣 ?섏젙?⑸땲??
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                                    <h3 className="font-semibold text-blue-900 mb-2">명찰 편집기</h3>
                                    <p className="text-sm text-blue-700 mb-4">
                                        紐낆같 ?덉씠?꾩썐, ?꾨뱶 ?꾩튂, ?ㅽ??쇱쓣 ?쒓컖?곸쑝濡??몄쭛?????덉뒿?덈떎.
                                    </p>
                                    <Button
                                        onClick={() => navigate(`/admin/conf/${cid}/badge-editor`)}
                                        className="w-full"
                                    >
                                        <Settings className="w-4 h-4 mr-2" />
                                        紐낆같 ?몄쭛湲??닿린
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-base font-semibold">紐낆같 ?덉씠?꾩썐 ?ъ슜</Label>
                                        <input
                                            type="checkbox"
                                            checked={badgeLayoutEnabled}
                                            onChange={(e) => setBadgeLayoutEnabled(e.target.checked)}
                                            className="w-5 h-5 text-blue-600 rounded"
                                        />
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        紐낆같 ?몄쭛湲곗뿉???ㅼ젙???덉씠?꾩썐???ъ슜?섏뿬 紐낆같??異쒕젰?⑸땲??
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Preview */}
                    <TabsContent value="preview">
                        <div className="grid gap-6">
                            {/* Digital Badge Preview */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>?붿???紐낆같 誘몃━蹂닿린</CardTitle>
                                    <CardDescription>
                                        ?붿???紐낆같???ㅼ젣濡??대뼸寃??쒖떆?섎뒗吏 ?뺤씤?⑸땲??
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-4 max-w-sm mx-auto">
                                        <div className="bg-white border-4 border-emerald-500 rounded-3xl overflow-hidden">
                                            <div className="bg-gradient-to-r from-emerald-500 to-green-500 py-2 px-4">
                                                <div className="flex items-center justify-center gap-2 text-white">
                                                    <span className="text-xs font-bold">DIGITAL BADGE</span>
                                                </div>
                                            </div>
                                            <div className="p-4 text-center">
                                                <p className="text-sm text-gray-600 mb-1">홍길동</p>
                                                <p className="text-xs text-gray-500 mb-2">?쒖슱??숆탳</p>
                                                <div className="bg-white p-2 inline-block rounded-xl border-2 border-emerald-200 mb-2">
                                                    <div className="w-32 h-32 bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                                                        QR Code
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-5 gap-1 text-xs">
                                                    {['?곹깭', '?섍컯', '?먮즺', '?꾨줈洹몃옩', '踰덉뿭'].map((tab) => (
                                                        <div key={tab} className="bg-gray-100 rounded py-1 px-1 text-center text-gray-600">
                                                            {tab}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>부스 투어 DEMO</CardTitle>
                                    <CardDescription>
                                        배지 미리보기에서 스캔, 동의, 방명록, 스탬프 적립, 추첨 애니메이션까지 순서대로 점검합니다.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
                                        <div className="rounded-[1.75rem] border-4 border-emerald-500 bg-gradient-to-br from-emerald-50 to-green-50 p-5 shadow-xl">
                                            <div className="rounded-[1.5rem] bg-white p-5 text-center">
                                                <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-600">Digital Badge Demo</p>
                                                <p className="mt-3 text-2xl font-black text-slate-900">홍길동</p>
                                                <p className="text-sm text-slate-500">대한의학회 참가자</p>
                                                <div className="mt-4 inline-flex rounded-2xl border-2 border-emerald-200 bg-white p-3">
                                                    <QrCode className="h-28 w-28 text-emerald-500" />
                                                </div>
                                                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
                                                    <div className="flex items-center justify-between text-sm font-bold text-amber-900">
                                                        <span>스탬프 진행률</span>
                                                        <span>{demoStamps} / {requiredStampCount || 3}</span>
                                                    </div>
                                                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-amber-200">
                                                        <div
                                                            className="h-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                                                            style={{ width: `${Math.min(100, (demoStamps / Math.max(requiredStampCount || 3, 1)) * 100)}%` }}
                                                        />
                                                    </div>
                                                    <p className="mt-2 text-xs text-amber-700">
                                                        {stampTourConfig?.completionMessage || '목표 수량 달성 후 상품 추첨 버튼이 활성화됩니다.'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex justify-end">
                                                <Button variant="outline" onClick={resetDemo}>DEMO 초기화</Button>
                                            </div>

                                            <div className="grid gap-3 md:grid-cols-2">
                                                <div className={`rounded-2xl border p-4 ${demoStep === 'badge' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                                                    <p className="mb-2 text-sm font-bold text-slate-900">1. 명찰 스캔</p>
                                                    <p className="mb-3 text-xs text-slate-500">파트너 기기에서 참가자의 QR을 스캔하는 장면을 재현합니다.</p>
                                                    <Button className="w-full" onClick={runDemoScan}>스캔 시뮬레이션</Button>
                                                </div>
                                                <div className={`rounded-2xl border p-4 ${demoStep === 'scanned' || demoStep === 'consent' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                                                    <p className="mb-2 text-sm font-bold text-slate-900">2. 제3자 동의 및 스탬프</p>
                                                    <p className="mb-3 text-xs text-slate-500">동의 후 리드와 방명록이 저장되고 스탬프가 적립되는 흐름입니다.</p>
                                                    <Button className="w-full" onClick={runDemoConsent} disabled={demoStep === 'badge'}>
                                                        동의 후 스탬프 적립
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                                <div className="mb-3 flex items-center gap-2 text-slate-900">
                                                    <MessageSquareMore className="h-4 w-4" />
                                                    <p className="text-sm font-bold">방명록 DEMO</p>
                                                </div>
                                                <Input value={demoGuestbook} onChange={(e) => setDemoGuestbook(e.target.value)} />
                                                <p className="mt-2 text-xs text-slate-500">입력한 문구가 방문 이력과 방명록에 함께 노출됩니다.</p>
                                            </div>

                                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                                <div className="mb-3 flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900">3. 상품 추첨 애니메이션</p>
                                                        <p className="text-xs text-slate-500">
                                                            현재 설정: {stampTourConfig?.enabled ? `활성화, ${requiredStampCount}개 달성 시 추첨 가능` : '스탬프 투어 비활성화'}
                                                        </p>
                                                    </div>
                                                    <Gift className="h-5 w-5 text-amber-500" />
                                                </div>
                                                <div className="mb-3 flex flex-wrap gap-2">
                                                    {demoRewards.map((reward) => (
                                                        <span key={reward} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                                            {reward}
                                                        </span>
                                                    ))}
                                                </div>
                                                <Button className="w-full" onClick={runDemoReward} disabled={demoStamps < (requiredStampCount || 1)}>
                                                    추첨 애니메이션 실행
                                                </Button>
                                                {demoStamps < (requiredStampCount || 1) && (
                                                    <p className="mt-2 text-xs text-amber-600">스탬프를 먼저 목표 수량까지 모아야 합니다.</p>
                                                )}
                                            </div>

                                            {demoStep === 'reward' && (
                                                <div className="rounded-[1.5rem] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 text-center shadow-lg">
                                                    <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white">
                                                        <Sparkles className="h-8 w-8 animate-pulse" />
                                                    </div>
                                                    <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-600">Reward Animation</p>
                                                    <p className="mt-2 text-2xl font-black text-slate-900">{demoReward}</p>
                                                    <p className="mt-2 text-sm text-slate-500">실제 디지털 명찰에서는 이 애니메이션 직후 수령 안내 문구가 이어집니다.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Print Badge Preview */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>異쒕젰 紐낆같 誘몃━蹂닿린</CardTitle>
                                    <CardDescription>
                                        異쒕젰??紐낆같???대뼸寃??쒖떆?섎뒗吏 ?뺤씤?⑸땲?? (諛곌꼍 ?대?吏 諛??덉씠?꾩썐 諛섏쁺)
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex justify-center bg-gray-100 p-8 rounded-xl overflow-auto min-h-[400px] items-center">
                                        {info?.badgeLayout ? (
                                            <div className="shadow-2xl bg-white transform scale-75 origin-center">
                                                <BadgeTemplate
                                                    data={{
                                                        registrationId: 'PREVIEW-123',
                                                        name: '홍길동',
                                                        org: '?쒖슱??숆탳蹂묒썝',
                                                        category: '학회 참가자',
                                                        LICENSE: '12345',
                                                        PRICE: '50,000원'
                                                    }}
                                                    config={convertBadgeLayoutToConfig(info.badgeLayout)}
                                                />
                                            </div>
                                        ) : (
                                            <div className="text-gray-500 py-10 flex flex-col items-center">
                                                <Settings className="w-12 h-12 mb-4 text-gray-300" />
                                                <p>紐낆같 ?덉씠?꾩썐 ?뺣낫媛 ?놁뒿?덈떎.</p>
                                                <Button variant="link" onClick={() => navigate(`/admin/conf/${cid}/badge-editor`)}>
                                                    紐낆같 ?몄쭛湲곗뿉???ㅼ젙?섍린
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Save Button */}
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg">
                    <div className="max-w-6xl mx-auto flex justify-end gap-3">
                        <Button variant="outline" onClick={() => navigate(-1)}>
                            痍⑥냼
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ???以?..
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    ??ν븯湲?
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BadgeManagementPage;


