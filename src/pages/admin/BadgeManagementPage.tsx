import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Loader2, Eye, Save, ArrowLeft, Link as LinkIcon, Download, Badge, Settings } from 'lucide-react';
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

    // Print Badge Settings
    const [badgeLayoutEnabled, setBadgeLayoutEnabled] = useState(false);

    useEffect(() => {
        if (!cid) return;

        const fetchSettings = async () => {
            try {
                const settingsDoc = await getDoc(doc(db, `conferences/${cid}/settings`, 'badge_config'));

                if (settingsDoc.exists()) {
                    const data = settingsDoc.data();
                    setMaterialsUrls(data.materialsUrls || []);
                    setTranslationUrl(data.translationUrl || '');
                    setBadgeLayoutEnabled(data.badgeLayoutEnabled || false);
                }
            } catch (error) {
                console.error('Failed to fetch badge settings:', error);
                toast.error('명찰 설정을 불러오는데 실패했습니다.');
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
            await updateDoc(doc(db, `conferences/${cid}/settings`, 'badge_config'), {
                materialsUrls,
                translationUrl,
                badgeLayoutEnabled,
                updatedAt: Timestamp.now()
            });

            toast.success('명찰 설정이 저장되었습니다.');
        } catch (error) {
            console.error('Failed to save badge settings:', error);
            toast.error('명찰 설정 저장에 실패했습니다.');
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
                        뒤로가기
                    </Button>
                    <h1 className="text-3xl font-bold text-gray-900">명찰 관리</h1>
                    <p className="text-gray-600 mt-2">
                        디지털 명찰과 출력 명찰을 설정하고 관리합니다.
                    </p>
                </div>

                <Tabs defaultValue="digital" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="digital">
                            <Badge className="w-4 h-4 mr-2" />
                            디지털 명찰
                        </TabsTrigger>
                        <TabsTrigger value="print">
                            <Download className="w-4 h-4 mr-2" />
                            출력 명찰
                        </TabsTrigger>
                        <TabsTrigger value="preview">
                            <Eye className="w-4 h-4 mr-2" />
                            미리보기
                        </TabsTrigger>
                    </TabsList>

                    {/* Digital Badge Settings */}
                    <TabsContent value="digital">
                        <Card>
                            <CardHeader>
                                <CardTitle>디지털 명찰 설정</CardTitle>
                                <CardDescription>
                                    디지털 명찰 화면에 표시할 자료 링크와 번역 URL을 설정합니다.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Materials URLs */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-base font-semibold">자료 다운로드 링크</Label>
                                        <Button onClick={addMaterialUrl} size="sm" variant="outline">
                                            <LinkIcon className="w-4 h-4 mr-1" />
                                            링크 추가
                                        </Button>
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        디지털 명찰의 '자료' 탭에 표시될 다운로드 링크를 설정합니다.
                                    </p>

                                    {materialsUrls.map((material, index) => (
                                        <div key={index} className="flex gap-2 items-start">
                                            <div className="flex-1 space-y-2">
                                                <Input
                                                    placeholder="링크 이름 (예: 강의 자료실)"
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
                                                삭제
                                            </Button>
                                        </div>
                                    ))}

                                    {materialsUrls.length === 0 && (
                                        <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                                            추가된 링크가 없습니다. '링크 추가' 버튼을 클릭하여 링크를 추가하세요.
                                        </div>
                                    )}
                                </div>

                                {/* Translation URL */}
                                <div className="space-y-2">
                                    <Label className="text-base font-semibold">실시간 번역 URL</Label>
                                    <Input
                                        placeholder="https://translation-service.example.com/conference/..."
                                        value={translationUrl}
                                        onChange={(e) => setTranslationUrl(e.target.value)}
                                    />
                                    <p className="text-sm text-gray-500">
                                        실시간 번역 서비스 URL을 입력합니다. (추후 기능)
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Print Badge Settings */}
                    <TabsContent value="print">
                        <Card>
                            <CardHeader>
                                <CardTitle>출력 명찰 설정</CardTitle>
                                <CardDescription>
                                    명찰 편집기로 이동하여 출력용 명찰 디자인을 수정합니다.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                                    <h3 className="font-semibold text-blue-900 mb-2">명찰 편집기</h3>
                                    <p className="text-sm text-blue-700 mb-4">
                                        명찰 레이아웃, 필드 위치, 스타일을 시각적으로 편집할 수 있습니다.
                                    </p>
                                    <Button
                                        onClick={() => navigate(`/admin/conf/${cid}/badge-editor`)}
                                        className="w-full"
                                    >
                                        <Settings className="w-4 h-4 mr-2" />
                                        명찰 편집기 열기
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-base font-semibold">명찰 레이아웃 사용</Label>
                                        <input
                                            type="checkbox"
                                            checked={badgeLayoutEnabled}
                                            onChange={(e) => setBadgeLayoutEnabled(e.target.checked)}
                                            className="w-5 h-5 text-blue-600 rounded"
                                        />
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        명찰 편집기에서 설정한 레이아웃을 사용하여 명찰을 출력합니다.
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
                                    <CardTitle>디지털 명찰 미리보기</CardTitle>
                                    <CardDescription>
                                        디지털 명찰이 실제로 어떻게 표시되는지 확인합니다.
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
                                                <p className="text-xs text-gray-500 mb-2">서울대학교</p>
                                                <div className="bg-white p-2 inline-block rounded-xl border-2 border-emerald-200 mb-2">
                                                    <div className="w-32 h-32 bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                                                        QR Code
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-5 gap-1 text-xs">
                                                    {['상태', '수강', '자료', '프로그램', '번역'].map((tab) => (
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

                    {/* Print Badge Preview */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>출력 명찰 미리보기</CardTitle>
                                    <CardDescription>
                                        출력용 명찰이 어떻게 표시되는지 확인합니다. (배경 이미지 및 레이아웃 반영)
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
                                                        org: '서울대학교병원',
                                                        category: '정회원',
                                                        LICENSE: '12345',
                                                        PRICE: '50,000원'
                                                    }}
                                                    config={convertBadgeLayoutToConfig(info.badgeLayout)}
                                                />
                                            </div>
                                        ) : (
                                            <div className="text-gray-500 py-10 flex flex-col items-center">
                                                <Settings className="w-12 h-12 mb-4 text-gray-300" />
                                                <p>명찰 레이아웃 정보가 없습니다.</p>
                                                <Button variant="link" onClick={() => navigate(`/admin/conf/${cid}/badge-editor`)}>
                                                    명찰 편집기에서 설정하기
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
                            취소
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    저장 중...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
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
