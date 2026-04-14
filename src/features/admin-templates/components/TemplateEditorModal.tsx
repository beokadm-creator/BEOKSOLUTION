import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Save, Mail, MessageCircle, Info, RefreshCw, Download, Trash2 } from 'lucide-react';
import { EVENT_TYPE_PRESETS, NotificationEventType, NotificationTemplate, AlimTalkButton } from '@/types/schema';

interface TemplateEditorModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    editingTemplate: NotificationTemplate | null;
    selectedEventType: NotificationEventType;
    onSave: (eventType: NotificationEventType) => void;

    // Form state
    templateName: string;
    setTemplateName: (v: string) => void;
    templateDescription: string;
    setTemplateDescription: (v: string) => void;
    isActive: boolean;
    setIsActive: (v: boolean) => void;

    // Email
    emailSubject: string;
    setEmailSubject: (v: string) => void;
    emailBody: string;
    setEmailBody: (v: string) => void;
    isHtmlEmail: boolean;
    setIsHtmlEmail: (v: boolean) => void;

    // Kakao
    kakaoContent: string;
    setKakaoContent: (v: string) => void;
    kakaoButtons: AlimTalkButton[];
    kakaoTemplateCode: string;
    setKakaoTemplateCode: (v: string) => void;
    kakaoStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
    setKakaoStatus: (v: 'PENDING' | 'APPROVED' | 'REJECTED') => void;

    // Helpers
    loadingNhn: boolean;
    onFetchNhnTemplates: () => void;
    insertVariable: (key: string, eventType: NotificationEventType) => void;
    onAddKakaoButton: () => void;
    onUpdateKakaoButton: (index: number, field: keyof AlimTalkButton, value: string) => void;
    onSmartLinkPreset: (index: number, preset: string) => void;
    onRemoveKakaoButton: (index: number) => void;
}

export function TemplateEditorModal({
    isOpen, onOpenChange, editingTemplate, selectedEventType, onSave,
    templateName, setTemplateName, templateDescription, setTemplateDescription, isActive, setIsActive,
    emailSubject, setEmailSubject, emailBody, setEmailBody, isHtmlEmail, setIsHtmlEmail,
    kakaoContent, setKakaoContent, kakaoButtons, kakaoTemplateCode, setKakaoTemplateCode, kakaoStatus, setKakaoStatus,
    loadingNhn, onFetchNhnTemplates, insertVariable,
    onAddKakaoButton, onUpdateKakaoButton, onSmartLinkPreset, onRemoveKakaoButton
}: TemplateEditorModalProps) {
    const eventPresets = EVENT_TYPE_PRESETS;
    const currentVariables = eventPresets[selectedEventType]?.variables || [];

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-white rounded-2xl overflow-hidden block">
                <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-white sticky top-0 z-10">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                            {editingTemplate ? <Save className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                        </div>
                        <DialogTitle className="text-xl font-bold text-slate-900">
                            {editingTemplate ? '템플릿 편집' : '새 템플릿 추가'}
                        </DialogTitle>
                    </div>
                    <DialogDescription className="text-slate-500 ml-11">
                        Configuring for <span className="font-bold text-indigo-600">{eventPresets[selectedEventType].label.ko}</span> event.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-8">
                    {/* Basic Info Section */}
                    <section className="space-y-4">
                        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                            <span className="w-1 h-4 bg-indigo-500 rounded-full" /> 기본 정보
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-50 p-5 rounded-xl border border-slate-100">
                            <div className="md:col-span-8 space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase">템플릿 이름 <span className="text-red-500">*</span></Label>
                                <Input
                                    placeholder="예: 등록 완료 안내"
                                    value={templateName}
                                    onChange={e => setTemplateName(e.target.value)}
                                    className="bg-white"
                                />
                            </div>
                            <div className="md:col-span-4 space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase">상태</Label>
                                <Select value={isActive ? 'active' : 'inactive'} onValueChange={v => setIsActive(v === 'active')}>
                                    <SelectTrigger className="bg-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">활성 (사용)</SelectItem>
                                        <SelectItem value="inactive">비활성 (미사용)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="md:col-span-12 space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase">관리용 설명</Label>
                                <Input
                                    placeholder="관리자를 위한 템플릿 설명"
                                    value={templateDescription}
                                    onChange={e => setTemplateDescription(e.target.value)}
                                    className="bg-white"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Email Config Section */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-2">
                                <div className="p-1 bg-emerald-100 rounded text-emerald-600"><Mail className="w-3.5 h-3.5" /></div>
                                이메일 설정
                            </h4>
                            <Badge variant="outline" className="text-xs text-slate-400 font-normal">선택사항</Badge>
                        </div>

                        <div className="bg-emerald-50/30 border border-emerald-100 p-5 rounded-xl space-y-5">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase">이메일 제목</Label>
                                <Input
                                    placeholder="예: 등록 완료 안내"
                                    value={emailSubject}
                                    onChange={e => setEmailSubject(e.target.value)}
                                    className="bg-white border-emerald-100 focus:border-emerald-300"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">이메일 본문</Label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="isHtmlEmail"
                                            checked={isHtmlEmail}
                                            onChange={e => setIsHtmlEmail(e.target.checked)}
                                            className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <Label htmlFor="isHtmlEmail" className="text-xs text-slate-500 cursor-pointer font-medium">HTML 형식 사용</Label>
                                    </div>
                                </div>
                                <Textarea
                                    placeholder="이메일 본문을 입력하세요..."
                                    value={emailBody}
                                    onChange={e => setEmailBody(e.target.value)}
                                    rows={8}
                                    className="font-mono text-sm bg-white border-emerald-100 focus:border-emerald-300 min-h-[160px]"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Kakao Config Section */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-amber-700 uppercase tracking-wide flex items-center gap-2">
                                <div className="p-1 bg-amber-100 rounded text-amber-600"><MessageCircle className="w-3.5 h-3.5" /></div>
                                알림톡 설정
                            </h4>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onFetchNhnTemplates}
                                    disabled={loadingNhn}
                                    className="h-7 text-xs border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                                >
                                    {loadingNhn ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Download className="w-3 h-3 mr-1" />}
                                    NHN Cloud 불러오기
                                </Button>

                                <Badge variant="outline" className="text-xs text-slate-400 font-normal">선택사항</Badge>
                            </div>
                        </div>

                        <div className="bg-amber-50/30 border border-amber-100 p-5 rounded-xl space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2 order-2 md:order-1">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">알림톡 내용</Label>
                                    <Textarea
                                        placeholder="알림톡 내용을 입력하세요..."
                                        value={kakaoContent}
                                        onChange={e => setKakaoContent(e.target.value)}
                                        rows={8}
                                        className="font-sans text-sm bg-white border-amber-200 focus:border-amber-400 min-h-[180px]"
                                    />
                                    <p className="text-[10px] text-slate-400 text-right">디바이스에 따라 다르게 보일 수 있습니다.</p>
                                </div>
                                <div className="space-y-4 order-1 md:order-2">
                                    <div className="bg-white p-4 rounded-lg border border-amber-200/50 shadow-sm space-y-4">
                                        <h5 className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100 pb-2">카카오 설정</h5>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-semibold text-slate-600">템플릿 코드</Label>
                                            <Input
                                                placeholder="예: 100234"
                                                value={kakaoTemplateCode}
                                                onChange={e => setKakaoTemplateCode(e.target.value)}
                                                className="bg-slate-50 h-9 text-sm font-mono"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-semibold text-slate-600">심사 상태</Label>
                                            <Select value={kakaoStatus} onValueChange={v => setKakaoStatus(v as 'PENDING' | 'APPROVED' | 'REJECTED')}>
                                                <SelectTrigger className={`h-9 text-xs font-bold ${kakaoStatus === 'APPROVED' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
                                                    kakaoStatus === 'REJECTED' ? 'text-red-600 bg-red-50 border-red-200' : 'text-slate-500 bg-slate-50'
                                                    }`}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="PENDING">대기중 (심사중)</SelectItem>
                                                    <SelectItem value="APPROVED">승인됨 (사용가능)</SelectItem>
                                                    <SelectItem value="REJECTED">반려됨 (수정필요)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* Variable Helper for Dialog */}
                                    <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Info className="w-3.5 h-3.5 text-blue-600" />
                                            <span className="text-xs font-bold text-blue-700">변수 간편 삽입</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {currentVariables.map(variable => (
                                                <button
                                                    key={variable.key}
                                                    onClick={() => insertVariable(variable.key, selectedEventType)}
                                                    className="px-2 py-1 bg-white border border-blue-200 rounded text-[11px] font-mono text-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
                                                    title={variable.label}
                                                >
                                                    #{`{${variable.key}}`}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Buttons Config */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center border-b border-amber-200/50 pb-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">버튼 설정 ({kakaoButtons.length}/5)</Label>
                                    <Button variant="outline" size="sm" onClick={onAddKakaoButton} disabled={kakaoButtons.length >= 5} className="h-7 text-xs bg-white hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300">
                                        <Plus className="w-3 h-3 mr-1" />
                                        버튼 추가
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    {kakaoButtons.length === 0 ? (
                                        <div className="text-center py-6 bg-white rounded-lg border border-dashed border-amber-200 text-slate-400 text-xs italic">
                                            추가된 버튼이 없습니다. '버튼 추가'를 눌러 링크를 연결하세요.
                                        </div>
                                    ) : (
                                        kakaoButtons.map((btn, idx) => (
                                            <div key={idx} className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded">버튼 #{idx + 1}</span>
                                                    <button onClick={() => onRemoveKakaoButton(idx)} className="text-slate-300 hover:text-red-500 transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                                                    <div className="md:col-span-3 space-y-1">
                                                        <Label className="text-[10px] font-bold text-slate-500 uppercase">버튼명</Label>
                                                        <Input
                                                            placeholder="버튼 이름"
                                                            value={btn.name}
                                                            onChange={e => onUpdateKakaoButton(idx, 'name', e.target.value)}
                                                            className="h-9 text-sm"
                                                        />
                                                    </div>
                                                    <div className="md:col-span-9 space-y-1">
                                                        <div className="flex justify-between items-center">
                                                            <Label className="text-[10px] font-bold text-slate-500 uppercase">버튼 링크 (URL)</Label>
                                                            <Select onValueChange={v => onSmartLinkPreset(idx, v)}>
                                                                <SelectTrigger className="h-6 text-[10px] w-auto border-none bg-transparent shadow-none p-0 text-indigo-600 hover:text-indigo-800 font-medium">
                                                                    <SelectValue placeholder="프리셋 적용 ▼" />
                                                                </SelectTrigger>
                                                                <SelectContent align="end">
                                                                    <SelectItem value="custom">직접 입력</SelectItem>
                                                                    <SelectItem value="landing">행사 홈페이지</SelectItem>
                                                                    <SelectItem value="qr">나의 QR 페이지</SelectItem>
                                                                    <SelectItem value="badge">디지털 명찰 (이수증)</SelectItem>
                                                                    <SelectItem value="badge-prep">배지 수령용 QR</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <Input
                                                            placeholder="https://..."
                                                            value={btn.linkMobile}
                                                            onChange={e => onUpdateKakaoButton(idx, 'linkMobile', e.target.value)}
                                                            className="h-9 text-xs font-mono text-slate-600 bg-slate-50"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <DialogFooter className="p-6 border-t border-slate-100 bg-slate-50 sticky bottom-0 z-10">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="mr-2">
                        취소
                    </Button>
                    <Button onClick={() => onSave(selectedEventType)} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[100px]">
                        <Save className="w-4 h-4 mr-2" />
                        저장하기
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
