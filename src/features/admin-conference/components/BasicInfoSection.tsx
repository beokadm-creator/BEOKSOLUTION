import React from 'react';
import { Calendar, Globe } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import BilingualInput from '@/components/ui/bilingual-input';
import { ConferenceData } from '../types';

interface Props {
    data: ConferenceData;
    setData: React.Dispatch<React.SetStateAction<ConferenceData>>;
}

export function BasicInfoSection({ data, setData }: Props) {
    return (
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
                            onChangeKO={(value) => setData(prev => ({ ...prev, title: { ...prev.title, ko: value } }))}
                            onChangeEN={(value) => setData(prev => ({ ...prev, title: { ...prev.title, en: value } }))}
                            placeholderKO="e.g. 2026 Spring Conference"
                            placeholderEN="e.g. The 35th Spring Conference"
                            required
                        />

                        <div className="space-y-3">
                            <Label className="text-base font-medium text-slate-700">부제 / 표어 (Subtitle)</Label>
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
    );
}
