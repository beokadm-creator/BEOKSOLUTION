import React, { useState, useEffect } from 'react';
import { useCMS } from '../../hooks/useCMS';
import { Agenda, Speaker } from '../../types/schema';
import { Timestamp, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent } from '../../components/ui/card';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ImageUpload from '../../components/ui/ImageUpload';
import BilingualInput from '../../components/ui/bilingual-input';
import toast from 'react-hot-toast';
import { Plus, Save, User, MapPin, Clock, ExternalLink, Trash2, Calendar, Mic2, LayoutList, ChevronRight } from 'lucide-react';
import { useAdminStore } from '../../store/adminStore';
import { cn } from '../../lib/utils';

const AgendaManager: React.FC = () => {
    const { selectedConferenceId: confId } = useAdminStore();
    const { saveAgenda, saveSpeaker, deleteAgenda, deleteSpeaker, loading } = useCMS(confId || '');

    const [agendas, setAgendas] = useState<Agenda[]>([]);
    const [selectedAgendaId, setSelectedAgendaId] = useState<string | null>(null);
    const [speakers, setSpeakers] = useState<Speaker[]>([]);

    // Form States
    const [agendaForm, setAgendaForm] = useState<Partial<Agenda>>({});
    const [speakerForm, setSpeakerForm] = useState<Partial<Speaker>>({});
    const [sessionType, setSessionType] = useState<string>('');

    useEffect(() => {
        if (!confId) return;
        const fetchAgendas = async () => {
            const agRef = collection(db, `conferences/${confId}/agendas`);
            const agSnap = await getDocs(agRef);
            const list = agSnap.docs.map(d => ({ id: d.id, ...d.data() } as Agenda));
            list.sort((a, b) => a.startTime.seconds - b.startTime.seconds);
            setAgendas(list);
        };
        fetchAgendas();
    }, [confId]);

    useEffect(() => {
        const fetchSpeakers = async () => {
            if (!confId) return;
            if (selectedAgendaId) {
                const spRef = collection(db, `conferences/${confId}/speakers`);
                const q = query(spRef, where('agendaId', '==', selectedAgendaId));
                const spSnap = await getDocs(q);
                setSpeakers(spSnap.docs.map(d => ({ id: d.id, ...d.data() } as Speaker)));
            } else {
                setSpeakers([]);
            }
        };
        fetchSpeakers();
    }, [confId, selectedAgendaId]);

    useEffect(() => {
        if (selectedAgendaId && confId) {
            const selected = agendas.find(a => a.id === selectedAgendaId);
            if (selected) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setAgendaForm({ ...selected });
                 
                setSessionType(selected.sessionType || '');
            }
        } else {
            setAgendaForm({});
            setSessionType('');
        }
    }, [selectedAgendaId, agendas, confId]);

    const handleCreateNew = () => {
        setSelectedAgendaId(null);
        setAgendaForm({});
        setSessionType('');
        setSpeakers([]);
    };

    const handleSaveAgenda = async () => {
        if (!agendaForm.title?.ko || !agendaForm.startTime || !agendaForm.endTime) {
            return toast.error("필수 정보를 입력해주세요 (제목, 시작/종료 시간)");
        }

        await saveAgenda({
            ...agendaForm,
            sessionType
        } as Partial<Agenda>, agendaForm.id);

        toast.success(agendaForm.id ? "세션 정보가 수정되었습니다." : "새 세션이 생성되었습니다.");
        if (!agendaForm.id) {
            setAgendaForm({});
            // Ideally we should select the new agenda, but simplified for now
        }
        fetchAgendas();
    };

    const handleDeleteAgenda = async () => {
        if (!selectedAgendaId) return;
        if (!window.confirm("정말 이 세션을 삭제하시겠습니까? 연결된 연자 정보도 함께 정리해야 할 수 있습니다.")) return;

        await deleteAgenda(selectedAgendaId);
        toast.success("세션이 삭제되었습니다.");
        handleCreateNew();
        fetchAgendas();
    };

    const handleSaveSpeaker = async () => {
        if (!selectedAgendaId) return toast.error("세션을 먼저 저장하거나 선택해주세요.");
        if (!speakerForm.name?.ko) return toast.error("연자 이름은 필수입니다.");

        const speakerData = {
            ...speakerForm,
            agendaId: selectedAgendaId,
            // Ensure photoUrl is explicitly set to empty string if missing, to override existing value
            photoUrl: speakerForm.photoUrl || ""
        };

        await saveSpeaker(speakerData as Omit<Speaker, 'id'>, speakerForm.id); // Pass ID to update instead of create

        toast.success("연자 정보가 저장되었습니다.");
        setSpeakerForm({});
        fetchSpeakers(selectedAgendaId);
    };

    const handleDeleteSpeaker = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!window.confirm("이 연자를 삭제하시겠습니까?")) return;

        try {
            await deleteSpeaker(id);
            toast.success("연자가 삭제되었습니다.");

            if (selectedAgendaId) {
                fetchSpeakers(selectedAgendaId);
            }

            // Clear form if deleted speaker was selected
            if (speakerForm.id === id) {
                setSpeakerForm({});
            }
        } catch (err) {
            console.error("Delete failed:", err);
            toast.error("삭제 실패");
        }
    };

    const handleImageUploadComplete = (url: string) => {
        setSpeakerForm(prev => ({ ...prev, photoUrl: url }));
        if (url) {
            toast.success("사진이 업로드되었습니다.");
        } else {
            toast.success("사진이 삭제되었습니다.");
        }
    };

    // Date helpers
    const toInputString = (ts: unknown): string => {
        if (!ts) return '';
        if (ts && typeof ts === 'object' && 'seconds' in ts) {
            const date = new Date((ts as { seconds: number }).seconds * 1000);
            const offset = date.getTimezoneOffset() * 60000;
            const localDate = new Date(date.getTime() - offset);
            return localDate.toISOString().slice(0, 16);
        }
        if (ts instanceof Date) {
            const offset = ts.getTimezoneOffset() * 60000;
            const localDate = new Date(ts.getTime() - offset);
            return localDate.toISOString().slice(0, 16);
        }
        return String(ts);
    };

    const fromInputString = (str: string) => {
        return Timestamp.fromDate(new Date(str));
    };

    // Derived states
    const isNewSession = !selectedAgendaId;

    if (!confId) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="text-center space-y-3">
                    <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
                    <h2 className="text-xl font-semibold text-slate-800">행사 선택 필요</h2>
                    <p className="text-slate-500">사이드바에서 관리할 컨퍼런스를 선택해주세요.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-[calc(100vh-64px)] overflow-hidden flex flex-col bg-slate-50/50">
            {/* 1. Header Area - Sticky */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm z-20">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                        <LayoutList className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">아젠다 관리</h1>
                        <p className="text-xs text-slate-500">세션 및 연자 정보를 구성합니다.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            const societyId = confId?.split('_')[0];
                            const conferenceSlug = confId?.split('_')[1];
                            if (societyId && conferenceSlug) {
                                window.open(`https://${societyId}.eregi.co.kr/${conferenceSlug}/program`, '_blank');
                            }
                        }}
                        className="text-slate-600 hover:text-blue-600"
                    >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        미리보기
                    </Button>
                </div>
            </div>

            {/* 2. Main Layout (Split Pane) */}
            <div className="flex-1 flex overflow-hidden">

                {/* [Left Pane] Agendas List */}
                <div className="w-[320px] md:w-[380px] bg-white border-r border-slate-200 flex flex-col z-10 transition-all">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <h3 className="font-semibold text-slate-700">All Sessions ({agendas.length})</h3>
                        <Button size="sm" onClick={handleCreateNew} variant={isNewSession ? "default" : "outline"} className="h-8">
                            <Plus className="w-4 h-4 mr-1.5" />
                            New
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {agendas.map(agenda => (
                            <div
                                key={agenda.id}
                                onClick={() => setSelectedAgendaId(agenda.id)}
                                className={cn(
                                    "p-4 rounded-xl border transition-all cursor-pointer group hover:shadow-md",
                                    selectedAgendaId === agenda.id
                                        ? "bg-blue-50 border-blue-500 shadow-sm ring-1 ring-blue-500/20"
                                        : "bg-white border-slate-200 hover:border-blue-300"
                                )}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={cn(
                                        "text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide",
                                        agenda.sessionType === 'break' ? "bg-slate-100 text-slate-600" :
                                            agenda.sessionType === 'keynote' ? "bg-purple-100 text-purple-700" :
                                                "bg-blue-100 text-blue-700"
                                    )}>
                                        {agenda.sessionType || 'Session'}
                                    </span>
                                </div>
                                <h4 className={cn(
                                    "font-bold text-sm leading-snug mb-3 line-clamp-2",
                                    selectedAgendaId === agenda.id ? "text-blue-900" : "text-slate-800"
                                )}>
                                    {agenda.title.ko || '제목 없음'}
                                </h4>
                                <div className="space-y-1">
                                    <div className="flex items-center text-xs text-slate-500">
                                        <Clock className="w-3.5 h-3.5 mr-1.5 opacity-70" />
                                        {new Date(agenda.startTime.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        <span className="mx-1">-</span>
                                        {new Date(agenda.endTime.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <div className="flex items-center text-xs text-slate-500">
                                        <MapPin className="w-3.5 h-3.5 mr-1.5 opacity-70" />
                                        {agenda.location || '장소 미정'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* [Right Pane] Workspace */}
                <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8">
                    <div className="max-w-5xl mx-auto space-y-8 pb-20">

                        {/* 1. Session Info Card */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-blue-600" />
                                    세션 상세 정보 {isNewSession && <span className="text-blue-500 text-sm font-normal">(새 세션 작성 중)</span>}
                                </h2>
                                {!isNewSession && (
                                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handleDeleteAgenda}>
                                        <Trash2 className="w-4 h-4 mr-1.5" /> 세션 삭제
                                    </Button>
                                )}
                            </div>

                            <Card className="border-0 shadow-sm ring-1 ring-slate-200">
                                <CardContent className="p-6 md:p-8 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label>세션 타입</Label>
                                            <select
                                                value={sessionType}
                                                onChange={e => {
                                                    setSessionType(e.target.value);
                                                    setAgendaForm(prev => ({ ...prev, sessionType: e.target.value }));
                                                }}
                                                className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                            >
                                                <option value="">타입 선택</option>
                                                <option value="keynote">Keynote / Plenary</option>
                                                <option value="symposium">Symposium</option>
                                                <option value="oral">Oral Session</option>
                                                <option value="poster">Poster Session</option>
                                                <option value="break">Break / Lunch</option>
                                                <option value="ceremony">Ceremony</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>장소</Label>
                                            <Input
                                                value={agendaForm.location || ''}
                                                onChange={e => setAgendaForm(prev => ({ ...prev, location: e.target.value }))}
                                                placeholder="예: Room A (Grand Ballroom)"
                                                className="bg-white"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <BilingualInput
                                            label="세션 제목 (Session Title)"
                                            valueKO={agendaForm.title?.ko || ''}
                                            valueEN={agendaForm.title?.en || ''}
                                            onChangeKO={v => setAgendaForm(prev => ({ ...prev, title: { ...prev.title, ko: v, en: prev.title?.en || '' } }))}
                                            onChangeEN={v => setAgendaForm(prev => ({ ...prev, title: { ...prev.title, en: v, ko: prev.title?.ko || '' } }))}
                                            placeholderKO="세션 제목을 입력하세요"
                                            placeholderEN="Enter session title"
                                        />

                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>시작 시간</Label>
                                                <Input
                                                    type="datetime-local"
                                                    value={toInputString(agendaForm.startTime)}
                                                    onChange={e => setAgendaForm(prev => ({ ...prev, startTime: fromInputString(e.target.value) }))}
                                                    className="bg-white"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>종료 시간</Label>
                                                <Input
                                                    type="datetime-local"
                                                    value={toInputString(agendaForm.endTime)}
                                                    onChange={e => setAgendaForm(prev => ({ ...prev, endTime: fromInputString(e.target.value) }))}
                                                    className="bg-white"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-4 border-t border-slate-100">
                                        <Button onClick={handleSaveAgenda} disabled={loading} className="w-full md:w-auto min-w-[120px]">
                                            <Save className="w-4 h-4 mr-2" />
                                            {isNewSession ? '세션 생성' : '변경사항 저장'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* 2. Speakers Section (Visible only if session exists) */}
                        {!isNewSession && (
                            <div className="space-y-4 pt-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <Mic2 className="w-5 h-5 text-purple-600" />
                                        참여 연자 및 좌장
                                    </h2>
                                    <div className="text-sm text-slate-500">
                                        총 {speakers.length}명 등록됨
                                    </div>
                                </div>

                                <Card className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden">
                                    {/* Split layout for speakers: List | Form */}
                                    <div className="flex flex-col lg:flex-row h-[800px] lg:h-[750px]">

                                        {/* Speakers List */}
                                        <div className="lg:w-1/3 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/30 flex flex-col">
                                            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                                                <span className="font-semibold text-sm text-slate-700">연자 목록</span>
                                                <Button size="sm" variant="ghost" onClick={() => setSpeakerForm({})} className="text-xs h-7 px-2">
                                                    <Plus className="w-3 h-3 mr-1" /> 추가 (Reset)
                                                </Button>
                                            </div>
                                            <div className="p-3 space-y-2 overflow-y-auto flex-1">
                                                {speakers.length === 0 && (
                                                    <div className="text-center py-8 text-slate-400 text-sm">
                                                        등록된 연자가 없습니다.<br />새 연자를 추가해주세요.
                                                    </div>
                                                )}
                                                {speakers.map(sp => (
                                                    <div
                                                        key={sp.id}
                                                        onClick={() => setSpeakerForm(sp)}
                                                        className={cn(
                                                            "flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all relative group",
                                                            speakerForm.id === sp.id
                                                                ? "bg-white border-blue-500 shadow-sm ring-1 ring-blue-500/10"
                                                                : "bg-white border-slate-200 hover:border-blue-300"
                                                        )}
                                                    >
                                                        <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0">
                                                            {sp.photoUrl ? (
                                                                <img src={sp.photoUrl} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <User className="w-5 h-5 m-2.5 text-slate-300" />
                                                            )}
                                                        </div>
                                                        <div className="overflow-hidden flex-1 min-w-0">
                                                            <div className="font-semibold text-sm text-slate-900 truncate">{sp.name.ko}</div>
                                                            <div className="text-xs text-slate-500 truncate">{sp.organization || '소속 없음'}</div>
                                                        </div>
                                                        {speakerForm.id === sp.id && (
                                                            <ChevronRight className="w-4 h-4 text-blue-500" />
                                                        )}
                                                        <button
                                                            onClick={(e) => handleDeleteSpeaker(e, sp.id)}
                                                            className="opacity-0 group-hover:opacity-100 absolute right-2 top-2 p-1.5 bg-white text-red-500 border border-red-100 rounded-full hover:bg-red-50 hover:border-red-200 shadow-sm"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Speaker Edit Form */}
                                        <div className="lg:w-2/3 p-6 overflow-y-auto bg-white">
                                            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
                                                <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                                                    {speakerForm.id ? <User className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-800">
                                                        {speakerForm.id ? '연자 정보 수정' : '새 연자 추가'}
                                                    </h3>
                                                    <p className="text-xs text-slate-400">사진과 상세 약력을 입력할 수 있습니다.</p>
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                <div className="flex flex-col xl:flex-row gap-6">
                                                    <div className="w-32 flex-shrink-0">
                                                        <div className="space-y-2">
                                                            <Label>프로필 사진</Label>
                                                            <div className="bg-slate-50 p-2 rounded-xl border border-dashed border-slate-300">
                                                                <ImageUpload
                                                                    key={speakerForm.id || 'new'}
                                                                    path={`conferences/${confId}/speakers`}
                                                                    onUploadComplete={handleImageUploadComplete}
                                                                    previewUrl={speakerForm.photoUrl}
                                                                    className="h-28 w-28 mx-auto rounded-lg object-cover"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex-1 space-y-4">
                                                        <BilingualInput
                                                            label="이름 (Name)"
                                                            valueKO={speakerForm.name?.ko || ''}
                                                            valueEN={speakerForm.name?.en || ''}
                                                            onChangeKO={v => setSpeakerForm(prev => ({ ...prev, name: { ...prev.name, ko: v, en: prev.name?.en || '' } }))}
                                                            onChangeEN={v => setSpeakerForm(prev => ({ ...prev, name: { ...prev.name, en: v, ko: prev.name?.ko || '' } }))}
                                                            placeholderKO="홍길동"
                                                            placeholderEN="Gil Dong Hong"
                                                        />
                                                        <div className="space-y-2">
                                                            <Label>소속 (Affiliation)</Label>
                                                            <Input
                                                                value={speakerForm.organization || ''}
                                                                onChange={e => setSpeakerForm(prev => ({ ...prev, organization: e.target.value }))}
                                                                placeholder="예: 한국대학교병원"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <hr className="border-slate-50" />

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>발표 시간 (Time Slot)</Label>
                                                        <Input
                                                            placeholder="예: 10:00 - 10:20"
                                                            value={speakerForm.sessionTime || ''}
                                                            onChange={e => setSpeakerForm(prev => ({ ...prev, sessionTime: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>초록 링크 (URL)</Label>
                                                        <Input
                                                            placeholder="https://..."
                                                            value={speakerForm.abstractUrl || ''}
                                                            onChange={e => setSpeakerForm(prev => ({ ...prev, abstractUrl: e.target.value }))}
                                                        />
                                                    </div>
                                                </div>

                                                <BilingualInput
                                                    label="강의 제목 (Lecture Title)"
                                                    valueKO={speakerForm.presentationTitle?.ko || ''}
                                                    valueEN={speakerForm.presentationTitle?.en || ''}
                                                    onChangeKO={v => setSpeakerForm(prev => ({ ...prev, presentationTitle: { ...prev.presentationTitle, ko: v, en: prev.presentationTitle?.en || '' } }))}
                                                    onChangeEN={v => setSpeakerForm(prev => ({ ...prev, presentationTitle: { ...prev.presentationTitle, en: v, ko: prev.presentationTitle?.ko || '' } }))}
                                                    placeholderKO="강의 제목을 입력하세요"
                                                />

                                                <div className="space-y-2">
                                                    <Label>약력 (Biography)</Label>
                                                    <Textarea
                                                        value={speakerForm.bio?.ko || ''}
                                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSpeakerForm(prev => ({ ...prev, bio: { ...prev.bio, ko: e.target.value, en: prev.bio?.en || '' } }))}
                                                        rows={3}
                                                        placeholder="주요 약력을 입력하세요."
                                                        className="resize-none"
                                                    />
                                                </div>

                                                <div className="pt-2">
                                                    <Button className="w-full" onClick={handleSaveSpeaker} disabled={loading}>
                                                        {loading ? <LoadingSpinner /> : (speakerForm.id ? '연자 정보 수정 (Update)' : '목록에 연자 추가 (Add)')}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default AgendaManager;