import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleLeft, Save, Trash2, Mail, MessageCircle } from 'lucide-react';
import { NotificationTemplate } from '@/types/schema';

interface TemplateGridProps {
    templates: NotificationTemplate[];
    onEdit: (template: NotificationTemplate) => void;
    onToggleActive: (template: NotificationTemplate) => void;
    onDelete: (id: string) => void;
}

export function TemplateGrid({ templates, onEdit, onToggleActive, onDelete }: TemplateGridProps) {
    return (
        <div className="grid grid-cols-1 gap-6">
            {templates.map(template => (
                <Card key={template.id} className={`border-none shadow-lg shadow-slate-200/50 bg-white rounded-2xl overflow-hidden transition-all hover:shadow-xl ${!template.isActive ? 'opacity-80 grayscale-[0.3]' : ''}`}>
                    <CardHeader className="border-b border-slate-100 pb-4 bg-slate-50/50">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <h3 className="font-bold text-lg text-slate-800">{template.name}</h3>
                                    <Badge variant={template.isActive ? 'default' : 'secondary'} className={template.isActive ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                                        {template.isActive ? '활성' : '비활성'}
                                    </Badge>
                                </div>
                                {template.description && (
                                    <p className="text-sm text-slate-500 font-medium">{template.description}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onToggleActive(template)}
                                    className={template.isActive ? "text-slate-500 hover:text-slate-700" : "text-emerald-600 hover:text-emerald-700 bg-emerald-50"}
                                    title="Toggle Status"
                                >
                                    <ToggleLeft className="w-4 h-4 mr-2" />
                                    {template.isActive ? '비활성화' : '활성화'}
                                </Button>
                                <div className="h-4 w-px bg-slate-200 mx-1" />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onEdit(template)}
                                    className="hover:bg-indigo-50 hover:text-indigo-600 border-slate-200"
                                >
                                    <Save className="w-3.5 h-3.5 mr-2" />
                                    Edit
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onDelete(template.id)}
                                    className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                            {/* Email Preview */}
                            <div className="p-6 space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm bg-emerald-50 px-3 py-1 rounded-full w-fit">
                                        <Mail className="w-3.5 h-3.5" />
                                        이메일 채널
                                    </div>
                                    {!template.channels.email && <span className="text-xs text-slate-400 font-medium">설정되지 않음</span>}
                                </div>

                                {template.channels.email ? (
                                    <div className="space-y-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
                                        <div className="space-y-1">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">제목</span>
                                            <p className="font-semibold text-slate-800 text-sm">{template.channels.email.subject}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">본문 미리보기</span>
                                            <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed bg-white p-3 rounded-lg border border-slate-100 shadow-sm font-mono text-xs">
                                                {template.channels.email.body}
                                            </p>
                                        </div>
                                        {template.channels.email.isHtml && (
                                            <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-200 bg-white">HTML 사용</Badge>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-32 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                                        <Mail className="w-8 h-8 mb-2 opacity-20" />
                                        <p className="text-xs font-medium">이메일 설정 없음</p>
                                    </div>
                                )}
                            </div>

                            {/* Kakao Preview */}
                            <div className="p-6 space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 text-amber-700 font-bold text-sm bg-amber-50 px-3 py-1 rounded-full w-fit">
                                        <MessageCircle className="w-3.5 h-3.5" />
                                        알림톡 (카카오)
                                    </div>
                                    {!template.channels.kakao && <span className="text-xs text-slate-400 font-medium">설정되지 않음</span>}
                                </div>

                                {template.channels.kakao ? (
                                    <div className="space-y-3 bg-amber-50/30 rounded-xl p-4 border border-amber-100/50">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">상태</span>
                                            <Badge variant={
                                                template.channels.kakao.status === 'APPROVED' ? 'default' :
                                                    template.channels.kakao.status === 'REJECTED' ? 'destructive' : 'secondary'
                                            } className={`
                                                ${template.channels.kakao.status === 'APPROVED' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                                                ${template.channels.kakao.status === 'PENDING' ? 'bg-slate-500' : ''}
                                            `}>
                                                {template.channels.kakao.status === 'PENDING' ? '심사 대기중' :
                                                    template.channels.kakao.status === 'APPROVED' ? '승인됨' : '반려됨'}
                                            </Badge>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">내용 미리보기</span>
                                            <div className="bg-[#FAE100]/10 p-4 rounded-lg border border-[#FAE100]/30">
                                                <p className="text-sm text-slate-800 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                                                    {template.channels.kakao.content}
                                                </p>
                                            </div>
                                        </div>

                                        {template.channels.kakao.buttons.length > 0 && (
                                            <div className="space-y-2 pt-1">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">버튼</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {template.channels.kakao.buttons.map((btn, idx) => (
                                                        <Badge key={idx} variant="outline" className="bg-white text-slate-600 border-slate-200 py-1 px-2">
                                                            {btn.name}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {template.channels.kakao.kakaoTemplateCode && (
                                            <div className="pt-2 border-t border-amber-100/50 flex justify-between items-center">
                                                <span className="text-[10px] text-slate-400 font-medium uppercase">템플릿 코드</span>
                                                <code className="text-[10px] bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-600">
                                                    {template.channels.kakao.kakaoTemplateCode}
                                                </code>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-32 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                                        <MessageCircle className="w-8 h-8 mb-2 opacity-20" />
                                        <p className="text-xs font-medium">알림톡 설정 없음</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
