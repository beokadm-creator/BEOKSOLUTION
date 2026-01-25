import React, { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAdminStore } from '../../store/adminStore';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import ImageUpload from '../../components/ui/ImageUpload';
import BilingualInput from '../../components/ui/bilingual-input';
import BilingualImageUpload from '../../components/ui/bilingual-image-upload';
import { Calendar, MapPin, Globe, FileText, ImageIcon, Save } from 'lucide-react';
import toast from 'react-hot-toast';

interface ConferenceData {
    title: { ko: string; en: string };
    subtitle?: string; // Added
    slug: string;
    dates: { start: string; end: string };
    venue: { 
        name: { ko: string; en: string };
        address: { ko: string; en: string };
        mapUrl: string;
    };
    visualAssets: {
        banner: { ko: string; en: string };
        poster: { ko: string; en: string };
    };
    welcomeMessage: { ko: string; en: string };
}

const defaultData: ConferenceData = {
    title: { ko: '', en: '' },
    subtitle: '', // Added
    slug: '',
    dates: { start: '', end: '' },
    venue: { 
        name: { ko: '', en: '' },
        address: { ko: '', en: '' },
        mapUrl: ''
    },
    visualAssets: {
        banner: { ko: '', en: '' },
        poster: { ko: '', en: '' }
    },
    welcomeMessage: { ko: '', en: '' }
};

export default function ConferenceSettingsPage() {
    const { selectedConferenceId, selectedConferenceSlug } = useAdminStore();
    const [data, setData] = useState<ConferenceData>(defaultData);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!selectedConferenceId) return;

        const fetchData = async () => {
            try {
                const docRef = doc(db, 'conferences', selectedConferenceId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const snapData = docSnap.data();
                    
                    // Helper to convert Timestamp to YYYY-MM-DD
                    const toDateStr = (ts: any) => {
                        if (ts?.toDate) return ts.toDate().toISOString().split('T')[0];
                        return ts || '';
                    };

                    setData({
                        title: { ko: snapData.title?.ko || '', en: snapData.title?.en || '' },
                        subtitle: snapData.subtitle || '', // Added
                        slug: snapData.slug || selectedConferenceSlug || '',
                        dates: { 
                            start: toDateStr(snapData.startDate || snapData.dates?.start), 
                            end: toDateStr(snapData.endDate || snapData.dates?.end) 
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
                            mapUrl: snapData.venue?.mapUrl || '' 
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
                        }
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
    }, [selectedConferenceId, selectedConferenceSlug]);

    const handleSave = async () => {
        if (!selectedConferenceId) return;
        setSaving(true);
        try {
            const docRef = doc(db, 'conferences', selectedConferenceId);
            
// Prepare update object (flattened or structured depending on schema preference)
            // Here we map back to schema structure used in ConfigPage/Dashboard
            const updateData = {
                title: data.title,
                subtitle: data.subtitle, // Added
                // slug is usually immutable after creation, but we can include it if needed
                startDate: data.dates.start ? Timestamp.fromDate(new Date(data.dates.start)) : null,
                endDate: data.dates.end ? Timestamp.fromDate(new Date(data.dates.end)) : null,
                // Also update the 'dates' field for consistency if schema is transitioning
                dates: {
                     start: data.dates.start ? Timestamp.fromDate(new Date(data.dates.start)) : null,
                     end: data.dates.end ? Timestamp.fromDate(new Date(data.dates.end)) : null,
                },
                venue: data.venue,
                // Keep legacy fields for backward compatibility
                bannerUrl: data.visualAssets.banner.ko, // Fallback to Korean version
                posterUrl: data.visualAssets.poster.ko, // Fallback to Korean version
                // New bilingual structure
                visualAssets: data.visualAssets,
                welcomeMessage: data.welcomeMessage,
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

    if (!selectedConferenceId) return <div className="p-10">Please select a conference first.</div>;
    if (loading) return <div className="p-10 flex justify-center">설정 로딩 중...</div>;

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">행사 설정</h1>
                    <p className="text-gray-500 mt-2">행사의 기본 정보, 장소, 시각 자료를 관리하세요.</p>
                </div>
                <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
                    <Save className="w-4 h-4" />
                    {saving ? '저장 중...' : '변경사항 저장'}
                </Button>
            </div>

            {/* General Info */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        <CardTitle>기본 정보</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <BilingualInput
                        label="컨퍼런스 제목"
                        valueKO={data.title.ko}
                        valueEN={data.title.en}
                        onChangeKO={(value) => setData(prev => ({ ...prev, title: { ...prev.title, ko: value } }))}
                        onChangeEN={(value) => setData(prev => ({ ...prev, title: { ...prev.title, en: value } }))}
                        placeholderKO="제00회 OO학회 춘계학술대회"
                        placeholderEN="The 00th Annual Conference..."
                        required
                    />

                    <div className="space-y-2">
                        <Label>부제 / 슬로건 (Subtitle)</Label>
                        <Input 
                            value={data.subtitle || ''} 
                            onChange={(e) => setData(prev => ({ ...prev, subtitle: e.target.value }))}
                            placeholder="Innovating the Future of Medicine"
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>시작일</Label>
                            <Input 
                                type="date"
                                value={data.dates.start}
                                onChange={(e) => setData(prev => ({ ...prev, dates: { ...prev.dates, start: e.target.value } }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>종료일</Label>
                            <Input 
                                type="date"
                                value={data.dates.end}
                                onChange={(e) => setData(prev => ({ ...prev, dates: { ...prev.dates, end: e.target.value } }))}
                            />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <Label>URL 슬러그 (읽기 전용)</Label>
                        <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-gray-400" />
                            <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1">
                                /{data.slug}
                            </code>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Venue Info */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-red-600" />
                        <CardTitle>장소 정보</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <BilingualInput
                        label="장소명"
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
                        placeholderEN="e.g., Coex Grand Ballroom"
                        required
                    />
                    
                    <BilingualInput
                        label="주소"
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
                        placeholderKO="서울특별시 강남구..."
                        placeholderEN="Full address"
                        required
                    />
                    
                    <div className="space-y-2">
                        <Label>지도 링크 (네이버/구글)</Label>
                        <Input 
                            value={data.venue.mapUrl}
                            onChange={(e) => setData(prev => ({ ...prev, venue: { ...prev.venue, mapUrl: e.target.value } }))}
                            placeholder="https://map.naver.com/..."
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Visuals */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-purple-600" />
                        <CardTitle>시각 자료 (국문/영문)</CardTitle>
                    </div>
                    <CardDescription>국문과 영문 페이지용 시각 자료를 각각 업로드하세요. 영문 이미지가 없으면 국문 버전이 사용됩니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    {/* Main Banner */}
                    <BilingualImageUpload
                        label="메인 배너"
                        valueKO={data.visualAssets.banner.ko}
                        valueEN={data.visualAssets.banner.en}
                        onChangeKO={(url) => setData(prev => ({ 
                            ...prev, 
                            visualAssets: { 
                                ...prev.visualAssets, 
                                banner: { ...prev.visualAssets.banner, ko: url } 
                            } 
                        }))}
                        onChangeEN={(url) => setData(prev => ({ 
                            ...prev, 
                            visualAssets: { 
                                ...prev.visualAssets, 
                                banner: { ...prev.visualAssets.banner, en: url } 
                            } 
                        }))}
                        pathBaseKO={`conferences/${selectedConferenceId}/banner_ko`}
                        pathBaseEN={`conferences/${selectedConferenceId}/banner_en`}
                        recommendedSize="1920x600 recommended"
                        labelKO="메인 배너 (국문)"
                        labelEN="Main Banner (English)"
                    />

                    {/* Poster */}
                    <BilingualImageUpload
                        label="포스터 / 썸네일"
                        valueKO={data.visualAssets.poster.ko}
                        valueEN={data.visualAssets.poster.en}
                        onChangeKO={(url) => setData(prev => ({ 
                            ...prev, 
                            visualAssets: { 
                                ...prev.visualAssets, 
                                poster: { ...prev.visualAssets.poster, ko: url } 
                            } 
                        }))}
                        onChangeEN={(url) => setData(prev => ({ 
                            ...prev, 
                            visualAssets: { 
                                ...prev.visualAssets, 
                                poster: { ...prev.visualAssets.poster, en: url } 
                            } 
                        }))}
                        pathBaseKO={`conferences/${selectedConferenceId}/poster_ko`}
                        pathBaseEN={`conferences/${selectedConferenceId}/poster_en`}
                        recommendedSize="Vertical or Square recommended"
                        labelKO="포스터 (국문)"
                        labelEN="Poster (English)"
                    />
                </CardContent>
            </Card>

{/* Content */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-green-600" />
                        <CardTitle>환영 메시지</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <BilingualInput
                        label="의장 인사말"
                        valueKO={data.welcomeMessage.ko}
                        valueEN={data.welcomeMessage.en}
                        onChangeKO={(value) => setData(prev => ({ 
                            ...prev, 
                            welcomeMessage: { ...prev.welcomeMessage, ko: value } 
                        }))}
                        onChangeEN={(value) => setData(prev => ({ 
                            ...prev, 
                            welcomeMessage: { ...prev.welcomeMessage, en: value } 
                        }))}
                        placeholderKO="연차학술대회에 오신 것을 환영합니다..."
                        placeholderEN="Welcome to our annual conference..."
                        type="textarea"
                        rows={6}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
