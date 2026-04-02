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
    getSelectableStampTourRewards,
    getStampMissionTargetCount,
    getStampTourRewardTitle,
    hasValidStampTourRewards,
    isStampTourRewardDrawCompleted,
    normalizeStampTourRewards
} from '../../utils/stampTour';

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
    label?: string;
    imageUrl?: string;
    totalQty: number;
    remainingQty: number;
    weight?: number;
    order?: number;
    isFallback?: boolean;
    drawCompletedAt?: Timestamp;
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
    rewardLabel?: string;
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
    soldOutMessage: '???????癒꺜?꿔꺂??씙??????黎앸럽??筌???????遺얘턁?????????遺얜??????????????????',
    completionMessage: '??????熬곻퐢夷????????????됬뙴???용봾留???????꾩룆梨띰쭕??????????????怨몄）. ??????怨쀫뮝嶺? ???????????????????黎앸럽?녷④낮釉???????'
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
                toast.error('??????熬곻퐢夷??????????遺얘턁???????????????됱삩????? ?????븍툖???紐꽺?? 1????????????????ㅻ깹??????????諛몄カ?????????');
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
                toast.error('?????怨뺤른????녾낮?녔틦??????? ?????? ???饔낅떽????鶯ㅺ동???볥궚????????ル뭽???????熬곣벀嫄?????꾤뙴?????????????????????????耀붾굝?????????????????諛몄カ?????????');
                return;
            }

            if (
                data.features.stampTourEnabled &&
                stampTourConfig.rewardFulfillmentMode === 'LOTTERY' &&
                !stampTourConfig.lotteryScheduledAt
            ) {
                toast.error('???????숈?????????袁④뎬????? ??????袁④뎬???????關?쒎첎?嫄???????????????諛몃마嶺뚮?????????????遺얘턁???????耀붾굝???????????????饔낅떽???????');
                return;
            }

            const docRef = doc(db, 'conferences', cid);

            // datetime-local ???? "2026-05-10T09:00")??KST ??????? UTC Timestamp???????怨뺤른????
            // new Date("2026-05-10T09:00")?????????????????????繹먮냱???KST) ?????????????????????
            // ?? ????????????????????ル뭽?? ????????뉖??????????繹먮냱????????關?쒎첎?嫄?????黎앸럽??筌????????????????????遺얘턁?????꿔꺂?????諛ㅻ?????????대첐?饔낅떽???嶺뚮슢??쾮??KST ?????????????????대첐??
            const parseDatetimeLocal = (dtStr: string): Date => {
                // datetime-local ??????ル뭽??? ????????繹먮냱?????耀붾굝?????????????????살몖????KST(UTC+9)????遺얘턁?????꿔꺂?????諛ㅻ????遺얘턁????傭?끆???嶺뚮?猷볠꽴??
                // "2026-05-10T09:00" ??UTC 2026-05-10T00:00:00Z ???????怨뺤른????
                const [datePart, timePart] = dtStr.split('T');
                const [year, month, day] = datePart.split('-').map(Number);
                const [hour, minute] = (timePart || '00:00').split(':').map(Number);
                // KST = UTC+9, ??UTC???????怨뺤른????????????9??????????????깅즽??
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
                toast.success(`??????꾩룆梨띰쭕?????????????遺얘턁???????????????됱삩???????饔낅떽??????雅???遺얘턁???????${normalizedRequiredStampCount}??????ル뭽??雅?퍔瑗?땟戮щ쐩??潁???????怨뺤른????????????????怨몄）.`);
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
            toast.error('??????遺얘턁????? ???????????????쇰뮝??/ Image upload failed');
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
                                ??????..
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                ?????怨뺤른????黎앸럽??筌????????????
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
                            <h2 className="text-xl font-bold text-slate-800">Basic info</h2>
                        </div>
                        <p className="text-slate-500 leading-relaxed text-sm">
                            ??????롮쾸?????????????ㅿ폎?????遺얘턁?????꿔꺂?????諛ㅻ????筌뤾퍗猷? ??遺얘턁???????꿔꺂???????????????怨멸텛?? ??????ル뵁??????癲?????????袁ⓦ걤???꾩룆梨?????????살몖??????關?쒎첎?嫄?????饔낅떽???????<br />
                            ????耀붾굝????????????????롮쾸????????耀붾굝????????????濡?씀?濾??μ떜媛??????????????????ル뭽?????????熬곣벀嫄?????꾤뙴??????????????????????????怨몄）.
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
                                    label="??????????????????饔낅떽??????猷고ｇ땟???(Title)"
                                    valueKO={data.title.ko}
                                    valueEN={data.title.en}
                                    onChangeKO={(value) => setData(prev => ({ ...prev, title: { ...prev.title, ko: value } }))}
                                    onChangeEN={(value) => setData(prev => ({ ...prev, title: { ...prev.title, en: value } }))}
                                    placeholderKO="e.g. 2026 Spring Conference"
                                    placeholderEN="e.g. The 35th Spring Conference"
                                    required
                                />

                                <div className="space-y-3">
                                    <Label className="text-base font-medium text-slate-700">??????됱삩????/ ???????袁ⓦ걤???꾩룆梨???(Subtitle)</Label>
                                    <Input
                                        value={data.subtitle || ''}
                                        onChange={(e) => setData(prev => ({ ...prev, subtitle: e.target.value }))}
                                        placeholder="?? Innovating the Future of Medicine"
                                        className="h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg text-base"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <Label className="text-base font-medium text-slate-700">???饔낅떽????鶯ㅺ동???嫄???????롮쾸?椰???⑤８理귡땡?(Start Date & Time)</Label>
                                        <Input
                                            type="datetime-local"
                                            value={data.dates.start}
                                            onChange={(e) => setData(prev => ({ ...prev, dates: { ...prev.dates, start: e.target.value } }))}
                                            className="h-11 border-slate-200 rounded-lg"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <Label className="text-base font-medium text-slate-700">????????깅뼂????????롮쾸?椰???⑤８理귡땡?(End Date & Time)</Label>
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
                            <h2 className="text-xl font-bold text-slate-800">Abstract deadlines</h2>
                        </div>
                        <p className="text-slate-500 leading-relaxed text-sm">
                            ????????怨뚮뼺?怨뺥닠??????????????怨뚮뼺?됰뗀?????????????怨멸텛???????關?쒎첎?嫄?????饔낅떽???????<br />
                            ??????????怨멸텛?????遺얘턁???????????????????????????怨뚮뼺?怨뺥닠?????饔낅떽???????????????????怨뚮뼺?됰뗀????????????繹먮굞??????????怨몄）.
                        </p>
                    </div>

                    <div className="lg:col-span-8">
                        <Card className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden rounded-2xl">
                            <CardContent className="p-6 md:p-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <Label className="text-base font-medium text-slate-700">?????壤굿?????????????遺얘턁????????筌뤾퍓?????????롮쾸?椰???⑤８理귡땡?(Submission Deadline)</Label>
                                        <Input
                                            type="datetime-local"
                                            value={data.abstractDeadlines.submissionDeadline || ''}
                                            onChange={(e) => setData(prev => ({ ...prev, abstractDeadlines: { ...prev.abstractDeadlines, submissionDeadline: e.target.value } }))}
                                            className="h-11 border-slate-200 rounded-lg"
                                        />
                                        <p className="text-xs text-slate-400 mt-1">
                                            ???????????ㅿ폎???ш끽維뽳쭩??? ???????????????怨뚮뼺?怨뺥닠?????饔낅떽??????????????????????怨몄）.
                                        </p>
                                    </div>
                                    <div className="space-y-3">
                                        <Label className="text-base font-medium text-slate-700">?????怨뚮뼺?됰뗀?????遺얘턁????????筌뤾퍓?????????롮쾸?椰???⑤８理귡땡?(Edit Deadline)</Label>
                                        <Input
                                            type="datetime-local"
                                            value={data.abstractDeadlines.editDeadline || ''}
                                            onChange={(e) => setData(prev => ({ ...prev, abstractDeadlines: { ...prev.abstractDeadlines, editDeadline: e.target.value } }))}
                                            className="h-11 border-slate-200 rounded-lg"
                                        />
                                        <p className="text-xs text-slate-400 mt-1">
                                            ???????????ㅿ폎???ш끽維뽳쭩??? ????????????????怨뚮뼺?怨뺥닠???????怨뚮뼺?됰뗀???????????????????怨몄）.
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
                            <h2 className="text-xl font-bold text-slate-800">Feature toggles</h2>
                        </div>
                        <p className="text-slate-500 leading-relaxed text-sm">
                            ?????????놁졁???????????????諛몃마??潁뺛깺苡????꿔꺂????용끏???熬곣뫖利당춯???????猷멥럸?????????熬곻퐢夷???????????▲뀋????????????????關?쒎첎?嫄?????饔낅떽???????<br />
                            ?????諛몃마??潁뺛깺苡????꿔꺂????용끏???熬곣뫖利당춯????? ????????????關?쒎첎?嫄??????? ??????熬곻퐢夷???????????▲뀋???????????怨뺤른????????????????遺얘턁?????????????꾩룆梨띰쭕?????????????????????????怨몄）.
                        </p>
                    </div>

                    <div className="lg:col-span-8">
                        <Card className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden rounded-2xl">
                            <CardContent className="p-6 md:p-8 space-y-6">
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-bold text-slate-700">Guestbook enabled</Label>
                                        <p className="text-xs text-slate-500">??遺얘턁???????ㅼ뒧??????????????곕??? ??????????????????????????諛몃마??潁뺛깺苡????꿔꺂????용끏???熬곣뫖利당춯??????????????怨뚮뼺?됰뗀?????饔낅떽??????? ????????????關?쒎첎?嫄???? ON??????嶺?罹??</p>
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
                                        <Label className="text-sm font-bold text-slate-700">Stamp tour enabled</Label>
                                        <p className="text-xs text-slate-500">?????怨뺤른????????饔낅떽?????????筌????????????????熬곣벀嫄?癲ル슣?????????????????黎앸럽??筌?????????????????????耀붾굝???????</p>
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
                                    <h2 className="text-xl font-bold text-slate-800">Stamp tour settings</h2>
                                </div>
                                <p className="text-slate-500 leading-relaxed text-sm">
                                    ???????遺얘턁?????꿔꺂?????諛ㅻ????紐꾨였????????????癲됱빖?????猷몃룯??????????熬곻퐢夷???????????▲뀋????????????猷고????????怨뺤른????녾낮?녔틦????耀붾굝?????????????關?쒎첎?嫄?????饔낅떽???????<br />
                                    ??????꾩룆梨띰쭕???????Β??????????????????됱삩?????????? ??????怨쀫뮝嶺? ?????????щ쫫???????????????????癒꺜?????????곕춴????耀붾굝????????????饔낅떽???壤굿??곸읆???
                                </p>
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="text-xs font-semibold text-slate-500 mb-1">????????깅뼂????????(KST)</div>
                                    <div className="text-sm font-bold text-slate-800">{formatKstTimestamp(stampTourConfig.endAt)}</div>
                                </div>
                            </div>

                            <div className="lg:col-span-8 space-y-6">
                                <Card className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden rounded-2xl">
                                    <CardContent className="p-6 md:p-8 space-y-6">
                                        {/* Completion Rule */}
                                        <div className="space-y-2">
                                            <Label className="text-base font-medium text-slate-700">Completion rule</Label>
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
                                                    ??遺얘턁?????????????ル뭽???????棺堉?뤃??믡굦??????
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
                                                    ??????꾩룆梨띰쭕????????됱삩??????????꾩룆梨띰쭕??
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
                                                        ??遺얘턁???????????????됱삩????{stampTourParticipantCount}?????????????????????????遺얘턁??????傭? {Math.max(stampTourParticipantCount, 1)}??????ル뭽??????? ??遺얘턁???????????????????
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Booth Order */}
                                        <div className="space-y-2">
                                            <Label className="text-base font-medium text-slate-700">Booth display order</Label>
                                            <select
                                                value={stampTourConfig.boothOrderMode}
                                                onChange={(e) => setStampTourConfig(prev => ({
                                                    ...prev,
                                                    boothOrderMode: e.target.value as StampTourBoothOrderMode
                                                }))}
                                                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                            >
                                                <option value="SPONSOR_ORDER">Use sponsor order</option>
                                                <option value="CUSTOM">Use custom order</option>
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
                                            <Label className="text-base font-medium text-slate-700">Reward distribution mode</Label>
                                            <select
                                                value={stampTourConfig.rewardMode}
                                                onChange={(e) => setStampTourConfig(prev => ({
                                                    ...prev,
                                                    rewardMode: e.target.value as StampTourRewardMode
                                                }))}
                                                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                            >
                                                <option value="RANDOM">Random draw</option>
                                                <option value="FIXED">Fixed order</option>
                                            </select>
                                            <p className="text-xs text-slate-500">
                                                ???饔낅떽????鶯ㅺ동???볥궚??? ??? ????????????????대첐?饔낅떽???嶺뚮슢??쾮????????ル뭽???????熬곣벀嫄?????꾤뙴?????????袁④뎬?????? ????????????????怨쀫뮝嶺? ???????????遺얘턁?????????????怨쀫뮝嶺????????????關?쒎첎?嫄?濡ろ뜇?遺븍뙕???????遺얘턁?????????遺얜??熬곣뫖釉멧벧猿뗪섭鴉?????????????繹먮굞??????遺얘턁??????????援쏂굜???饔낅떽?????????誘⑦?????????怨몄）.
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-base font-medium text-slate-700">Who can run the draw</Label>
                                            <select
                                                value={stampTourConfig.drawMode}
                                                onChange={(e) => setStampTourConfig(prev => ({
                                                    ...prev,
                                                    drawMode: e.target.value as StampTourDrawMode
                                                }))}
                                                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                            >
                                                <option value="PARTICIPANT">Participant device only</option>
                                                <option value="ADMIN">Admin screen only</option>
                                                <option value="BOTH">Participant and admin</option>
                                            </select>
                                            <p className="text-xs text-slate-500">
                                                ?????????????????????????筌뤾퍓愿????댁삩? ????濾?鶯????????????⑤㈇????????좊틣?????꿔꺂????븐슦????????쎛 ??遺얘턁????????????????耀붾굝??????????????곗뒭??????????⑤㈇????????좊틣???????????遺얘턁?????????遺얜??????????ル뭽?????????????關?쒎첎?嫄?????饔낅떽???壤굿??곸읆???
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-base font-medium text-slate-700">?????怨뺤른????녾낮?녔틦????遺얘턁????傭?끆???嶺뚮?猷볠꽴?????????</Label>
                                            <select
                                                value={stampTourConfig.rewardFulfillmentMode}
                                                onChange={(e) => setStampTourConfig(prev => ({
                                                    ...prev,
                                                    rewardFulfillmentMode: e.target.value as StampTourRewardFulfillmentMode
                                                }))}
                                                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                            >
                                                <option value="INSTANT">Instant reward</option>
                                                <option value="LOTTERY">Scheduled lottery</option>
                                            </select>
                                            <p className="text-xs text-slate-500">
                                                ??遺얘턁???鶯ㅺ동???⑥ャ걖?꿔꺂????용끏??????????? ??????꾩룆梨띰쭕????遺얘턁???鶯ㅺ동???⑥ャ걖?꿔꺂????용끏????????怨뺤른????녾낮?녔틦??????濾??????????ル뭽????????γ볥걙????? ???????숈?????????袁④뎬????? ??遺얘턁????????筌뤾퍓???????????꾩룆梨띰쭕?????????꾩룆梨띰쭕?????????????대첐?饔낅떽???嶺뚮슢??쾮??????????????살퓢????????袁④뎬?????饔낅떽???????
                                            </p>
                                        </div>

                                        {stampTourConfig.rewardFulfillmentMode === 'LOTTERY' && (
                                            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                                <Label className="text-base font-medium text-slate-700">Lottery schedule</Label>
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
                                                    ??????????????꾩룆梨띰쭕??????????????????????袁④뎬????????????????? ?????????遺얘턁?????????????????⑤㈇????????좊틣???????????????꾩룆梨띰쭕????????꾩룆梨띰쭕???? ??????????대첐?饔낅떽???嶺뚮슢??쾮??????????????袁④뎬???????????????????怨몄）.
                                                </p>
                                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-3 py-3 ring-1 ring-slate-200">
                                                    <div className="text-sm text-slate-600">
                                                        ??????⑤㈇????????좊틣??????????袁④뎬?????????꾩룆梨띰쭕??????濾?鶯?????????????????袁④뎬??? ?????怨뺤른?癲ル슢???????????袁④뎬??? ??????꾩룆梨띰쭕????????袁④뎬??? ????????낆┨????????좊틣???????關?쒎첎?嫄????????????????????????????怨몄）.
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => void handleRunLottery()}
                                                    >
                                                        ??????⑤㈇????????좊틣??????????袁④뎬???????濾?鶯???????諛몃마嶺뚮??????????袁ⓦ걤???꾩룆梨?????                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Rewards */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-base font-medium text-slate-700">Reward list</Label>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        const newReward: StampTourRewardForm = {
                                                            id: `reward_${Date.now()}`,
                                                            name: '',
                                                            label: '',
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
                                                    ??????怨쀫뮝嶺? ??????袁④뎬??
                                                </Button>
                                            </div>

                                            {stampTourConfig.rewards.length === 0 ? (
                                                <div className="text-sm text-slate-400">?????濡?씀?濾????ㅼ굡??????????怨쀫뮝嶺?????????繹먮굞??????????怨몄）.</div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {stampTourConfig.rewards.map((reward, idx) => (
                                                        <div key={reward.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div>
                                                                    <div className="text-sm font-semibold text-slate-700">
                                                                        {getStampTourRewardTitle(reward) || `Reward ${idx + 1}`}
                                                                    </div>
                                                                    {isStampTourRewardDrawCompleted(reward) && (
                                                                        <div className="mt-1 text-xs font-semibold text-rose-500">
                                                                            This reward is locked because its draw has already finished.
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs font-semibold text-slate-500">
                                                                    {selectableLotteryRewards.some((item) => item.id === reward.id)
                                                                        ? 'Selectable'
                                                                        : 'Locked'}
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-3 text-xs font-semibold text-slate-500 md:grid-cols-4">
                                                                <div>Rank label</div>
                                                                <div>Reward name</div>
                                                                <div>Total quantity: initial stock prepared for this reward</div>
                                                                <div>Remaining quantity: stock still available for drawing</div>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                                                <Input
                                                                    value={reward.label || ''}
                                                                    onChange={(e) => {
                                                                        const value = e.target.value;
                                                                        setStampTourConfig(prev => ({
                                                                            ...prev,
                                                                            rewards: prev.rewards.map((r, i) => i === idx ? { ...r, label: value } : r)
                                                                        }));
                                                                    }}
                                                                    placeholder="e.g. 1st prize"
                                                                />
                                                                <Input
                                                                    value={reward.name}
                                                                    onChange={(e) => {
                                                                        const value = e.target.value;
                                                                        setStampTourConfig(prev => ({
                                                                            ...prev,
                                                                            rewards: prev.rewards.map((r, i) => i === idx ? { ...r, name: value } : r)
                                                                        }));
                                                                    }}
                                                                    placeholder="Reward name"
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
                                                                    placeholder="Image URL (optional)"
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
                                                                        placeholder="Weight"
                                                                />
                                                            </div>

                                                            <p className="text-xs text-slate-500">
                                                                ??????????勇??????????????? ????????뉖????釉먮폁????????????????꾩룆梨띰쭕????? ???????????嶺?罹??
                                                                ???? ???????遺얘턁??????????援쏂굜???饔낅떽????熬곣뫁커??熬곣벀?????????ル???????????뉖????釉먮폁??????????꾩룆梨띰쭕????? ??????꿔꺂???癰귨샨??????關?쒎첎?嫄?濚밸쮦??????????遺얘턁???????????????Β?????????????諛몄カ?????????
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
                                                                    placeholder="??????遺얘턁????? URL (????鶯ㅺ동???????"
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
                                                                        placeholder="Display order"
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
                                                                        placeholder="Sold out message"
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
                                                                    ?????????遺얘턁???????
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
                                                                    ????
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Messages */}
                                        <div className="space-y-3">
                                            <Label className="text-base font-medium text-slate-700">??????꾩룆梨띰쭕????遺얘턁??????????</Label>
                                            <Input
                                                value={stampTourConfig.completionMessage}
                                                onChange={(e) => setStampTourConfig(prev => ({ ...prev, completionMessage: e.target.value }))}
                                                placeholder="??????꾩룆梨띰쭕??????耀붾굝?????????遺얘턁??????????"
                                            />
                                            <Label className="text-base font-medium text-slate-700">???????遺얘턁??????????</Label>
                                            <Input
                                                value={stampTourConfig.soldOutMessage}
                                                onChange={(e) => setStampTourConfig(prev => ({ ...prev, soldOutMessage: e.target.value }))}
                                                placeholder="?????????耀붾굝?????????遺얘턁??????????"
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Live Status */}
                                <Card className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden rounded-2xl">
                                    <CardContent className="p-6 md:p-8 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-bold text-slate-800">Live status</h3>
                                            <div className="text-xs text-slate-500 font-semibold">
                                                ??????꾩룆梨띰쭕??{stampTourProgress.filter(p => p.isCompleted).length}??
                                            </div>
                                        </div>

                                        {stampTourConfig.rewardFulfillmentMode === 'LOTTERY' && (
                                            <div className="flex justify-end">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={() => void handleRunLottery()}
                                                >
                                                    ??????袁④뎬?????????꾩룆梨띰쭕??????濾?鶯???????μ떜媛?걫??곸쁼??
                                                </Button>
                                            </div>
                                        )}

                                        {stampTourProgress.length === 0 ? (
                                            <div className="text-sm text-slate-400">??遺얘턁???????꿔꺂??????????????? ??????繹먮굞??????????怨몄）.</div>
                                        ) : (
                                            <div className="space-y-2">
                                                {stampTourProgress.map((row) => (
                                                    <div key={row.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2">
                                                        <div className="text-sm">
                                                            <div className="font-semibold text-slate-700">{row.userName || row.userId}</div>
                                                            <div className="text-xs text-slate-500">{row.userOrg || '-'}</div>
                                                            <div className="text-xs text-slate-500">{row.rewardLabel ? `${row.rewardLabel}${row.rewardName ? ` - ${row.rewardName}` : ""}` : row.rewardName || "Reward pending"}</div>
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
                                                                    {drawingUserId === row.id ? "Drawing..." : "Admin draw"}
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
                                                                    ????????????꾩룆梨띰쭕??
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
                            <h2 className="text-xl font-bold text-slate-800">Venue info</h2>
                        </div>
                        <p className="text-slate-500 leading-relaxed text-sm">
                            ?????????????롮쾸?椰?????????롮쾸??????????ル뭽?? ??????ル뭽???????癲됱빖?????猷몃룯??????????耀붾굝??????????????????⑤뜪輿???饔낅떽??????? <br />
                            ??遺얘턁?????????遺얘턁????????沅걔?輿삳뿫遊????????關?쒎첎?嫄??怨몄겮嶺????遺얘턁?????????????곕섯????? ??遺얘턁???????????????ㅿ폎??? ??遺얘턁????????沅걔?輿삳뿫遊????筌뚯슜留???????????癲됱빖?????猷몃룯??????黎앸럽??筌????????????????????怨몄）.
                        </p>
                    </div>

                    <div className="lg:col-span-8">
                        <Card className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden rounded-2xl">
                            <CardContent className="p-6 md:p-8 space-y-8">
                                <BilingualInput
                                    label="?????????(Venue Name)"
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
                                    placeholderKO="e.g. COEX Grand Ballroom"
                                    placeholderEN="e.g. COEX Grand Ballroom"
                                    required
                                />

                                <BilingualInput
                                    label="??????꾩룆梨띰쭕????????諛몄カ???(Address)"
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
                                    placeholderKO="?? ???饔낅떽???????????????밸븶筌믩끃??獄???????????ル뭽??癲??壤굿??⑸츅??????⑤슦留????????濚밸Ŧ援??????513"
                                    placeholderEN="Full Address"
                                    required
                                />

                                <div className="space-y-3">
                                    <Label className="text-base font-medium text-slate-700">??遺얘턁?????????遺얘턁????????沅걔?輿삳뿫遊???URL</Label>
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
                                        * ??遺얘턁????????????????????獄쏅챶留????????遺얘턁??????????????????????紐꾨첐????耀붾굝???????????곕츧?????遺얘턁???????URL??????????⑤뜪輿????轝꿸섣?????耀붾굝???????
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-base font-medium text-slate-700">??? ??遺얘턁?????????????꾩룆梨띰쭕???URL (Google Map Embed URL)</Label>
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
                                        * ??遺얘턁??????????????ㅿ폎??? -&gt; ??遺얘턁???????????????????????嶺?筌???????怨뺤른?癲ル슢????????HTML??src ???????紐껊뭸???????ル뭽????????????⑤뜪輿???饔낅떽???壤굿??곸읆??? (????鶯ㅺ동??????????
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
                            <h2 className="text-xl font-bold text-slate-800">Visual assets</h2>
                        </div>
                        <p className="text-slate-500 leading-relaxed text-sm">
                            ??????롮쾸??????????????????????諛몃마嶺뚮???????癲?? ???????????遺얘턁????????????????????????怨몄）.<br />
                            ???????????リ옇??뙴??????怨뚮뼺?됰뗀???????????????????ル뭽??????怨멸텛??????????뉖????????遺얘턁???????????關?쒎첎?嫄???????????????????怨몄）.
                        </p>
                        <div className="mt-4 p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                            <h4 className="font-semibold text-purple-900 text-sm mb-2">Recommended image size</h4>
                            <ul className="text-xs text-purple-800 space-y-1.5 list-disc list-inside">
                                <li>??遺얘턁????????????諛몃마嶺뚮???????癲? 1920 x 600 px</li>
                                <li>????? ??耀붾굝????????곗뵰壤??????????耀붾굝????????????????덉떻???(A4 ???????????</li>
                                <li>???????耀붾굝??????????⑤８?? JPG, PNG (??遺얘턁??????傭? 5MB)</li>
                            </ul>
                        </div>
                    </div>

                    <div className="lg:col-span-8">
                        <Card className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden rounded-2xl">
                            <CardContent className="p-6 md:p-8 space-y-10">
                                <BilingualImageUpload
                                    label="??遺얘턁????????????諛몃마嶺뚮???????癲?(Main Banner)"
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
                                    recommendedSize="1920x600 px"
                                    labelKO="Banner image (KO)"
                                    labelEN="Banner image (EN)"
                                />

                                <div className="border-t border-slate-100" />

                                <BilingualImageUpload
                                    label="?????/ ??耀붾굝????????(Poster)"
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
                                    recommendedSize="Poster image for print or A4 ratio"
                                    labelKO="Poster image (KO)"
                                    labelEN="Poster image (EN)"
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
                            <h2 className="text-xl font-bold text-slate-800">?????怨뚮뼺?됰뗀?????댁삩? ??遺얘턁??????????</h2>
                        </div>
                        <p className="text-slate-500 leading-relaxed text-sm">
                            ?????????놁졁?????????Β???????????嶺뚮?猷???????꾩룆梨띰쭕????????????????耀붾굝???????꿔꺂?????몄몡????????????⑤뜪輿???饔낅떽???????<br />
                            HTML ??耀붾굝???????袁⑸즴筌?????????遺얘턁????? ??????袁④뎬??????遺얘턁??????????遺븍き????????????怨몄）.
                        </p>
                    </div>

                    <div className="lg:col-span-8 space-y-6">
                        <Card className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden rounded-2xl">
                            <CardContent className="p-6 md:p-8 space-y-8">
                                {/* Korean Editor */}
                                <div>
                                    <Label className="text-base font-medium text-slate-700 mb-2 block">
                                        ???????????쇰뮛?????ㅼ쭋???/ Korean
                                    </Label>
                                    <RichTextEditor
                                        value={data.welcomeMessage.ko}
                                        onChange={(value) => setData(prev => ({
                                            ...prev,
                                            welcomeMessage: { ...prev.welcomeMessage, ko: value }
                                        }))}
                                        placeholder="?? ?????Β?????????癲됱빖?????猷몃룯??????????????? ??????沃섃뫂?????饔낅떽????????????..."
                                    />
                                </div>

                                {/* English Editor */}
                                <div>
                                    <Label className="text-base font-medium text-slate-700 mb-2 block">
                                        ?????English
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
                                        ??????遺얘턁????? ??????袁④뎬?? / Add Images
                                    </Label>
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition">
                                            <ImageIcon size={18} />
                                            <span className="text-sm font-bold text-slate-700">
                                                {uploadingImage ? '?????????/ Uploading...' : '??????遺얘턁????? ????鶯ㅺ동???????/ Choose Image'}
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
                                            JPG, PNG (??遺얘턁??????傭? 5MB)
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
