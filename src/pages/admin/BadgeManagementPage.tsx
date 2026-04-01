import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs, query, setDoc, Timestamp, where } from "firebase/firestore";
import {
    ArrowLeft,
    Badge,
    Download,
    Eye,
    Gift,
    Link as LinkIcon,
    Loader2,
    MessageSquareMore,
    QrCode,
    Save,
    Settings,
    Sparkles
} from "lucide-react";
import toast from "react-hot-toast";

import { db } from "../../firebase";
import { useConference } from "../../hooks/useConference";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import BadgeTemplate from "../../components/print/BadgeTemplate";
import { convertBadgeLayoutToConfig } from "../../utils/badgeConverter";
import { getStampMissionTargetCount } from "../../utils/stampTour";

type StampTourPreviewConfig = {
    enabled?: boolean;
    completionRule?: { type?: "COUNT" | "ALL"; requiredCount?: number };
    rewards?: Array<{ id?: string; name?: string; remainingQty?: number }>;
    completionMessage?: string;
};

const BadgeManagementPage: React.FC = () => {
    const navigate = useNavigate();
    const { cid } = useParams<{ cid: string }>();
    const { info } = useConference(cid);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [materialsUrls, setMaterialsUrls] = useState<{ name: string; url: string }[]>([]);
    const [translationUrl, setTranslationUrl] = useState("");
    const [badgeLayoutEnabled, setBadgeLayoutEnabled] = useState(false);
    const [stampTourConfig, setStampTourConfig] = useState<StampTourPreviewConfig | null>(null);
    const [stampTourBoothCount, setStampTourBoothCount] = useState(0);

    const [demoStep, setDemoStep] = useState<"idle" | "scanned" | "consented" | "reward">("idle");
    const [demoGuestbook, setDemoGuestbook] = useState("부스 상담 후 연락을 받고 싶습니다.");
    const [demoStamps, setDemoStamps] = useState(0);
    const [demoReward, setDemoReward] = useState("");

    useEffect(() => {
        if (!cid) return;

        const fetchSettings = async () => {
            try {
                const [badgeConfigSnap, stampTourSnap, stampSponsorsSnap] = await Promise.all([
                    getDoc(doc(db, `conferences/${cid}/settings`, "badge_config")),
                    getDoc(doc(db, `conferences/${cid}/settings`, "stamp_tour")),
                    getDocs(query(
                        collection(db, `conferences/${cid}/sponsors`),
                        where("isStampTourParticipant", "==", true)
                    ))
                ]);

                if (badgeConfigSnap.exists()) {
                    const data = badgeConfigSnap.data() as {
                        materialsUrls?: { name: string; url: string }[];
                        translationUrl?: string;
                        badgeLayoutEnabled?: boolean;
                    };
                    setMaterialsUrls(data.materialsUrls || []);
                    setTranslationUrl(data.translationUrl || "");
                    setBadgeLayoutEnabled(data.badgeLayoutEnabled || false);
                }

                setStampTourConfig(stampTourSnap.exists() ? stampTourSnap.data() as StampTourPreviewConfig : null);
                setStampTourBoothCount(stampSponsorsSnap.size);
            } catch (error) {
                console.error("Failed to fetch badge settings:", error);
                toast.error("명찰 설정을 불러오지 못했습니다.");
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
            await setDoc(doc(db, `conferences/${cid}/settings`, "badge_config"), {
                materialsUrls,
                translationUrl,
                badgeLayoutEnabled,
                updatedAt: Timestamp.now()
            }, { merge: true });

            toast.success("명찰 설정이 저장되었습니다.");
        } catch (error) {
            console.error("Failed to save badge settings:", error);
            toast.error("명찰 설정 저장에 실패했습니다.");
        } finally {
            setSaving(false);
        }
    };

    const addMaterialUrl = () => {
        setMaterialsUrls([...materialsUrls, { name: "", url: "" }]);
    };

    const updateMaterialUrl = (index: number, field: "name" | "url", value: string) => {
        const next = [...materialsUrls];
        next[index][field] = value;
        setMaterialsUrls(next);
    };

    const removeMaterialUrl = (index: number) => {
        setMaterialsUrls(materialsUrls.filter((_, currentIndex) => currentIndex !== index));
    };

    const requiredStampCount = useMemo(() => {
        if (!stampTourConfig?.enabled) return 0;
        return getStampMissionTargetCount(stampTourConfig.completionRule, stampTourBoothCount);
    }, [stampTourBoothCount, stampTourConfig]);

    const demoRewards = useMemo(() => {
        if (stampTourConfig?.rewards?.length) {
            return stampTourConfig.rewards.map((reward) => reward.name || "현장 경품");
        }
        return ["스타벅스 카드", "브랜드 굿즈", "커피 쿠폰"];
    }, [stampTourConfig]);

    const runDemoScan = () => {
        setDemoStep("scanned");
        setDemoReward("");
    };

    const runDemoConsent = () => {
        const nextStampCount = Math.min(requiredStampCount || 1, demoStamps + 1);
        setDemoStamps(nextStampCount);
        setDemoStep("consented");
    };

    const runDemoReward = () => {
        const reward = demoRewards[demoStamps % demoRewards.length] || "현장 경품";
        setDemoReward(reward);
        setDemoStep("reward");
    };

    const resetDemo = () => {
        setDemoStep("idle");
        setDemoStamps(0);
        setDemoReward("");
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-6xl px-4 py-8">
                <div className="mb-8">
                    <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        뒤로가기
                    </Button>
                    <h1 className="text-3xl font-bold text-gray-900">명찰 관리</h1>
                    <p className="mt-2 text-gray-600">
                        디지털 명찰, 출력 명찰, 부스 스탬프 투어 DEMO 흐름을 함께 관리합니다.
                    </p>
                </div>

                <Tabs defaultValue="digital" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="digital">
                            <Badge className="mr-2 h-4 w-4" />
                            디지털 명찰
                        </TabsTrigger>
                        <TabsTrigger value="print">
                            <Download className="mr-2 h-4 w-4" />
                            출력 명찰
                        </TabsTrigger>
                        <TabsTrigger value="preview">
                            <Eye className="mr-2 h-4 w-4" />
                            미리보기
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="digital">
                        <Card>
                            <CardHeader>
                                <CardTitle>디지털 명찰 설정</CardTitle>
                                <CardDescription>
                                    자료 다운로드 링크와 번역 서비스 링크를 관리합니다.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-base font-semibold">자료 다운로드 링크</Label>
                                        <Button onClick={addMaterialUrl} size="sm" variant="outline">
                                            <LinkIcon className="mr-1 h-4 w-4" />
                                            링크 추가
                                        </Button>
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        디지털 명찰의 자료 탭에 노출할 다운로드 링크입니다.
                                    </p>

                                    {materialsUrls.map((material, index) => (
                                        <div key={index} className="flex items-start gap-2">
                                            <div className="flex-1 space-y-2">
                                                <Input
                                                    placeholder="링크 이름"
                                                    value={material.name}
                                                    onChange={(event) => updateMaterialUrl(index, "name", event.target.value)}
                                                />
                                                <Input
                                                    placeholder="URL (https://...)"
                                                    value={material.url}
                                                    onChange={(event) => updateMaterialUrl(index, "url", event.target.value)}
                                                />
                                            </div>
                                            <Button
                                                onClick={() => removeMaterialUrl(index)}
                                                variant="destructive"
                                                size="sm"
                                                className="mt-6"
                                            >
                                                삭제
                                            </Button>
                                        </div>
                                    ))}

                                    {materialsUrls.length === 0 && (
                                        <div className="rounded-lg border-2 border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                                            등록된 링크가 없습니다.
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-base font-semibold">실시간 번역 URL</Label>
                                    <Input
                                        placeholder="https://translation-service.example.com/conference/..."
                                        value={translationUrl}
                                        onChange={(event) => setTranslationUrl(event.target.value)}
                                    />
                                    <p className="text-sm text-gray-500">
                                        디지털 명찰의 번역 탭에 연결할 URL입니다.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="print">
                        <Card>
                            <CardHeader>
                                <CardTitle>출력 명찰 설정</CardTitle>
                                <CardDescription>
                                    명찰 에디터와 출력 레이아웃 사용 여부를 관리합니다.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
                                    <h3 className="mb-2 font-semibold text-blue-900">명찰 에디터</h3>
                                    <p className="mb-4 text-sm text-blue-700">
                                        배경, 필드 위치, 텍스트 스타일을 시각적으로 조정할 수 있습니다.
                                    </p>
                                    <Button onClick={() => navigate(`/admin/conf/${cid}/badge-editor`)} className="w-full">
                                        <Settings className="mr-2 h-4 w-4" />
                                        명찰 에디터 열기
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-base font-semibold">출력 레이아웃 사용</Label>
                                        <input
                                            type="checkbox"
                                            checked={badgeLayoutEnabled}
                                            onChange={(event) => setBadgeLayoutEnabled(event.target.checked)}
                                            className="h-5 w-5 rounded text-blue-600"
                                        />
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        켜면 에디터에서 저장한 출력 명찰 레이아웃을 사용합니다.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="preview">
                        <div className="grid gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>디지털 명찰 미리보기</CardTitle>
                                    <CardDescription>
                                        참가자에게 보여질 기본 카드 형태를 확인합니다.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="mx-auto max-w-sm rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 p-4">
                                        <div className="overflow-hidden rounded-3xl border-4 border-emerald-500 bg-white shadow-xl">
                                            <div className="bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2 text-center text-xs font-bold text-white">
                                                DIGITAL BADGE
                                            </div>
                                            <div className="p-5 text-center">
                                                <p className="mb-1 text-sm text-gray-600">홍길동</p>
                                                <p className="mb-3 text-xs text-gray-500">대한의학회 참가자</p>
                                                <div className="mb-4 inline-block rounded-2xl border-2 border-emerald-200 bg-white p-3">
                                                    <QrCode className="h-28 w-28 text-emerald-500" />
                                                </div>
                                                <div className="grid grid-cols-6 gap-1 text-[10px]">
                                                    {["상태", "체류", "자료", "일정", "번역", "스탬프"].map((tab) => (
                                                        <div key={tab} className="rounded bg-gray-100 px-1 py-1 text-center text-gray-600">
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
                                    <CardTitle>부스 스탬프 투어 DEMO</CardTitle>
                                    <CardDescription>
                                        스캔, 동의, 방명록, 스탬프 적립, 추첨 애니메이션 흐름을 미리 점검합니다.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
                                        <div className="rounded-[1.75rem] border-4 border-emerald-500 bg-gradient-to-br from-emerald-50 to-green-50 p-5 shadow-xl">
                                            <div className="rounded-[1.5rem] bg-white p-5 text-center">
                                                <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-600">
                                                    Digital Badge Demo
                                                </p>
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
                                                        {stampTourConfig?.completionMessage || "목표 수량을 달성하면 추첨 버튼이 활성화됩니다."}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex justify-end">
                                                <Button variant="outline" onClick={resetDemo}>DEMO 초기화</Button>
                                            </div>

                                            <div className="grid gap-3 md:grid-cols-2">
                                                <div className={`rounded-2xl border p-4 ${demoStep === "idle" ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                                                    <p className="mb-2 text-sm font-bold text-slate-900">1. 명찰 스캔</p>
                                                    <p className="mb-3 text-xs text-slate-500">파트너 기기에서 참가자 명찰을 스캔하는 단계입니다.</p>
                                                    <Button className="w-full" onClick={runDemoScan}>스캔 시뮬레이션</Button>
                                                </div>

                                                <div className={`rounded-2xl border p-4 ${demoStep === "scanned" || demoStep === "consented" ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                                                    <p className="mb-2 text-sm font-bold text-slate-900">2. 동의 및 적립</p>
                                                    <p className="mb-3 text-xs text-slate-500">개인정보 동의 후 리드 저장과 스탬프 적립이 진행됩니다.</p>
                                                    <Button className="w-full" onClick={runDemoConsent} disabled={demoStep === "idle"}>
                                                        동의 후 스탬프 적립
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                                <div className="mb-3 flex items-center gap-2 text-slate-900">
                                                    <MessageSquareMore className="h-4 w-4" />
                                                    <p className="text-sm font-bold">방명록 DEMO</p>
                                                </div>
                                                <Input value={demoGuestbook} onChange={(event) => setDemoGuestbook(event.target.value)} />
                                                <p className="mt-2 text-xs text-slate-500">
                                                    입력한 메시지는 파트너 방명록과 참가자 방문 이력에 반영됩니다.
                                                </p>
                                            </div>

                                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                                <div className="mb-3 flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900">3. 상품 추첨 애니메이션</p>
                                                        <p className="text-xs text-slate-500">
                                                            현재 설정: {stampTourConfig?.enabled ? `${requiredStampCount}개 달성 시 추첨 가능` : "스탬프 투어 비활성화"}
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
                                                    <p className="mt-2 text-xs text-amber-600">
                                                        먼저 스탬프를 목표 수량까지 적립해야 합니다.
                                                    </p>
                                                )}
                                            </div>

                                            {demoStep === "reward" && (
                                                <div className="rounded-[1.5rem] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 text-center shadow-lg">
                                                    <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white">
                                                        <Sparkles className="h-8 w-8 animate-pulse" />
                                                    </div>
                                                    <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-600">Reward Animation</p>
                                                    <p className="mt-2 text-2xl font-black text-slate-900">{demoReward}</p>
                                                    <p className="mt-2 text-sm text-slate-500">
                                                        실제 디지털 명찰에서는 애니메이션 직후 수령 안내 문구가 이어집니다.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>출력 명찰 미리보기</CardTitle>
                                    <CardDescription>
                                        저장한 레이아웃이 실제 명찰에 어떻게 반영되는지 확인합니다.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex min-h-[400px] items-center justify-center overflow-auto rounded-xl bg-gray-100 p-8">
                                        {info?.badgeLayout ? (
                                            <div className="origin-center scale-75 bg-white shadow-2xl">
                                                <BadgeTemplate
                                                    data={{
                                                        registrationId: "PREVIEW-123",
                                                        name: "홍길동",
                                                        org: "대한의학회",
                                                        category: "학회 참가자",
                                                        LICENSE: "12345",
                                                        PRICE: "50,000원"
                                                    }}
                                                    config={convertBadgeLayoutToConfig(info.badgeLayout)}
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center py-10 text-gray-500">
                                                <Settings className="mb-4 h-12 w-12 text-gray-300" />
                                                <p>저장된 출력 명찰 레이아웃이 없습니다.</p>
                                                <Button variant="link" onClick={() => navigate(`/admin/conf/${cid}/badge-editor`)}>
                                                    명찰 에디터에서 설정하기
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>

                <div className="fixed bottom-0 left-0 right-0 border-t bg-white p-4 shadow-lg">
                    <div className="mx-auto flex max-w-6xl justify-end gap-3">
                        <Button variant="outline" onClick={() => navigate(-1)}>
                            취소
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    저장 중...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    저장하기
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
