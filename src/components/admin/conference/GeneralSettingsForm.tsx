import React from 'react';
import { Card, CardContent } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import BilingualInput from '../../ui/bilingual-input';
import { Calendar, Globe, FileText, Info, MapPin, MessageSquare } from 'lucide-react';

interface GeneralSettingsFormProps {
    data: any; 
    setData: React.Dispatch<React.SetStateAction<any>>;
}

export const GeneralSettingsForm: React.FC<GeneralSettingsFormProps> = ({ data, setData }) => {
    return (
        <div className="space-y-12">
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
                        학술대회의 기본 정보를 설정합니다. 제목, 부제, 일정, 장소 등 참가자에게 표시되는 핵심 정보를 입력하세요.<br />
                        일정은 한국 표준시(KST) 기준으로 저장되며, 시작일과 종료일을 정확히 입력해야 등록 및 프로그램 일정이 올바르게 표시됩니다.
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
                                label="학술대회명 (Title)"
                                valueKO={data.title.ko}
                                valueEN={data.title.en}
                                onChangeKO={(value) => setData((prev: any) => ({ ...prev, title: { ...prev.title, ko: value } }))}
                                onChangeEN={(value) => setData((prev: any) => ({ ...prev, title: { ...prev.title, en: value } }))}
                                placeholderKO="e.g. 2026 Spring Conference"
                                placeholderEN="e.g. The 35th Spring Conference"
                                required
                            />

                            <div className="space-y-3">
                                <Label className="text-base font-medium text-slate-700">부제 / 표어 (Subtitle)</Label>
                                <Input
                                    value={data.subtitle || ''}
                                    onChange={(e) => setData((prev: any) => ({ ...prev, subtitle: e.target.value }))}
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
                                        onChange={(e) => setData((prev: any) => ({ ...prev, dates: { ...prev.dates, start: e.target.value } }))}
                                        className="h-11 border-slate-200 rounded-lg"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <Label className="text-base font-medium text-slate-700">종료 일시 (End Date & Time)</Label>
                                    <Input
                                        type="datetime-local"
                                        value={data.dates.end}
                                        onChange={(e) => setData((prev: any) => ({ ...prev, dates: { ...prev.dates, end: e.target.value } }))}
                                        className="h-11 border-slate-200 rounded-lg"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            <hr className="border-slate-100" />

            {/* 2. Abstract Deadlines Section */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                <div className="lg:col-span-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="p-2.5 bg-purple-50 rounded-xl text-purple-600">
                            <FileText className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">Abstract deadlines</h2>
                    </div>
                    <p className="text-slate-500 leading-relaxed text-sm">
                        초록 접수 및 수정 마감일을 설정합니다. 이 기간이 지난 후에는 참가자가 초록을 제출하거나 수정할 수 없습니다.<br />
                        마감일이 지난 후에도 관리자는 대시보드에서 개별적으로 초록을 관리할 수 있습니다.
                    </p>
                </div>

                <div className="lg:col-span-8">
                    <Card className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden rounded-2xl">
                        <CardContent className="p-6 md:p-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <Label className="text-base font-medium text-slate-700">초록 접수 마감일 (Submission Deadline)</Label>
                                    <Input
                                        type="datetime-local"
                                        value={data.abstractDeadlines?.submissionDeadline || ''}
                                        onChange={(e) => setData((prev: any) => ({ ...prev, abstractDeadlines: { ...(prev.abstractDeadlines || {}), submissionDeadline: e.target.value } }))}
                                        className="h-11 border-slate-200 rounded-lg"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <Label className="text-base font-medium text-slate-700">초록 수정 마감일 (Edit Deadline)</Label>
                                    <Input
                                        type="datetime-local"
                                        value={data.abstractDeadlines?.editDeadline || ''}
                                        onChange={(e) => setData((prev: any) => ({ ...prev, abstractDeadlines: { ...(prev.abstractDeadlines || {}), editDeadline: e.target.value } }))}
                                        className="h-11 border-slate-200 rounded-lg"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            <hr className="border-slate-100" />

            {/* 3. Feature Toggles Section */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                <div className="lg:col-span-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
                            <Info className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">Feature toggles</h2>
                    </div>
                    <p className="text-slate-500 leading-relaxed text-sm">
                        학술대회에서 사용할 추가 기능을 활성화하거나 비활성화합니다. 각 기능은 ON/OFF로 설정할 수 있으며,<br />
                        필요한 기능만 활성화하여 참가자에게 최적화된 경험을 제공하세요.
                    </p>
                </div>

                <div className="lg:col-span-8">
                    <Card className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden rounded-2xl">
                        <CardContent className="p-6 md:p-8 space-y-6">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-bold text-slate-700">Guestbook enabled</Label>
                                    <p className="text-xs text-slate-500">방명록 기능을 활성화합니다.</p>
                                </div>
                                <Switch
                                    checked={data.features.guestbookEnabled}
                                    onChange={(e) => setData((prev: any) => ({
                                        ...prev,
                                        features: { ...prev.features, guestbookEnabled: e.target.checked }
                                    }))}
                                    className="data-[state=checked]:bg-emerald-600"
                                />
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-bold text-slate-700">Stamp tour enabled</Label>
                                    <p className="text-xs text-slate-500">스탬프 투어 기능을 활성화합니다.</p>
                                </div>
                                <Switch
                                    checked={data.features.stampTourEnabled}
                                    onChange={(e) => setData((prev: any) => ({
                                        ...prev,
                                        features: { ...prev.features, stampTourEnabled: e.target.checked }
                                    }))}
                                    className="data-[state=checked]:bg-indigo-600"
                                />
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-bold text-slate-700">Q&A enabled</Label>
                                    <p className="text-xs text-slate-500">실시간 Q&A 탭을 활성화합니다. (시간 설정은 '디지털 명찰 관리'에서 진행)</p>
                                </div>
                                <Switch
                                    checked={data.features?.qnaEnabled || false}
                                    onChange={(e) => setData((prev: any) => ({
                                        ...prev,
                                        features: { ...prev.features, qnaEnabled: e.target.checked }
                                    }))}
                                    className="data-[state=checked]:bg-purple-600"
                                />
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-bold text-slate-700">Certificate enabled</Label>
                                    <p className="text-xs text-slate-500">참가확인서(이수증) 다운로드 기능을 활성화합니다.</p>
                                </div>
                                <Switch
                                    checked={data.features?.certificateEnabled || false}
                                    onChange={(e) => setData((prev: any) => ({
                                        ...prev,
                                        features: { ...prev.features, certificateEnabled: e.target.checked }
                                    }))}
                                    className="data-[state=checked]:bg-blue-600"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            <hr className="border-slate-100" />

            {/* 4. Venue Info Section */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                <div className="lg:col-span-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="p-2.5 bg-red-50 rounded-xl text-red-600">
                            <MapPin className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">Venue info</h2>
                    </div>
                    <p className="text-slate-500 leading-relaxed text-sm">
                        학술대회가 열리는 장소의 정보를 입력합니다.
                    </p>
                </div>

                <div className="lg:col-span-8">
                    <Card className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden rounded-2xl">
                        <CardContent className="p-6 md:p-8 space-y-8">
                            <BilingualInput
                                label="장소명 (Venue Name)"
                                valueKO={data.venue.name.ko}
                                valueEN={data.venue.name.en}
                                onChangeKO={(value) => setData((prev: any) => ({
                                    ...prev,
                                    venue: { ...prev.venue, name: { ...prev.venue.name, ko: value } }
                                }))}
                                onChangeEN={(value) => setData((prev: any) => ({
                                    ...prev,
                                    venue: { ...prev.venue, name: { ...prev.venue.name, en: value } }
                                }))}
                                placeholderKO="e.g. COEX Grand Ballroom"
                                placeholderEN="e.g. COEX Grand Ballroom"
                                required
                            />

                            <BilingualInput
                                label="전체 주소 (Address)"
                                valueKO={data.venue.address.ko}
                                valueEN={data.venue.address.en}
                                onChangeKO={(value) => setData((prev: any) => ({
                                    ...prev,
                                    venue: { ...prev.venue, address: { ...prev.venue.address, ko: value } }
                                }))}
                                onChangeEN={(value) => setData((prev: any) => ({
                                    ...prev,
                                    venue: { ...prev.venue, address: { ...prev.venue.address, en: value } }
                                }))}
                                placeholderKO="예: 서울특별시 강남구 삼성로 513"
                                placeholderEN="Full Address"
                                required
                            />

                            <div className="space-y-3">
                                <Label className="text-base font-medium text-slate-700">네이버 지도 링크 URL</Label>
                                <div className="relative">
                                    <Globe className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                    <Input
                                        value={data.venue.mapUrl || ''}
                                        onChange={(e) => setData((prev: any) => ({ ...prev, venue: { ...prev.venue, mapUrl: e.target.value } }))}
                                        placeholder="https://map.naver.com/..."
                                        className="pl-10 h-11 border-slate-200 rounded-lg"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-base font-medium text-slate-700">구글 맵 임베드 URL</Label>
                                <div className="relative">
                                    <Globe className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                    <Input
                                        value={data.venue.googleMapEmbedUrl || ''}
                                        onChange={(e) => setData((prev: any) => ({ ...prev, venue: { ...prev.venue, googleMapEmbedUrl: e.target.value } }))}
                                        placeholder="https://www.google.com/maps/embed?..."
                                        className="pl-10 h-11 border-slate-200 rounded-lg"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>
        </div>
    );
};
