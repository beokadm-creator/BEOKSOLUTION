import { useState, useEffect } from 'react';
import { collection, doc, getDoc, getDocs, onSnapshot, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import { db, storage, functions } from '@/firebase';
import { 
    ConferenceData, 
    SponsorSummary, 
    StampTourConfigForm, 
    StampTourProgressRow 
} from '../types';
import {
    getStampMissionTargetCount,
    hasValidStampTourRewards,
    normalizeStampTourRewards
} from '@/utils/stampTour';

export const defaultData: ConferenceData = {
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

export const defaultStampTourConfig: StampTourConfigForm = {
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
    soldOutMessage: '모든 보상이 소진되었습니다. 다음 기회에 다시 도전해 주세요!',
    completionMessage: '스탬프 투어를 완료하셨습니다! 축하드립니다. 보상 추첨 결과는 추후 안내드립니다.'
};

export const getKstEndOfDayTimestamp = (dtStr: string): Timestamp | null => {
    if (!dtStr) return null;
    const [datePart] = dtStr.split('T');
    if (!datePart) return null;
    const [year, month, day] = datePart.split('-').map(Number);
    if (!year || !month || !day) return null;
    // 23:59 KST = 14:59 UTC
    return Timestamp.fromDate(new Date(Date.UTC(year, month - 1, day, 14, 59, 0, 0)));
};

export const formatKstTimestamp = (ts?: Timestamp): string => {
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

export function useConferenceSettings(cid: string | undefined) {
    const [data, setData] = useState<ConferenceData>(defaultData);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [sponsors, setSponsors] = useState<SponsorSummary[]>([]);
    const [stampTourConfig, setStampTourConfig] = useState<StampTourConfigForm>(defaultStampTourConfig);
    const [stampTourProgress, setStampTourProgress] = useState<StampTourProgressRow[]>([]);
    const [drawingUserId, setDrawingUserId] = useState<string | null>(null);

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
                            const d = (ts as { toDate: () => Date }).toDate();
                            const kstOffset = 9 * 60;
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

            const parseDatetimeLocal = (dtStr: string): Date => {
                const [datePart, timePart] = dtStr.split('T');
                const [year, month, day] = datePart.split('-').map(Number);
                const [hour, minute] = (timePart || '00:00').split(':').map(Number);
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
                    ? `${row.userName || row.id} 님에게 다음 보상이 추첨되었습니다: ${payload.rewardName}`
                    : `${row.userName || row.id} 님에게 당첨된 보상이 없습니다.`
            );
        } catch (error) {
            console.error('Admin reward draw failed:', error);
            toast.error(error instanceof Error ? error.message : '추첨 중 오류가 발생했습니다. 남은 수량을 확인해주세요.');
        } finally {
            setDrawingUserId(null);
        }
    };

    const handleRunLottery = async () => {
        if (!cid) return;
        window.location.href = `/admin/conf/${cid}/stamp-tour-draw`;
    };

    return {
        data,
        setData,
        loading,
        saving,
        uploadingImage,
        sponsors,
        stampTourConfig,
        setStampTourConfig,
        stampTourProgress,
        drawingUserId,
        stampTourParticipantCount,
        normalizedRequiredStampCount,
        handleSave,
        handleImageUpload,
        handleAdminRewardDraw,
        handleRunLottery
    };
}
