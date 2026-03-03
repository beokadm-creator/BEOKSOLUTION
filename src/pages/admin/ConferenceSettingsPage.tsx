import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent } from '../../components/ui/card';
import BilingualInput from '../../components/ui/bilingual-input';
import BilingualImageUpload from '../../components/ui/bilingual-image-upload';
import RichTextEditor from '../../components/ui/RichTextEditor';
import { Calendar, MapPin, Globe, FileText, ImageIcon, Save, Loader2, Info, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Skeleton } from '../../components/ui/skeleton';

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
    }
};

export default function ConferenceSettingsPage() {
    const { cid } = useParams<{ cid: string }>();
    const [data, setData] = useState<ConferenceData>(defaultData);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    useEffect(() => {
        if (!cid) return;

        const fetchData = async () => {
            try {
                const docRef = doc(db, 'conferences', cid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const snapData = docSnap.data();

                    const toDateTimeLocalStr = (ts: any): string => {
                        if (ts && typeof ts === 'object' && ts.toDate) {
                            // Firestore Timestamp → KST 기준 datetime-local 문자열로 변환
                            const d = ts.toDate();
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

                    setData({
                        title: { ko: snapData.title?.ko || '', en: snapData.title?.en || '' },
                        subtitle: snapData.subtitle || '',
                        slug: snapData.slug || cid || '',
                        dates: {
                            start: toDateTimeLocalStr(snapData.startDate || snapData.dates?.start),
                            end: toDateTimeLocalStr(snapData.endDate || snapData.dates?.end)
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
                        welcomeMessageImages: snapData.welcomeMessageImages || []
                    });
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

    const handleSave = async () => {
        if (!cid) return;
        setSaving(true);
        try {
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
                updatedAt: Timestamp.now()
            };

            await updateDoc(docRef, updateData);
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
