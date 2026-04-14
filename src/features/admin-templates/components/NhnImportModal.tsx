import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import toast from 'react-hot-toast';

interface NhnImportModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    nhnTemplates: unknown[];
    onSelectTemplate: (tpl: unknown) => void;
}

export function NhnImportModal({ isOpen, onOpenChange, nhnTemplates, onSelectTemplate }: NhnImportModalProps) {
    const handleSelect = (tpl: unknown) => {
        onSelectTemplate(tpl);
        onOpenChange(false);
        toast.success("NHN Cloud 템플릿을 불러왔습니다.");
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto p-0 gap-0 bg-white rounded-2xl overflow-hidden block">
                <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-white sticky top-0 z-10">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                            <Download className="w-5 h-5" />
                        </div>
                        <DialogTitle className="text-xl font-bold text-slate-900">
                            NHN Cloud 템플릿 불러오기
                        </DialogTitle>
                    </div>
                    <DialogDescription className="text-slate-500 ml-11">
                        NHN Cloud에 등록된 승인된 알림톡 템플릿 목록입니다.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6">
                    <div className="space-y-4">
                        {nhnTemplates.length === 0 ? (
                            <div className="text-center py-10 text-slate-500 font-medium">
                                불러온 템플릿이 없습니다.
                            </div>
                        ) : (
                            nhnTemplates.map((tpl: any) => (
                                <Card key={tpl.templateCode} className="transition-all hover:bg-slate-50/50 cursor-pointer border-slate-100 group" onClick={() => handleSelect(tpl)}>
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h5 className="font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">{tpl.templateName}</h5>
                                                <p className="text-xs text-slate-400 font-mono mt-0.5">{tpl.templateCode}</p>
                                            </div>
                                            <Badge className="bg-emerald-500">
                                                승인됨
                                            </Badge>
                                        </div>
                                        <div className="bg-emerald-50/30 p-3 rounded-lg border border-emerald-100 mb-3 line-clamp-3">
                                            <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                                                {tpl.templateContent}
                                            </p>
                                        </div>
                                        {tpl.buttons && tpl.buttons.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mb-3">
                                                {tpl.buttons.map((btn: any, idx: number) => (
                                                    <Badge key={idx} variant="outline" className="text-[10px] bg-white text-slate-600 border-slate-200">
                                                        🔘 {btn.name}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex justify-end">
                                            <Button size="sm" variant="ghost" className="h-8 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 font-bold">
                                                선택하기
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
