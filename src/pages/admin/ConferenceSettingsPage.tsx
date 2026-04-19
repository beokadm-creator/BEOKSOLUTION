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
import {
    StampTourConfigForm,
    StampTourProgressRow,
    defaultStampTourConfig,
    StampTourSettingsPanel
} from '../../components/admin/conference/StampTourSettingsPanel';
import { GeneralSettingsForm } from '../../components/admin/conference/GeneralSettingsForm';
import { VisualAssetsForm } from '../../components/admin/conference/VisualAssetsForm';

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
                            // Firestore Timestamp ??KST ??????? datetime-local ?????????????????怨뺤른????
                            const d = (ts as { toDate: () => Date }).toDate();
                            // KST(Asia/Seoul, UTC+9) ????????????????????怨뺤른????
                            const kstOffset = 9 * 60; // ?????????怨뺤꽑?
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
                            // ???????癒꺜??????????????????????'YYYY-MM-DD')?? 00:00??????????????쇰뮛?????
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
    const selectableLotteryRewards = getSelectableStampTourRewards(
        stampTourConfig.rewards,
        { excludeCompletedDraws: true }
    );

    const handleSave = async () => {
        if (!cid) return;
        setSaving(true);
        try {
            if (data.features.stampTourEnabled && stampTourParticipantCount === 0) {
                toast.error('스탬프 투어에 참여 부스가 먼저 1개 이상 등록되어야 합니다.');
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
                toast.error('추첨 예정인 경우 추첨 예정 시각을 반드시 지정해야 합니다.');
                return;
            }

            const docRef = doc(db, 'conferences', cid);

            // Parse datetime-local value (e.g., "2026-05-10T09:00") as KST and convert to UTC Timestamp.
            // new Date("2026-05-10T09:00") is interpreted in the browser's local timezone (usually KST),
            // so we manually subtract 9 hours to ensure consistent UTC conversion.
            const parseDatetimeLocal = (dtStr: string): Date => {
                // Split the datetime-local string and reconstruct as UTC
                // by subtracting 9 hours from KST (UTC+9) to get UTC.
                // "2026-05-10T09:00" -> UTC 2026-05-10T00:00:00Z
                const [datePart, timePart] = dtStr.split('T');
                const [year, month, day] = datePart.split('-').map(Number);
                const [hour, minute] = (timePart || '00:00').split(':').map(Number);
                // KST = UTC+9, subtract 9 hours to convert to UTC
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
                toast.success(`완료 조건의 필수 스탬프 수가 참여자 수에 맞춰 ${normalizedRequiredStampCount}개로 보정되었습니다.`);
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
                    ? `${row.userName || row.id} ??????袁④뎬?????????꾩룆梨띰쭕?? ${payload.rewardName}`
                    : `${row.userName || row.id} ??????袁④뎬??????????꾩룆梨띰쭕???????????`
            );
        } catch (error) {
            console.error('Admin reward draw failed:', error);
            toast.error(error instanceof Error ? error.message : '??????⑤㈇????????좊틣??????????袁④뎬?????遺얘턁????傭?끆???嶺뚮?猷볠꽴???????????쇰뮝??????????????怨몄）.');
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
            toast.success('??????遺얘턁???????????ル뭽?? ??????袁④뎬????????????/ Image added');
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
                    <p className="text-slate-500 font-medium">??????⑤㈇????????좊틣???欲꼲???듯렡???????롮쾸???????????븍툖???紐꽺?? ????鶯ㅺ동??????????轝꿸섣?????耀붾굝???????</p>
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
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Conference settings</h1>
                        <p className="text-sm text-slate-500 font-medium mt-0.5">Basic conference information and visual settings</p>
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
                                설정 저장
                            </>
                        )}
                    </Button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-10 space-y-12">
                <GeneralSettingsForm data={data} setData={setData} />
                <hr className="border-slate-100" />
                
                {data.features.stampTourEnabled && (
                    <>
                        <StampTourSettingsPanel
                            cid={cid || ''}
                            stampTourConfig={stampTourConfig}
                            setStampTourConfig={setStampTourConfig}
                            sponsors={sponsors}
                            stampTourProgress={stampTourProgress}
                            formatKstTimestamp={formatKstTimestamp}
                            stampTourParticipantCount={stampTourParticipantCount}
                            normalizedRequiredStampCount={normalizedRequiredStampCount}
                            selectableLotteryRewards={selectableLotteryRewards}
                            handleSaveStampTour={handleSaveStampTour}
                            isSavingStampTour={isSavingStampTour}
                            handleResetLottery={handleResetLottery}
                            isResettingLottery={isResettingLottery}
                        />
                        <hr className="border-slate-100" />
                    </>
                )}
                
                <VisualAssetsForm
                    cid={cid || ''}
                    data={data}
                    setData={setData}
                    uploadingImage={uploadingImage}
                    handleAddImage={handleAddImage}
                    handleRemoveImage={handleRemoveImage}
                />
            </div>
        </div>
    );
}
