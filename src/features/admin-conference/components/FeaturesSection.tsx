import React from 'react';
import { Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ConferenceData } from '../types';

interface Props {
    data: ConferenceData;
    setData: React.Dispatch<React.SetStateAction<ConferenceData>>;
}

export function FeaturesSection({ data, setData }: Props) {
    return (
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
                                <p className="text-xs text-slate-500">방명록 기능을 활성화합니다. 참가자가 학술대회 페이지에서 방명록을 남길 수 있으며, 초록 제출 기간에만 노출됩니다. 필요하지 않은 경우 OFF로 설정하세요.</p>
                            </div>
                            <Switch
                                checked={data.features.guestbookEnabled}
                                onCheckedChange={(checked) => setData(prev => ({
                                    ...prev,
                                    features: { ...prev.features, guestbookEnabled: checked }
                                }))}
                                className="data-[state=checked]:bg-emerald-600"
                            />
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-bold text-slate-700">Stamp tour enabled</Label>
                                <p className="text-xs text-slate-500">스탬프 투어 기능을 활성화합니다. 참가자가 부스를 방문하고 스탬프를 모아 보상을 받을 수 있는 기능입니다. 부스와 보상 설정이 필요합니다.</p>
                            </div>
                            <Switch
                                checked={data.features.stampTourEnabled}
                                onCheckedChange={(checked) => setData(prev => ({
                                    ...prev,
                                    features: { ...prev.features, stampTourEnabled: checked }
                                }))}
                                className="data-[state=checked]:bg-indigo-600"
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </section>
    );
}
