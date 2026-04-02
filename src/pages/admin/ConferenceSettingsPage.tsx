import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, onSnapshot, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, functions, storage } from '../../firebase';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent } from '../../components/ui/card';
import { Switch } from '../../components/ui/switch';
import BilingualInput from '../../components/ui/bilingual-input';
import BilingualImageUpload from '../../components/ui/bilingual-image-upload';
import RichTextEditor from '../../components/ui/RichTextEditor';
import { ArrowDown, ArrowUp, Calendar, MapPin, Globe, FileText, ImageIcon, Save, Loader2, Info, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Skeleton } from '../../components/ui/skeleton';
import { getStampMissionTargetCount, hasValidStampTourRewards, normalizeStampTourRewards } from '../../utils/stampTour';

interface ConferenceData {
    title: { ko: string; en: string };
    subtitle?: string;
    slug: string;
    dates: { start: string; end: string };
    venue: {
        name: { ko: string; en: string };
        address: { ko: string; en: string };
        mapUrl: string;
        googleMapEmbedUrl?: string;
    };
    visualAssets: {
        banner: { ko: string; en: string };
        poster: { ko: string; en: string };
    };
    welcomeMessage: { ko: string; en: string };
    welcomeMessageImages?: string[]; // Array of image URLs
    abstractDeadlines: {
        submissionDeadline?: string;
        editDeadline?: string;
    };
    features: {
        guestbookEnabled: boolean;
        stampTourEnabled: boolean;
    };
}

interface SponsorSummary {
    id: string;
    name: string;
    vendorId?: string;
    order?: number;
    isStampTourParticipant?: boolean;
}

type StampTourCompletionType = 'COUNT' | 'ALL';
type StampTourBoothOrderMode = 'SPONSOR_ORDER' | 'CUSTOM';
type StampTourRewardMode = 'RANDOM' | 'FIXED';
type StampTourDrawMode = 'PARTICIPANT' | 'ADMIN' | 'BOTH';
type StampTourRewardFulfillmentMode = 'INSTANT' | 'LOTTERY';

interface StampTourRewardForm {
    id: string;
    name: string;
    imageUrl?: string;
    totalQty: number;
    remainingQty: number;
    weight?: number;
    order?: number;
    isFallback?: boolean;
}

interface StampTourConfigForm {
    enabled: boolean;
    endAt?: Timestamp;
    completionRule: {
        type: StampTourCompletionType;
        requiredCount?: number;
    };
    boothOrderMode: StampTourBoothOrderMode;
    customBoothOrder: string[];
    rewardMode: StampTourRewardMode;
    drawMode: StampTourDrawMode;
    rewardFulfillmentMode: StampTourRewardFulfillmentMode;
    lotteryScheduledAt?: Timestamp;
    rewards: StampTourRewardForm[];
    soldOutMessage: string;
    completionMessage: string;
}

interface StampTourProgressRow {
    id: string;
    userId: string;
    isCompleted?: boolean;
    userName?: string;
    userOrg?: string;
    rewardName?: string;
    rewardStatus: 'NONE' | 'REQUESTED' | 'REDEEMED';
    lotteryStatus?: 'PENDING' | 'SELECTED' | 'NOT_SELECTED';
    completedAt?: Timestamp;
    requestedAt?: Timestamp;
    redeemedAt?: Timestamp;
    requestedBy?: string;
}

const defaultData: ConferenceData = {
    title: { ko: '', en: '' },
    subtitle: '',
    slug: '',
    dates: { start: '', end: '' },
    venue: {
        name: { ko: '', en: '' },
        address: { ko: '', en: '' },
        mapUrl: '',
        googleMapEmbedUrl: ''
    },
    visualAssets: {
        banner: { ko: '', en: '' },
        poster: { ko: '', en: '' }
    },
    welcomeMessage: { ko: '', en: '' },
    welcomeMessageImages: [],
    abstractDeadlines: {
        submissionDeadline: '',
        editDeadline: ''
    },
    features: {
        guestbookEnabled: true,
        stampTourEnabled: false
    }
};

const defaultStampTourConfig: StampTourConfigForm = {
    enabled: false,
    completionRule: {
        type: 'COUNT',
        requiredCount: 5
    },
    boothOrderMode: 'SPONSOR_ORDER',
    customBoothOrder: [],
    rewardMode: 'RANDOM',
    drawMode: 'PARTICIPANT',
    rewardFulfillmentMode: 'INSTANT',
    rewards: [],
    soldOutMessage: '선착순 경품이 모두 소진되었습니다.',
    completionMessage: '스탬프 투어를 완료했습니다. 상품 수령 버튼을 눌러주세요.'
};

export default function ConferenceSettingsPage() {
    const { cid } = useParams<{ cid: string }>();
    const location = useLocation();
    const [data, setData] = useState<ConferenceData>(defaultData);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [sponsors, setSponsors] = useState<SponsorSummary[]>([]);
    const [stampTourConfig, setStampTourConfig] = useState<StampTourConfigForm>(defaultStampTourConfig);
    const [stampTourProgress, setStampTourProgress] = useState<StampTourProgressRow[]>([]);
    const [drawingUserId, setDrawingUserId] = useState<string | null>(null);

    const getKstEndOfDayTimestamp = (dtStr: string): Timestamp | null => {
        if (!dtStr) return null;
        const [datePart] = dtStr.split('T');
        if (!datePart) return null;
        const [year, month, day] = datePart.split('-').map(Number);
        if (!year || !month || !day) return null;
        // 23:59 KST = 14:59 UTC
        return Timestamp.fromDate(new Date(Date.UTC(year, month - 1, day, 14, 59, 0, 0)));
    };

    const formatKstTimestamp = (ts?: Timestamp): string => {
        if (!ts) return '-';
        const d = ts.toDate();
        const kstOffset = 9 * 60;
        const localMs = d.getTime() + kstOffset * 60 * 1000;
        const kstDate = new Date(localMs);
        const year = kstDate.getUTCFullYear();
        const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(kstDate.getUTCDate()).padStart(2, '0');
        const hours = String(kstDate.getUTCHours()).padStart(2, '0');
        const minutes = String(kstDate.getUTCMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes} KST`;
    };

    useEffect(() => {
        if (!cid) return;

        const fetchData = async () => {
            try {
                const docRef = doc(db, 'conferences', cid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const snapData = docSnap.data();

                    const toDateTimeLocalStr = (ts: unknown): string => {
                        if (ts && typeof ts === 'object' && 'toDate' in ts && typeof (ts as { toDate?: () => Date }).toDate === 'function') {
                            // Firestore Timestamp → KST 기준 datetime-local 문자열로 변환
                            const d = (ts as { toDate: () => Date }).toDate();
                            // KST(Asia/Seoul, UTC+9) 기준으로 변환
                            const kstOffset = 9 * 60; // 분 단위
                            const localMs = d.getTime() + kstOffset * 60 * 1000;
                            const kstDate = new Date(localMs);
                            const year = kstDate.getUTCFullYear();
                            const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
                            const day = String(kstDate.getUTCDate()).padStart(2, '0');
                            const hours = String(kstDate.getUTCHours()).padStart(2, '0');
                            const minutes = String(kstDate.getUTCMinutes()).padStart(2, '0');
                            return `${year}-${month}-${day}T${hours}:${minutes}`;
                        }
                        if (typeof ts === 'string' && ts.length >= 10) {
                            // 날짜만 있는 문자열('YYYY-MM-DD')은 00:00으로 표기
                            return ts.includes('T') ? ts.substring(0, 16) : `${ts}T00:00`;
                        }
                        return '';
                    };

                    const startStr = toDateTimeLocalStr(snapData.startDate || snapData.dates?.start);
                    const endStr = toDateTimeLocalStr(snapData.endDate || snapData.dates?.end);

                    setData({
                        title: { ko: snapData.title?.ko || '', en: snapData.title?.en || '' },
                        subtitle: snapData.subtitle || '',
                        slug: snapData.slug || cid || '',
                        dates: {
                            start: startStr,
                            end: endStr
                        },
                        venue: {
                            name: {
                                ko: snapData.venue?.name?.ko || snapData.venue?.name || '',
                                en: snapData.venue?.name?.en || ''
                            },
                            address: {
                                ko: snapData.venue?.address?.ko || snapData.venue?.address || '',
                                en: snapData.venue?.address?.en || ''
                            },
                            mapUrl: snapData.venue?.mapUrl || '',
                            googleMapEmbedUrl: snapData.venue?.googleMapEmbedUrl || ''
                        },
                        abstractDeadlines: {
                            submissionDeadline: toDateTimeLocalStr(snapData.abstractSubmissionDeadline),
                            editDeadline: toDateTimeLocalStr(snapData.abstractEditDeadline)
                        },
                        visualAssets: {
                            banner: {
                                ko: snapData.visualAssets?.banner?.ko || snapData.bannerUrl || '',
                                en: snapData.visualAssets?.banner?.en || ''
                            },
                            poster: {
                                ko: snapData.visualAssets?.poster?.ko || snapData.posterUrl || '',
                                en: snapData.visualAssets?.poster?.en || ''
                            }
                        },
                        welcomeMessage: {
                            ko: snapData.welcomeMessage?.ko || snapData.welcomeMessage || '',
                            en: snapData.welcomeMessage?.en || ''
                        },
                        welcomeMessageImages: snapData.welcomeMessageImages || [],
                        features: {
                            guestbookEnabled: snapData.features?.guestbookEnabled ?? true,
                            stampTourEnabled: snapData.features?.stampTourEnabled ?? false
                        }
                    });

                    const sponsorsSnap = await getDocs(collection(db, `conferences/${cid}/sponsors`));
                    const sponsorList = sponsorsSnap.docs.map(d => {
                        const s = d.data() as { name?: string; vendorId?: string; order?: number; isStampTourParticipant?: boolean };
                        return {
                            id: d.id,
                            name: s.name || d.id,
                            vendorId: s.vendorId,
                            order: s.order,
                            isStampTourParticipant: s.isStampTourParticipant === true
                        } as SponsorSummary;
                    });
                    sponsorList.sort((a, b) => (a.order || 999) - (b.order || 999));
                    setSponsors(sponsorList);

                    const configRef = doc(db, `conferences/${cid}/settings`, 'stamp_tour');
                    const configSnap = await getDoc(configRef);
                    if (configSnap.exists()) {
                        const cfg = configSnap.data() as Partial<StampTourConfigForm>;
                        setStampTourConfig({
                            ...defaultStampTourConfig,
                            ...cfg,
                            completionRule: {
                                ...defaultStampTourConfig.completionRule,
                                ...(cfg.completionRule || {})
                            },
                            rewards: Array.isArray(cfg.rewards) ? cfg.rewards : [],
                            customBoothOrder: Array.isArray(cfg.customBoothOrder) ? cfg.customBoothOrder : [],
                            drawMode: cfg.drawMode || defaultStampTourConfig.drawMode,
                            rewardFulfillmentMode: cfg.rewardFulfillmentMode || defaultStampTourConfig.rewardFulfillmentMode,
                            lotteryScheduledAt: cfg.lotteryScheduledAt,
                            enabled: snapData.features?.stampTourEnabled ?? cfg.enabled ?? false,
                            endAt: cfg.endAt || getKstEndOfDayTimestamp(endStr) || undefined
                        });
                    } else {
                        setStampTourConfig(prev => ({
                            ...prev,
                            enabled: snapData.features?.stampTourEnabled ?? false,
                            endAt: getKstEndOfDayTimestamp(endStr) || undefined
                        }));
                    }
                }
            } catch (error) {
                console.error("Error fetching conference settings:", error);
                toast.error("Failed to load settings.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [cid]);

    useEffect(() => {
        if (location.hash !== '#stamp-tour') return;
        const scrollToStampTour = () => {
            const section = document.getElementById('stamp-tour');
            if (!section) return false;
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return true;
        };

        if (scrollToStampTour()) return;
        const timer = window.setTimeout(() => {
            scrollToStampTour();
        }, 250);
        return () => window.clearTimeout(timer);
    }, [location.hash, loading, data.features.stampTourEnabled]);

    useEffect(() => {
        if (!data.features.stampTourEnabled && !stampTourConfig.enabled) return;
        const endAt = stampTourConfig.endAt || getKstEndOfDayTimestamp(data.dates.end) || undefined;
        setStampTourConfig(prev => ({
            ...prev,
            enabled: data.features.stampTourEnabled,
            endAt
        }));
    }, [data.features.stampTourEnabled, data.dates.end, stampTourConfig.enabled, stampTourConfig.endAt]);

    useEffect(() => {
        if (!cid) return;
        const ref = collection(db, `conferences/${cid}/stamp_tour_progress`);
        const unsub = onSnapshot(ref, (snap) => {
            const list = snap.docs.map(d => {
                const v = d.data() as StampTourProgressRow;
                return { ...v, id: d.id };
            });
            list.sort((a, b) => {
                const at = a.completedAt?.toMillis ? a.completedAt.toMillis() : 0;
                const bt = b.completedAt?.toMillis ? b.completedAt.toMillis() : 0;
                return bt - at;
            });
            setStampTourProgress(list);
        });
        return () => unsub();
    }, [cid]);

    const stampTourParticipantCount = sponsors.filter((sponsor) => sponsor.isStampTourParticipant).length;
    const normalizedRequiredStampCount = getStampMissionTargetCount(
        stampTourConfig.completionRule,
        stampTourParticipantCount
    );

    const handleSave = async () => {
        if (!cid) return;
        setSaving(true);
        try {
            if (data.features.stampTourEnabled && stampTourParticipantCount === 0) {
                toast.error('스탬프 투어 참여 부스를 먼저 1개 이상 연결해 주세요.');
                return;
            }

            const sanitizedRewards = normalizeStampTourRewards(
                stampTourConfig.rewards,
                stampTourConfig.rewardMode
            );
            if (
                data.features.stampTourEnabled &&
                !hasValidStampTourRewards(sanitizedRewards, stampTourConfig.rewardMode)
            ) {
                toast.error('보상 이름, 수량, 랜덤 가중치 또는 고정 순서를 확인해 주세요.');
                return;
            }

            if (
                data.features.stampTourEnabled &&
                stampTourConfig.rewardFulfillmentMode === 'LOTTERY' &&
                !stampTourConfig.lotteryScheduledAt
            ) {
                toast.error('예약 추첨형은 추첨 예정 시각을 반드시 지정해야 합니다.');
                return;
            }

            const docRef = doc(db, 'conferences', cid);

            // datetime-local 값(예: "2026-05-10T09:00")을 KST 기준 UTC Timestamp로 변환
            // new Date("2026-05-10T09:00")는 로컬 타임존(KST) 기준으로 파싱됨
            // 단, 브라우저가 다른 타임존에 있을 경우를 대비해 명시적으로 KST 오프셋 적용
            const parseDatetimeLocal = (dtStr: string): Date => {
                // datetime-local 값은 타임존 정보 없음 → KST(UTC+9)로 명시 처리
                // "2026-05-10T09:00" → UTC 2026-05-10T00:00:00Z 로 변환
                const [datePart, timePart] = dtStr.split('T');
                const [year, month, day] = datePart.split('-').map(Number);
                const [hour, minute] = (timePart || '00:00').split(':').map(Number);
                // KST = UTC+9, 즉 UTC로 변환할 때 9시간 빼기
                return new Date(Date.UTC(year, month - 1, day, hour - 9, minute, 0, 0));
            };

            const updateData = {
                title: data.title,
                subtitle: data.subtitle,
                startDate: data.dates.start ? Timestamp.fromDate(parseDatetimeLocal(data.dates.start)) : null,
                endDate: data.dates.end ? Timestamp.fromDate(parseDatetimeLocal(data.dates.end)) : null,
                dates: {
                    start: data.dates.start ? Timestamp.fromDate(parseDatetimeLocal(data.dates.start)) : null,
                    end: data.dates.end ? Timestamp.fromDate(parseDatetimeLocal(data.dates.end)) : null,
                },
                venue: data.venue,
                bannerUrl: data.visualAssets.banner.ko,
                posterUrl: data.visualAssets.poster.ko,
                visualAssets: data.visualAssets,
                welcomeMessage: data.welcomeMessage,
                welcomeMessageImages: data.welcomeMessageImages || [],
                abstractSubmissionDeadline: data.abstractDeadlines.submissionDeadline ? Timestamp.fromDate(parseDatetimeLocal(data.abstractDeadlines.submissionDeadline)) : null,
                abstractEditDeadline: data.abstractDeadlines.editDeadline ? Timestamp.fromDate(parseDatetimeLocal(data.abstractDeadlines.editDeadline)) : null,
                features: {
                    guestbookEnabled: data.features.guestbookEnabled,
                    stampTourEnabled: data.features.stampTourEnabled
                },
                updatedAt: Timestamp.now()
            };

            await updateDoc(docRef, updateData);

            const endAt = stampTourConfig.endAt || getKstEndOfDayTimestamp(data.dates.end) || undefined;
            const stampConfigRef = doc(db, `conferences/${cid}/settings`, 'stamp_tour');
            await setDoc(stampConfigRef, {
                ...stampTourConfig,
                completionRule: {
                    ...stampTourConfig.completionRule,
                    requiredCount: stampTourConfig.completionRule.type === 'COUNT'
                        ? normalizedRequiredStampCount
                        : undefined
                },
                enabled: data.features.stampTourEnabled,
                endAt,
                rewards: sanitizedRewards
            }, { merge: true });

            if (
                data.features.stampTourEnabled &&
                stampTourConfig.completionRule.type === 'COUNT' &&
                normalizedRequiredStampCount !== (stampTourConfig.completionRule.requiredCount || 0)
            ) {
                toast.success(`완료 기준을 참여 부스 수에 맞춰 ${normalizedRequiredStampCount}개로 보정했습니다.`);
            }

            toast.success("Conference settings saved successfully!");
        } catch (error) {
            console.error("Error saving conference settings:", error);
            toast.error("Failed to save settings.");
        } finally {
            setSaving(false);
        }
    };

    const handleImageUpload = async (file: File): Promise<string> => {
        setUploadingImage(true);
        try {
            const fileName = `welcome_${cid}_${Date.now()}_${file.name}`;
            const storageRef = ref(storage, `conferences/${cid}/welcome/${fileName}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            return downloadURL;
        } catch (error) {
            console.error('Image upload error:', error);
            toast.error('이미지 업로드 실패 / Image upload failed');
            throw error;
        } finally {
            setUploadingImage(false);
        }
    };

    const handleAdminRewardDraw = async (row: StampTourProgressRow) => {
        if (!cid) return;

        setDrawingUserId(row.id);
        try {
            const adminDrawReward = httpsCallable(functions, 'adminDrawStampReward');
            const response = await adminDrawReward({
                confId: cid,
                userId: row.id,
                userName: row.userName,
                userOrg: row.userOrg
            });

            const payload = response.data as { rewardName?: string };
            toast.success(
                payload.rewardName
                    ? `${row.userName || row.id} 추첨 완료: ${payload.rewardName}`
                    : `${row.userName || row.id} 추첨이 완료되었습니다.`
            );
        } catch (error) {
            console.error('Admin reward draw failed:', error);
            toast.error(error instanceof Error ? error.message : '관리자 추첨 처리에 실패했습니다.');
        } finally {
            setDrawingUserId(null);
        }
    };

    const handleRunLottery = async () => {
        if (!cid) return;
        window.location.href = `/admin/conf/${cid}/stamp-tour-draw`;
    };

    const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const url = await handleImageUpload(file);
            setData(prev => ({
                ...prev,
                welcomeMessageImages: [...(prev.welcomeMessageImages || []), url]
            }));
            toast.success('이미지가 추가되었습니다 / Image added');
        } catch {
            // Error already handled in handleImageUpload
        }
    };

    const handleRemoveImage = (index: number) => {
        setData(prev => ({
            ...prev,
            welcomeMessageImages: prev.welcomeMessageImages?.filter((_, i) => i !== index) || []
        }));
    };

    if (!cid) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="text-center space-y-3">
                    <Info className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-slate-500 font-medium">관리할 행사를 먼저 선택해주세요.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto p-6 space-y-8">
                <Skeleton className="h-12 w-full max-w-sm rounded-lg" />
                <div className="space-y-6">
                    <Skeleton className="h-64 w-full rounded-xl" />
                    <Skeleton className="h-64 w-full rounded-xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full pb-32">
            {/* Sticky Header */}
            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200 shadow-sm transition-all">
                <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">행사 설정</h1>
                        <p className="text-sm text-slate-500 font-medium mt-0.5">기본 정보 및 시각 자료 관리</p>
                    </div>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        size="lg"
                        className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg hover:shadow-slate-900/20 transition-all font-semibold rounded-full px-8"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                저장 중...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                변경사항 저장
                            </>
                        )}
                    </Button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-10 space-y-12">

                {/* 1. Basic Info Section */}
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                    <div className="lg:col-span-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
                                <Calendar className="w-6 h-6" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800">기본 정보</h2>
                        </div>
                        <p className="text-slate-500 leading-relaxed text-sm">
                            행사의 공식 명칭, 진행 기간, 그리고 슬로건을 설정합니다.<br />
                            이 정보는 행사의 정체성을 나타내는 가장 중요한 데이터입니다.
                        </p>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mt-4">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
                                <Globe className="w-3.5 h-3.5" />
                                URL Slug
                            </div>
                            <code className="block bg-white px-3 py-2 rounded-lg text-sm text-slate-700 border border-slate-200 font-mono">
                                /{data.slug}
                            </code>
                        </div>
                    </div>

                    <div className="lg:col-span-8">
                        <Card className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden rounded-2xl">
                            <CardContent className="p-6 md:p-8 space-y-8">
                                <BilingualInput
                                    label="컨퍼런스 제목 (Title)"
                                    valueKO={data.title.ko}
                                    valueEN={data.title.en}
                                    onChangeKO={(value) => setData(prev => ({ ...prev, title: { ...prev.title, ko: value } }))}
                                    onChangeEN={(value) => setData(prev => ({ ...prev, title: { ...prev.title, en: value } }))}
                                    placeholderKO="예: 제 35회 춘계학술대회"
                                    placeholderEN="e.g. The 35th Spring Conference"
                                    required
                                />

                                <div className="space-y-3">
                                    <Label className="text-base font-medium text-slate-700">부제 / 슬로건 (Subtitle)</Label>
                                    <Input
                                        value={data.subtitle || ''}
                                        onChange={(e) => setData(prev => ({ ...prev, subtitle: e.target.value }))}
                                        placeholder="예: Innovating the Future of Medicine"
                                        className="h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg text-base"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <Label className="text-base font-medium text-slate-700">시작 일시 (Start Date & Time)</Label>
                                        <Input
                                            type="datetime-local"
                                            value={data.dates.start}
                                            onChange={(e) => setData(prev => ({ ...prev, dates: { ...prev.dates, start: e.target.value } }))}
                                            className="h-11 border-slate-200 rounded-lg"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <Label className="text-base font-medium text-slate-700">종료 일시 (End Date & Time)</Label>
                                        <Input
                                            type="datetime-local"
                                            value={data.dates.end}
                                            onChange={(e) => setData(prev => ({ ...prev, dates: { ...prev.dates, end: e.target.value } }))}
                                            className="h-11 border-slate-200 rounded-lg"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </section>

                <hr className="border-slate-100" />

                {/* 2.5 Abstract Deadlines Section */}
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                    <div className="lg:col-span-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="p-2.5 bg-purple-50 rounded-xl text-purple-600">
                                <FileText className="w-6 h-6" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800">초록 접수 기간</h2>
                        </div>
                        <p className="text-slate-500 leading-relaxed text-sm">
                            초록 접수 및 수정 기간을 설정합니다.<br />
                            기간이 지나면 사용자는 초록을 제출하거나 수정할 수 없습니다.
                        </p>
                    </div>

                    <div className="lg:col-span-8">
                        <Card className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden rounded-2xl">
                            <CardContent className="p-6 md:p-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <Label className="text-base font-medium text-slate-700">신규 접수 마감 일시 (Submission Deadline)</Label>
                                        <Input
                                            type="datetime-local"
                                            value={data.abstractDeadlines.submissionDeadline || ''}
                                            onChange={(e) => setData(prev => ({ ...prev, abstractDeadlines: { ...prev.abstractDeadlines, submissionDeadline: e.target.value } }))}
                                            className="h-11 border-slate-200 rounded-lg"
                                        />
                                        <p className="text-xs text-slate-400 mt-1">
                                            이 시간까지 새로운 초록을 제출할 수 있습니다.
                                        </p>
                                    </div>
                                    <div className="space-y-3">
                                        <Label className="text-base font-medium text-slate-700">수정 마감 일시 (Edit Deadline)</Label>
                                        <Input
                                            type="datetime-local"
                                            value={data.abstractDeadlines.editDeadline || ''}
                                            onChange={(e) => setData(prev => ({ ...prev, abstractDeadlines: { ...prev.abstractDeadlines, editDeadline: e.target.value } }))}
                                            className="h-11 border-slate-200 rounded-lg"
                                        />
                                        <p className="text-xs text-slate-400 mt-1">
                                            이 시간까지 기존 초록을 수정할 수 있습니다.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </section>

                <hr className="border-slate-100" />

                {/* 2.7 Feature Toggles Section */}
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                    <div className="lg:col-span-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
                                <Info className="w-6 h-6" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800">부가 기능</h2>
                        </div>
                        <p className="text-slate-500 leading-relaxed text-sm">
                            학술대회별로 방명록과 스탬프투어 사용 여부를 설정합니다.<br />
                            방명록은 기본 설정이며, 스탬프투어는 별도 기획에 맞춰 필요 시 활성화합니다.
                        </p>
                    </div>

                    <div className="lg:col-span-8">
                        <Card className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden rounded-2xl">
                            <CardContent className="p-6 md:p-8 space-y-6">
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-bold text-slate-700">방명록 사용</Label>
                                        <p className="text-xs text-slate-500">참가자 동의 기반으로 방명록을 수집합니다. 기본 설정은 ON입니다.</p>
                                    </div>
                                    <Switch
                                        checked={data.features.guestbookEnabled}
                                        onChange={(e) => setData(prev => ({
                                            ...prev,
                                            features: { ...prev.features, guestbookEnabled: e.target.checked }
                                        }))}
                                        className="data-[state=checked]:bg-emerald-600"
                                    />
                                </div>

                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-bold text-slate-700">스탬프투어 사용</Label>
                                        <p className="text-xs text-slate-500">별도 서비스 기획이 준비된 경우에만 활성화하세요.</p>
                                    </div>
                                    <Switch
                                        checked={data.features.stampTourEnabled}
                                        onChange={(e) => setData(prev => ({
                                            ...prev,
                                            features: { ...prev.features, stampTourEnabled: e.target.checked }
                                        }))}
                                        className="data-[state=checked]:bg-indigo-600"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </section>

                <hr className="border-slate-100" />

                {data.features.stampTourEnabled && (
                    <>
                        {/* 2.8 Stamp Tour Settings */}
                        <section id="stamp-tour" className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                            <div className="lg:col-span-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                                        <Info className="w-6 h-6" />
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-800">스탬프투어 상세 설정</h2>
                                </div>
                                <p className="text-slate-500 leading-relaxed text-sm">
                                    디지털 명찰에 표시되는 스탬프투어 규칙과 보상 정책을 설정합니다.<br />
                                    완료 조건과 부스 순서, 상품 분배 규칙을 신중하게 확인하세요.
                                </p>
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="text-xs font-semibold text-slate-500 mb-1">종료 시각 (KST)</div>
                                    <div className="text-sm font-bold text-slate-800">{formatKstTimestamp(stampTourConfig.endAt)}</div>
                                </div>
                            </div>

                            <div className="lg:col-span-8 space-y-6">
                                <Card className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden rounded-2xl">
                                    <CardContent className="p-6 md:p-8 space-y-6">
                                        {/* Completion Rule */}
                                        <div className="space-y-2">
                                            <Label className="text-base font-medium text-slate-700">완료 조건</Label>
                                            <div className="flex items-center gap-4">
                                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                                    <input
                                                        type="radio"
                                                        name="completionRule"
                                                        checked={stampTourConfig.completionRule.type === 'COUNT'}
                                                        onChange={() => setStampTourConfig(prev => ({
                                                            ...prev,
                                                            completionRule: { ...prev.completionRule, type: 'COUNT' }
                                                        }))}
                                                    />
                                                    지정 개수 충족
                                                </label>
                                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                                    <input
                                                        type="radio"
                                                        name="completionRule"
                                                        checked={stampTourConfig.completionRule.type === 'ALL'}
                                                        onChange={() => setStampTourConfig(prev => ({
                                                            ...prev,
                                                            completionRule: { ...prev.completionRule, type: 'ALL' }
                                                        }))}
                                                    />
                                                    전체 부스 완료
                                                </label>
                                            </div>
                                            {stampTourConfig.completionRule.type === 'COUNT' && (
                                                <div className="mt-2 max-w-xs">
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        value={stampTourConfig.completionRule.requiredCount || 1}
                                                        onChange={(e) => setStampTourConfig(prev => ({
                                                            ...prev,
                                                            completionRule: {
                                                                ...prev.completionRule,
                                                                requiredCount: Math.max(1, Number(e.target.value || 1))
                                                            }
                                                        }))}
                                                    />
                                                    <p className="mt-2 text-xs text-slate-500">
                                                        참여 부스 {stampTourParticipantCount}개 기준으로 저장 시 최대 {Math.max(stampTourParticipantCount, 1)}개까지 맞춰집니다.
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Booth Order */}
                                        <div className="space-y-2">
                                            <Label className="text-base font-medium text-slate-700">부스 노출 순서</Label>
                                            <select
                                                value={stampTourConfig.boothOrderMode}
                                                onChange={(e) => setStampTourConfig(prev => ({
                                                    ...prev,
                                                    boothOrderMode: e.target.value as StampTourBoothOrderMode
                                                }))}
                                                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                            >
                                                <option value="SPONSOR_ORDER">스폰서 순서 사용</option>
                                                <option value="CUSTOM">직접 순서 지정</option>
                                            </select>

                                            {stampTourConfig.boothOrderMode === 'CUSTOM' && (
                                                <div className="mt-3 space-y-2">
                                                    {(() => {
                                                        const boothCandidates = sponsors
                                                            .filter(s => s.isStampTourParticipant)
                                                            .map(s => ({ id: s.vendorId || s.id, name: s.name }));
                                                        const ordered = stampTourConfig.customBoothOrder.length > 0
                                                            ? stampTourConfig.customBoothOrder
                                                                .map(id => boothCandidates.find(b => b.id === id))
                                                                .filter(Boolean) as { id: string; name: string }[]
                                                            : boothCandidates;

                                                        return ordered.map((booth, index) => (
                                                            <div key={booth.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                                                <div className="text-sm font-medium text-slate-700">{booth.name}</div>
                                                                <div className="flex items-center gap-2">
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            const list = [...ordered];
                                                                            if (index === 0) return;
                                                                            const tmp = list[index - 1];
                                                                            list[index - 1] = list[index];
                                                                            list[index] = tmp;
                                                                            setStampTourConfig(prev => ({
                                                                                ...prev,
                                                                                customBoothOrder: list.map(i => i.id)
                                                                            }));
                                                                        }}
                                                                    >
                                                                        <ArrowUp className="w-4 h-4" />
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            const list = [...ordered];
                                                                            if (index === list.length - 1) return;
                                                                            const tmp = list[index + 1];
                                                                            list[index + 1] = list[index];
                                                                            list[index] = tmp;
                                                                            setStampTourConfig(prev => ({
                                                                                ...prev,
                                                                                customBoothOrder: list.map(i => i.id)
                                                                            }));
                                                                        }}
                                                                    >
                                                                        <ArrowDown className="w-4 h-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                            )}
                                        </div>

                                        {/* Reward Mode */}
                                        <div className="space-y-2">
                                            <Label className="text-base font-medium text-slate-700">상품 분배 방식</Label>
                                            <select
                                                value={stampTourConfig.rewardMode}
                                                onChange={(e) => setStampTourConfig(prev => ({
                                                    ...prev,
                                                    rewardMode: e.target.value as StampTourRewardMode
                                                }))}
                                                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                            >
                                                <option value="RANDOM">랜덤 지급</option>
                                                <option value="FIXED">지정 순서 지급</option>
                                            </select>
                                            <p className="text-xs text-slate-500">
                                                랜덤은 남은 재고만 대상으로 가중치 추첨하며, 일반 상품 소진 시 대체용 상품만 남아 있으면 그 목록에서 이어서 지급됩니다.
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-base font-medium text-slate-700">추첨 진행 주체</Label>
                                            <select
                                                value={stampTourConfig.drawMode}
                                                onChange={(e) => setStampTourConfig(prev => ({
                                                    ...prev,
                                                    drawMode: e.target.value as StampTourDrawMode
                                                }))}
                                                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                            >
                                                <option value="PARTICIPANT">참가자 디지털명찰에서 추첨</option>
                                                <option value="ADMIN">관리자 화면에서만 추첨</option>
                                                <option value="BOTH">참가자/관리자 모두 가능</option>
                                            </select>
                                            <p className="text-xs text-slate-500">
                                                전광판이나 운영 화면에서 관리자가 직접 당첨을 확정하려면 관리자 또는 모두 가능으로 설정하세요.
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-base font-medium text-slate-700">보상 처리 기준</Label>
                                            <select
                                                value={stampTourConfig.rewardFulfillmentMode}
                                                onChange={(e) => setStampTourConfig(prev => ({
                                                    ...prev,
                                                    rewardFulfillmentMode: e.target.value as StampTourRewardFulfillmentMode
                                                }))}
                                                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                            >
                                                <option value="INSTANT">미션 완료 즉시 수령 가능</option>
                                                <option value="LOTTERY">관리자 지정 시각 일괄 추첨</option>
                                            </select>
                                            <p className="text-xs text-slate-500">
                                                즉시 수령형은 완료 즉시 보상 요청이 가능하고, 예약 추첨형은 마감 후 완료자 전체를 대상으로 한 번에 추첨합니다.
                                            </p>
                                        </div>

                                        {stampTourConfig.rewardFulfillmentMode === 'LOTTERY' && (
                                            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                                <Label className="text-base font-medium text-slate-700">예약 추첨 시각</Label>
                                                <Input
                                                    type="datetime-local"
                                                    value={stampTourConfig.lotteryScheduledAt ? (() => {
                                                        const d = stampTourConfig.lotteryScheduledAt.toDate();
                                                        const kstOffset = 9 * 60;
                                                        const localMs = d.getTime() + kstOffset * 60 * 1000;
                                                        const kstDate = new Date(localMs);
                                                        const year = kstDate.getUTCFullYear();
                                                        const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
                                                        const day = String(kstDate.getUTCDate()).padStart(2, '0');
                                                        const hours = String(kstDate.getUTCHours()).padStart(2, '0');
                                                        const minutes = String(kstDate.getUTCMinutes()).padStart(2, '0');
                                                        return `${year}-${month}-${day}T${hours}:${minutes}`;
                                                    })() : ''}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        if (!value) {
                                                            setStampTourConfig(prev => ({ ...prev, lotteryScheduledAt: undefined }));
                                                            return;
                                                        }
                                                        const [datePart, timePart] = value.split('T');
                                                        const [year, month, day] = datePart.split('-').map(Number);
                                                        const [hour, minute] = (timePart || '00:00').split(':').map(Number);
                                                        const scheduled = new Date(Date.UTC(year, month - 1, day, hour - 9, minute, 0, 0));
                                                        setStampTourConfig(prev => ({ ...prev, lotteryScheduledAt: Timestamp.fromDate(scheduled) }));
                                                    }}
                                                />
                                                <p className="text-xs text-slate-500">
                                                    이 시각 전에는 누구도 추첨할 수 없고, 시각이 지나면 관리자만 전체 완료자를 대상으로 일괄 추첨할 수 있습니다.
                                                </p>
                                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-3 py-3 ring-1 ring-slate-200">
                                                    <div className="text-sm text-slate-600">
                                                        관리자 추첨 전용 화면에서 단수 추첨, 복수 추첨, 전체 추첨, 데모 리허설을 실행할 수 있습니다.
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => void handleRunLottery()}
                                                    >
                                                        관리자 추첨 화면 바로가기
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Rewards */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-base font-medium text-slate-700">상품 목록</Label>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        const newReward: StampTourRewardForm = {
                                                            id: `reward_${Date.now()}`,
                                                            name: '',
                                                            totalQty: 0,
                                                            remainingQty: 0,
                                                            weight: stampTourConfig.rewardMode === 'RANDOM' ? 1 : undefined,
                                                            order: stampTourConfig.rewardMode === 'FIXED' ? (stampTourConfig.rewards.length + 1) : undefined
                                                        };
                                                        setStampTourConfig(prev => ({
                                                            ...prev,
                                                            rewards: [...prev.rewards, newReward]
                                                        }));
                                                    }}
                                                >
                                                    상품 추가
                                                </Button>
                                            </div>

                                            {stampTourConfig.rewards.length === 0 ? (
                                                <div className="text-sm text-slate-400">등록된 상품이 없습니다.</div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {stampTourConfig.rewards.map((reward, idx) => (
                                                        <div key={reward.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
                                                            <div className="grid grid-cols-1 gap-3 text-xs font-semibold text-slate-500 md:grid-cols-3">
                                                                <div>상품명</div>
                                                                <div>총 수량: 처음 준비한 전체 개수</div>
                                                                <div>현재 남은 수량: 지금 추첨 가능한 개수</div>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                                <Input
                                                                    value={reward.name}
                                                                    onChange={(e) => {
                                                                        const value = e.target.value;
                                                                        setStampTourConfig(prev => ({
                                                                            ...prev,
                                                                            rewards: prev.rewards.map((r, i) => i === idx ? { ...r, name: value } : r)
                                                                        }));
                                                                    }}
                                                                    placeholder="상품명"
                                                                />
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    value={reward.totalQty}
                                                                    onChange={(e) => {
                                                                        const value = Number(e.target.value || 0);
                                                                        setStampTourConfig(prev => ({
                                                                            ...prev,
                                                                            rewards: prev.rewards.map((r, i) => i === idx ? {
                                                                                ...r,
                                                                                totalQty: value,
                                                                                remainingQty: r.remainingQty > 0 ? r.remainingQty : value
                                                                            } : r)
                                                                        }));
                                                                    }}
                                                                    placeholder="수량"
                                                                />
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    value={reward.remainingQty}
                                                                    onChange={(e) => {
                                                                        const value = Number(e.target.value || 0);
                                                                        setStampTourConfig(prev => ({
                                                                            ...prev,
                                                                            rewards: prev.rewards.map((r, i) => i === idx ? { ...r, remainingQty: value } : r)
                                                                        }));
                                                                    }}
                                                                    placeholder="잔여 수량"
                                                                />
                                                            </div>

                                                            <p className="text-xs text-slate-500">
                                                                왼쪽 숫자는 총 수량, 오른쪽 숫자는 현재 남은 수량입니다.
                                                                이미 일부를 지급했다면 오른쪽 현재 남은 수량만 실제 재고에 맞게 조정해 주세요.
                                                            </p>

                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                                <Input
                                                                    value={reward.imageUrl || ''}
                                                                    onChange={(e) => {
                                                                        const value = e.target.value;
                                                                        setStampTourConfig(prev => ({
                                                                            ...prev,
                                                                            rewards: prev.rewards.map((r, i) => i === idx ? { ...r, imageUrl: value } : r)
                                                                        }));
                                                                    }}
                                                                    placeholder="이미지 URL (선택)"
                                                                />
                                                                {stampTourConfig.rewardMode === 'RANDOM' ? (
                                                                    <Input
                                                                        type="number"
                                                                        min="1"
                                                                        value={reward.weight || 1}
                                                                        onChange={(e) => {
                                                                            const value = Number(e.target.value || 1);
                                                                            setStampTourConfig(prev => ({
                                                                                ...prev,
                                                                                rewards: prev.rewards.map((r, i) => i === idx ? { ...r, weight: value } : r)
                                                                            }));
                                                                        }}
                                                                        placeholder="가중치"
                                                                    />
                                                                ) : (
                                                                    <Input
                                                                        type="number"
                                                                        min="1"
                                                                        value={reward.order || idx + 1}
                                                                        onChange={(e) => {
                                                                            const value = Number(e.target.value || 1);
                                                                            setStampTourConfig(prev => ({
                                                                                ...prev,
                                                                                rewards: prev.rewards.map((r, i) => i === idx ? { ...r, order: value } : r)
                                                                            }));
                                                                        }}
                                                                        placeholder="지급 순서"
                                                                    />
                                                                )}
                                                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={reward.isFallback || false}
                                                                        onChange={(e) => {
                                                                            const value = e.target.checked;
                                                                            setStampTourConfig(prev => ({
                                                                                ...prev,
                                                                                rewards: prev.rewards.map((r, i) => i === idx ? { ...r, isFallback: value } : r)
                                                                            }));
                                                                        }}
                                                                    />
                                                                    소진 대체용
                                                                </label>
                                                            </div>

                                                            <div className="flex justify-end">
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setStampTourConfig(prev => ({
                                                                            ...prev,
                                                                            rewards: prev.rewards.filter((_, i) => i !== idx)
                                                                        }));
                                                                    }}
                                                                >
                                                                    삭제
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Messages */}
                                        <div className="space-y-3">
                                            <Label className="text-base font-medium text-slate-700">완료 메시지</Label>
                                            <Input
                                                value={stampTourConfig.completionMessage}
                                                onChange={(e) => setStampTourConfig(prev => ({ ...prev, completionMessage: e.target.value }))}
                                                placeholder="완료 시 노출 메시지"
                                            />
                                            <Label className="text-base font-medium text-slate-700">소진 메시지</Label>
                                            <Input
                                                value={stampTourConfig.soldOutMessage}
                                                onChange={(e) => setStampTourConfig(prev => ({ ...prev, soldOutMessage: e.target.value }))}
                                                placeholder="소진 시 노출 메시지"
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Live Status */}
                                <Card className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden rounded-2xl">
                                    <CardContent className="p-6 md:p-8 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-bold text-slate-800">실시간 진행 현황</h3>
                                            <div className="text-xs text-slate-500 font-semibold">
                                                완료 {stampTourProgress.filter(p => p.isCompleted).length}건
                                            </div>
                                        </div>

                                        {stampTourConfig.rewardFulfillmentMode === 'LOTTERY' && (
                                            <div className="flex justify-end">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={() => void handleRunLottery()}
                                                >
                                                    추첨 전용 화면 열기
                                                </Button>
                                            </div>
                                        )}

                                        {stampTourProgress.length === 0 ? (
                                            <div className="text-sm text-slate-400">진행 데이터가 없습니다.</div>
                                        ) : (
                                            <div className="space-y-2">
                                                {stampTourProgress.map((row) => (
                                                    <div key={row.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2">
                                                        <div className="text-sm">
                                                            <div className="font-semibold text-slate-700">{row.userName || row.userId}</div>
                                                            <div className="text-xs text-slate-500">{row.userOrg || '-'}</div>
                                                            <div className="text-xs text-slate-500">{row.rewardName || '상품 미정'}</div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${(row.rewardStatus || 'NONE') === 'REDEEMED' ? 'bg-emerald-100 text-emerald-700' : (row.rewardStatus || 'NONE') === 'REQUESTED' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                                                {row.rewardStatus || 'NONE'}
                                                            </span>
                                                            {stampTourConfig.rewardFulfillmentMode === 'INSTANT' && (!row.rewardStatus || row.rewardStatus === 'NONE') && row.isCompleted && (stampTourConfig.drawMode === 'ADMIN' || stampTourConfig.drawMode === 'BOTH') && (
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    onClick={() => void handleAdminRewardDraw(row)}
                                                                    disabled={drawingUserId === row.id}
                                                                >
                                                                    {drawingUserId === row.id ? '추첨 중...' : '관리자 추첨'}
                                                                </Button>
                                                            )}
                                                            {(row.rewardStatus || 'NONE') === 'REQUESTED' && (
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    onClick={async () => {
                                                                        if (!cid) return;
                                                                        await updateDoc(doc(db, `conferences/${cid}/stamp_tour_progress/${row.id}`), {
                                                                            rewardStatus: 'REDEEMED',
                                                                            redeemedAt: Timestamp.now()
                                                                        });
                                                                    }}
                                                                >
                                                                    수령 완료
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </section>

                        <hr className="border-slate-100" />
                    </>
                )}

                {/* 2. Venue Info Section */}
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                    <div className="lg:col-span-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="p-2.5 bg-red-50 rounded-xl text-red-600">
                                <MapPin className="w-6 h-6" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800">장소 정보</h2>
                        </div>
                        <p className="text-slate-500 leading-relaxed text-sm">
                            오프라인 행사가 개최되는 장소 정보를 입력합니다. <br />
                            지도 링크는 네이버 지도나 구글 맵의 공유 링크를 사용하는 것이 좋습니다.
                        </p>
                    </div>

                    <div className="lg:col-span-8">
                        <Card className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden rounded-2xl">
                            <CardContent className="p-6 md:p-8 space-y-8">
                                <BilingualInput
                                    label="장소명 (Venue Name)"
                                    valueKO={data.venue.name.ko}
                                    valueEN={data.venue.name.en}
                                    onChangeKO={(value) => setData(prev => ({
                                        ...prev,
                                        venue: { ...prev.venue, name: { ...prev.venue.name, ko: value } }
                                    }))}
                                    onChangeEN={(value) => setData(prev => ({
                                        ...prev,
                                        venue: { ...prev.venue, name: { ...prev.venue.name, en: value } }
                                    }))}
                                    placeholderKO="예: 코엑스 그랜드볼룸"
                                    placeholderEN="e.g. COEX Grand Ballroom"
                                    required
                                />

                                <BilingualInput
                                    label="전체 주소 (Address)"
                                    valueKO={data.venue.address.ko}
                                    valueEN={data.venue.address.en}
                                    onChangeKO={(value) => setData(prev => ({
                                        ...prev,
                                        venue: { ...prev.venue, address: { ...prev.venue.address, ko: value } }
                                    }))}
                                    onChangeEN={(value) => setData(prev => ({
                                        ...prev,
                                        venue: { ...prev.venue, address: { ...prev.venue.address, en: value } }
                                    }))}
                                    placeholderKO="예: 서울특별시 강남구 영동대로 513"
                                    placeholderEN="Full Address"
                                    required
                                />

                                <div className="space-y-3">
                                    <Label className="text-base font-medium text-slate-700">지도 링크 URL</Label>
                                    <div className="relative">
                                        <Globe className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                        <Input
                                            value={data.venue.mapUrl}
                                            onChange={(e) => setData(prev => ({ ...prev, venue: { ...prev.venue, mapUrl: e.target.value } }))}
                                            placeholder="https://map.naver.com/..."
                                            className="pl-10 h-11 border-slate-200 rounded-lg"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500 ml-1">
                                        * 참석자들이 쉽게 찾아올 수 있도록 정확한 지도 URL을 입력해주세요.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-base font-medium text-slate-700">구글 지도 임베드 URL (Google Map Embed URL)</Label>
                                    <div className="relative">
                                        <Globe className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                        <Input
                                            value={data.venue.googleMapEmbedUrl || ''}
                                            onChange={(e) => setData(prev => ({ ...prev, venue: { ...prev.venue, googleMapEmbedUrl: e.target.value } }))}
                                            placeholder="https://www.google.com/maps/embed?..."
                                            className="pl-10 h-11 border-slate-200 rounded-lg"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500 ml-1">
                                        * 지도 공유 -&gt; 지도 퍼가기에서 복사한 HTML의 src 속성값만 입력하세요. (선택사항)
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </section>

                <hr className="border-slate-100" />

                {/* 3. Visual Assets Section */}
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                    <div className="lg:col-span-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="p-2.5 bg-purple-50 rounded-xl text-purple-600">
                                <ImageIcon className="w-6 h-6" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800">시각 자료</h2>
                        </div>
                        <p className="text-slate-500 leading-relaxed text-sm">
                            행사를 대표하는 배너와 포스터 이미지를 업로드합니다.<br />
                            국문과 영문 페이지에 각각 다른 이미지를 설정할 수 있습니다.
                        </p>
                        <div className="mt-4 p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                            <h4 className="font-semibold text-purple-900 text-sm mb-2">💡 권장 사이즈</h4>
                            <ul className="text-xs text-purple-800 space-y-1.5 list-disc list-inside">
                                <li>메인 배너: 1920 x 600 px</li>
                                <li>포스터: 세로형 또는 정사각형 (A4 비율 권장)</li>
                                <li>파일 형식: JPG, PNG (최대 5MB)</li>
                            </ul>
                        </div>
                    </div>

                    <div className="lg:col-span-8">
                        <Card className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden rounded-2xl">
                            <CardContent className="p-6 md:p-8 space-y-10">
                                <BilingualImageUpload
                                    label="메인 배너 (Main Banner)"
                                    valueKO={data.visualAssets.banner.ko}
                                    valueEN={data.visualAssets.banner.en}
                                    onChangeKO={(url) => setData(prev => ({
                                        ...prev,
                                        visualAssets: { ...prev.visualAssets, banner: { ...prev.visualAssets.banner, ko: url } }
                                    }))}
                                    onChangeEN={(url) => setData(prev => ({
                                        ...prev,
                                        visualAssets: { ...prev.visualAssets, banner: { ...prev.visualAssets.banner, en: url } }
                                    }))}
                                    pathBaseKO={`conferences/${cid}/banner_ko`}
                                    pathBaseEN={`conferences/${cid}/banner_en`}
                                    recommendedSize="1920x600 px 권장"
                                    labelKO="🇰🇷 국문 배너"
                                    labelEN="🇺🇸 영문 배너"
                                />

                                <div className="border-t border-slate-100" />

                                <BilingualImageUpload
                                    label="포스터 / 썸네일 (Poster)"
                                    valueKO={data.visualAssets.poster.ko}
                                    valueEN={data.visualAssets.poster.en}
                                    onChangeKO={(url) => setData(prev => ({
                                        ...prev,
                                        visualAssets: { ...prev.visualAssets, poster: { ...prev.visualAssets.poster, ko: url } }
                                    }))}
                                    onChangeEN={(url) => setData(prev => ({
                                        ...prev,
                                        visualAssets: { ...prev.visualAssets, poster: { ...prev.visualAssets.poster, en: url } }
                                    }))}
                                    pathBaseKO={`conferences/${cid}/poster_ko`}
                                    pathBaseEN={`conferences/${cid}/poster_en`}
                                    recommendedSize="세로형 이미지 권장 (A4)"
                                    labelKO="🇰🇷 국문 포스터"
                                    labelEN="🇺🇸 영문 포스터"
                                />
                            </CardContent>
                        </Card>
                    </div>
                </section>

                <hr className="border-slate-100" />

                {/* 4. Welcome Message Section */}
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                    <div className="lg:col-span-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="p-2.5 bg-green-50 rounded-xl text-green-600">
                                <FileText className="w-6 h-6" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800">환영 메시지</h2>
                        </div>
                        <p className="text-slate-500 leading-relaxed text-sm">
                            학술대회 조직위원장 또는 회장의 인사말을 입력합니다.<br />
                            HTML 편집과 이미지 추가를 지원합니다.
                        </p>
                    </div>

                    <div className="lg:col-span-8 space-y-6">
                        <Card className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden rounded-2xl">
                            <CardContent className="p-6 md:p-8 space-y-8">
                                {/* Korean Editor */}
                                <div>
                                    <Label className="text-base font-medium text-slate-700 mb-2 block">
                                        🇰🇷 한국어 / Korean
                                    </Label>
                                    <RichTextEditor
                                        value={data.welcomeMessage.ko}
                                        onChange={(value) => setData(prev => ({
                                            ...prev,
                                            welcomeMessage: { ...prev.welcomeMessage, ko: value }
                                        }))}
                                        placeholder="예: 존경하는 회원 여러분, 안녕하십니까..."
                                    />
                                </div>

                                {/* English Editor */}
                                <div>
                                    <Label className="text-base font-medium text-slate-700 mb-2 block">
                                        🇺🇸 English
                                    </Label>
                                    <RichTextEditor
                                        value={data.welcomeMessage.en}
                                        onChange={(value) => setData(prev => ({
                                            ...prev,
                                            welcomeMessage: { ...prev.welcomeMessage, en: value }
                                        }))}
                                        placeholder="e.g. Dear Colleagues and Friends..."
                                    />
                                </div>

                                {/* Image Upload */}
                                <div>
                                    <Label className="text-base font-medium text-slate-700 mb-2 flex items-center gap-2">
                                        <ImageIcon size={18} />
                                        이미지 추가 / Add Images
                                    </Label>
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition">
                                            <ImageIcon size={18} />
                                            <span className="text-sm font-bold text-slate-700">
                                                {uploadingImage ? '업로드 중 / Uploading...' : '이미지 선택 / Choose Image'}
                                            </span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleAddImage}
                                                className="hidden"
                                                disabled={uploadingImage}
                                            />
                                        </label>
                                        <span className="text-xs text-slate-500">
                                            JPG, PNG (최대 5MB)
                                        </span>
                                    </div>

                                    {/* Image Preview */}
                                    {data.welcomeMessageImages && data.welcomeMessageImages.length > 0 && (
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                            {data.welcomeMessageImages.map((url, index) => (
                                                <div key={index} className="relative group">
                                                    <img
                                                        src={url}
                                                        alt={`Welcome ${index + 1}`}
                                                        className="w-full h-32 object-cover rounded-lg border border-slate-200"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveImage(index)}
                                                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </section>

            </div>
        </div>
    );
}
