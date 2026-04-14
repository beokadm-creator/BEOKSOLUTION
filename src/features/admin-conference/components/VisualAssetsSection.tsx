import React from 'react';
import { ImageIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import BilingualImageUpload from '@/components/ui/bilingual-image-upload';
import { ConferenceData } from '../types';

interface Props {
    cid: string;
    data: ConferenceData;
    setData: React.Dispatch<React.SetStateAction<ConferenceData>>;
}

export function VisualAssetsSection({ cid, data, setData }: Props) {
    return (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            <div className="lg:col-span-4 space-y-3">
                <div className="flex items-center gap-2">
                    <div className="p-2.5 bg-purple-50 rounded-xl text-purple-600">
                        <ImageIcon className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Visual assets</h2>
                </div>
                <p className="text-slate-500 leading-relaxed text-sm">
                    학술대회에 사용할 배너와 포스터 이미지를 등록합니다. 등록 후 즉시 참가자에게 반영됩니다.<br />
                    배너는 학술대회 페이지 상단에, 포스터는 인쇄물 등에 활용되는 안내 이미지입니다. 등록된 이미지는 언어별로 다르게 설정할 수 있습니다.
                </p>
                <div className="mt-4 p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                    <h4 className="font-semibold text-purple-900 text-sm mb-2">Recommended image size</h4>
                    <ul className="text-xs text-purple-800 space-y-1.5 list-disc list-inside">
                        <li>메인 배너 권장 크기: 1920 x 600 px</li>
                        <li>포스터 / 안내 이미지: A4 비율 권장</li>
                        <li>지원 형식: JPG, PNG (최대 5MB)</li>
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
                            recommendedSize="1920x600 px"
                            labelKO="Banner image (KO)"
                            labelEN="Banner image (EN)"
                        />

                        <div className="border-t border-slate-100" />

                        <BilingualImageUpload
                            label="포스터 / 안내 이미지 (Poster)"
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
    );
}
