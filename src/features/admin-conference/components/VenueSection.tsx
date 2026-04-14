import React from 'react';
import { MapPin, Globe } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import BilingualInput from '@/components/ui/bilingual-input';
import { ConferenceData } from '../types';

interface Props {
    data: ConferenceData;
    setData: React.Dispatch<React.SetStateAction<ConferenceData>>;
}

export function VenueSection({ data, setData }: Props) {
    return (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            <div className="lg:col-span-4 space-y-3">
                <div className="flex items-center gap-2">
                    <div className="p-2.5 bg-red-50 rounded-xl text-red-600">
                        <MapPin className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Venue info</h2>
                </div>
                <p className="text-slate-500 leading-relaxed text-sm">
                    학술대회가 열리는 장소의 정보를 입력합니다. 장소명과 주소는 참가자에게 표시되며, 지도 링크를 추가하면 참가자가 쉽게 위치를 확인할 수 있습니다. <br />
                    장소명과 주소는 한국어와 영어로 각각 입력할 수 있습니다. 네이버 지도 링크와 구글 맵 임베드 URL을 등록하면 참가자가 길을 찾을 때 유용합니다.
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
                            placeholderKO="e.g. COEX Grand Ballroom"
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
                            placeholderKO="예: 서울특별시 강남구 삼성로 513"
                            placeholderEN="Full Address"
                            required
                        />

                        <div className="space-y-3">
                            <Label className="text-base font-medium text-slate-700">네이버 지도 링크 URL</Label>
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
                                * 네이버 지도에서 공유 버튼을 클릭하여 URL을 복사하세요. 카카오맵도 사용 가능하며, 참가자가 길을 찾을 때 유용합니다.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-base font-medium text-slate-700">구글 맵 임베드 URL (Google Map Embed URL)</Label>
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
                                * 구글 맵스에서 공유 → 지도 퍼가기 메뉴에서 HTML 소스의 src 속성값만 복사하여 붙여넣으세요 (iframe 전체가 아님)
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </section>
    );
}
