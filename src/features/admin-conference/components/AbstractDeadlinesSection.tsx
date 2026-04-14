import React from 'react';
import { FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ConferenceData } from '../types';

interface Props {
    data: ConferenceData;
    setData: React.Dispatch<React.SetStateAction<ConferenceData>>;
}

export function AbstractDeadlinesSection({ data, setData }: Props) {
    return (
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
                                    value={data.abstractDeadlines.submissionDeadline || ''}
                                    onChange={(e) => setData(prev => ({ ...prev, abstractDeadlines: { ...prev.abstractDeadlines, submissionDeadline: e.target.value } }))}
                                    className="h-11 border-slate-200 rounded-lg"
                                />
                                <p className="text-xs text-slate-400 mt-1">
                                    참가자가 직접 입력하는 마감일입니다. 이 날짜 이후에는 초록 제출이 불가능합니다.
                                </p>
                            </div>
                            <div className="space-y-3">
                                <Label className="text-base font-medium text-slate-700">초록 수정 마감일 (Edit Deadline)</Label>
                                <Input
                                    type="datetime-local"
                                    value={data.abstractDeadlines.editDeadline || ''}
                                    onChange={(e) => setData(prev => ({ ...prev, abstractDeadlines: { ...prev.abstractDeadlines, editDeadline: e.target.value } }))}
                                    className="h-11 border-slate-200 rounded-lg"
                                />
                                <p className="text-xs text-slate-400 mt-1">
                                    참가자가 직접 입력하는 마감일입니다. 이 날짜 이후에는 초록 제출 및 수정이 불가능합니다.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </section>
    );
}
