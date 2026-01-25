import React, { useState, useEffect } from 'react';
import { useCMS } from '../../hooks/useCMS';
import { Agenda, Speaker } from '../../types/schema';
import { Timestamp, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ImageUpload from '../../components/ui/ImageUpload';
import toast from 'react-hot-toast';
import { Plus, Save, User, MapPin, Clock, ExternalLink, Trash2 } from 'lucide-react';
import { useAdminStore } from '../../store/adminStore';

const AgendaManager: React.FC = () => {
    const { selectedConferenceId: confId } = useAdminStore();
    const { saveAgenda, saveSpeaker, deleteAgenda, deleteSpeaker, loading, error } = useCMS(confId || '');

    const [agendas, setAgendas] = useState<Agenda[]>([]);
    const [selectedAgendaId, setSelectedAgendaId] = useState<string | null>(null);
    const [speakers, setSpeakers] = useState<Speaker[]>([]);
    
    // Form States
    const [agendaForm, setAgendaForm] = useState<Partial<Agenda>>({});
    const [speakerForm, setSpeakerForm] = useState<Partial<Speaker>>({});
    const [uploading, setUploading] = useState(false);
    const [sessionType, setSessionType] = useState<string>('');

    useEffect(() => {
        if (!confId) return;
        fetchAgendas();
    }, [confId]);

    useEffect(() => {
        if (selectedAgendaId && confId) {
            fetchSpeakers(selectedAgendaId);
            // Pre-fill agenda form
            const selected = agendas.find(a => a.id === selectedAgendaId);
            if (selected) {
                setAgendaForm({ ...selected });
                setSessionType(selected.sessionType || '');
            }
        } else {
            setSpeakers([]);
            setAgendaForm({});
            setSessionType('');
        }
    }, [selectedAgendaId, agendas, confId]);

    const fetchAgendas = async () => {
        if (!confId) return;
        const agRef = collection(db, `conferences/${confId}/agendas`);
        const agSnap = await getDocs(agRef);
        const list = agSnap.docs.map(d => ({ id: d.id, ...d.data() } as Agenda));
        list.sort((a, b) => a.startTime.seconds - b.startTime.seconds);
        setAgendas(list);
    };

    const fetchSpeakers = async (agendaId: string) => {
        if (!confId) return;
        const spRef = collection(db, `conferences/${confId}/speakers`);
        const q = query(spRef, where('agendaId', '==', agendaId));
        const spSnap = await getDocs(q);
        setSpeakers(spSnap.docs.map(d => ({ id: d.id, ...d.data() } as Speaker)));
    };

    const handleSaveAgenda = async () => {
        if (!agendaForm.title?.ko || !agendaForm.startTime || !agendaForm.endTime) {
            return toast.error("Please fill required agenda fields");
        }
        
        await saveAgenda({
            ...agendaForm,
            sessionType // Ensure sessionType is synced
        } as any, agendaForm.id); // Pass ID to update instead of create
        
        toast.success("Agenda Saved");
        if (!agendaForm.id) {
             setAgendaForm({});
             setSelectedAgendaId(null);
        }
        fetchAgendas();
    };

    const handleDeleteAgenda = async () => {
        if (!selectedAgendaId) return;
        if (!window.confirm("Are you sure you want to delete this session? All associated speakers should be deleted manually.")) return;

        await deleteAgenda(selectedAgendaId);
        toast.success("Agenda Deleted");
        setSelectedAgendaId(null);
        setAgendaForm({});
        fetchAgendas();
    };

    const handleSaveSpeaker = async () => {
        if (!selectedAgendaId) return toast.error("No agenda selected");
        if (!speakerForm.name?.ko) return toast.error("Speaker name required");

        const speakerData = {
            ...speakerForm,
            agendaId: selectedAgendaId,
            // Ensure photoUrl is explicitly set to empty string if missing, to override existing value
            photoUrl: speakerForm.photoUrl || "" 
        };

        await saveSpeaker(speakerData as any, speakerForm.id); // Pass ID to update instead of create

        toast.success("Speaker Saved");
        setSpeakerForm({});
        fetchSpeakers(selectedAgendaId);
    };

    const handleDeleteSpeaker = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!window.confirm("Delete this speaker?")) return;
        
        try {
            await deleteSpeaker(id);
            toast.success("Speaker Deleted");
            
            if (selectedAgendaId) {
                fetchSpeakers(selectedAgendaId);
            }
            
            // Clear form if deleted speaker was selected
            if (speakerForm.id === id) {
                setSpeakerForm({});
            }
        } catch (err: any) {
            console.error("Delete failed:", err);
            toast.error("Failed to delete speaker");
        }
    };

    const handleImageUploadComplete = (url: string) => {
        // Explicitly handle empty string for deletion
        setSpeakerForm(prev => ({ ...prev, photoUrl: url }));
        if (url) {
            toast.success("Photo Uploaded");
        } else {
            toast.success("Photo Removed");
        }
    };

    // Date helpers
    const toInputString = (ts: any) => {
        if (!ts) return '';
        if (ts.seconds) return new Date(ts.seconds * 1000).toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
        return ts; // already string?
    };

    const fromInputString = (str: string) => {
        return Timestamp.fromDate(new Date(str));
    };

    if (!confId) {
        return (
            <div className="h-[calc(100vh-100px)] flex items-center justify-center p-6">
                <div className="text-center">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 max-w-md">
                        <h2 className="text-xl font-semibold text-blue-800 mb-4">
                            컨퍼런스를 선택해주세요
                        </h2>
                        <p className="text-blue-600">
                            사이드바에서 관리할 컨퍼런스를 선택한 후 아젠다를 관리할 수 있습니다.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-100px)] flex gap-6 p-6">
            {/* Left Panel: Agendas */}
            <div className="w-1/3 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold">Agendas</h2>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => {
                            const societyId = confId?.split('_')[0];
                            const conferenceSlug = confId?.split('_')[1];
                            if (societyId && conferenceSlug) {
                                window.open(`https://${societyId}.eregi.co.kr/${conferenceSlug}/program`, '_blank');
                            }
                        }}>
                            <ExternalLink className="w-4 h-4 mr-2" /> Preview
                        </Button>
                        <Button size="sm" onClick={() => { setSelectedAgendaId(null); setAgendaForm({}); }}>
                            <Plus className="w-4 h-4 mr-2" /> New
                        </Button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {agendas.map(agenda => (
                        <div 
                            key={agenda.id} 
                            onClick={() => setSelectedAgendaId(agenda.id)}
                            className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedAgendaId === agenda.id ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white hover:bg-slate-50'}`}
                        >
                            <h3 className="font-semibold text-slate-900">{agenda.title.ko}</h3>
                            <div className="flex items-center text-xs text-slate-500 mt-2 gap-3">
                                <span className="flex items-center"><Clock className="w-3 h-3 mr-1"/> {new Date(agenda.startTime.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                <span className="flex items-center"><MapPin className="w-3 h-3 mr-1"/> {agenda.location || 'No Location'}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Agenda Form */}
                <Card className="bg-slate-50 border-t-2 border-t-blue-500">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm">Edit Agenda</CardTitle>
                        {selectedAgendaId && (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={handleDeleteAgenda}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Input 
                            placeholder="Title (Korean)" 
                            value={agendaForm.title?.ko || ''} 
                            onChange={e => setAgendaForm(prev => ({ ...prev, title: { ...prev.title, ko: e.target.value, en: prev.title?.en || '' } }))}
                        />
                        <Input 
                            placeholder="Location" 
                            value={agendaForm.location || ''} 
                            onChange={e => setAgendaForm(prev => ({ ...prev, location: e.target.value }))}
                        />
                        <div className="space-y-2">
                            <Label className="text-xs">Session Type</Label>
                            <select 
                                value={sessionType}
                                onChange={e => {
                                    setSessionType(e.target.value);
                                    setAgendaForm(prev => ({ ...prev, sessionType: e.target.value }));
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            >
                                <option value="">Select Type</option>
                                <option value="keynote">Keynote</option>
                                <option value="symposium">Symposium</option>
                                <option value="oral">Oral</option>
                                <option value="break">Break</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label className="text-xs">Start</Label>
                                <Input 
                                    type="datetime-local" 
                                    value={toInputString(agendaForm.startTime)} 
                                    onChange={e => setAgendaForm(prev => ({ ...prev, startTime: fromInputString(e.target.value) }))}
                                />
                            </div>
                            <div>
                                <Label className="text-xs">End</Label>
                                <Input 
                                    type="datetime-local" 
                                    value={toInputString(agendaForm.endTime)} 
                                    onChange={e => setAgendaForm(prev => ({ ...prev, endTime: fromInputString(e.target.value) }))}
                                />
                            </div>
                        </div>
                        <Button size="sm" className="w-full" onClick={handleSaveAgenda} disabled={loading}>
                            <Save className="w-4 h-4 mr-2" /> 아젠다 저장
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Right Panel: Speakers */}
            <div className="w-2/3 flex flex-col gap-4 bg-white rounded-lg border p-6 shadow-sm">
                {!selectedAgendaId ? (
                    <div className="h-full flex items-center justify-center text-slate-400">
                        연자 관리할 아젠다를 선택하세요
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center border-b pb-4">
                            <h2 className="text-xl font-bold flex items-center">
                                <User className="w-5 h-5 mr-2" /> Speakers
                            </h2>
                            <Button size="sm" variant="outline" onClick={() => setSpeakerForm({})}>폼 초기화 (New Speaker)</Button>
                        </div>

                        <div className="flex gap-6 h-full">
                            {/* List of Speakers */}
                            <div className="w-1/3 overflow-y-auto border-r pr-4 space-y-2">
                                {speakers.length === 0 && <p className="text-sm text-slate-400 text-center py-4">아직 연자가 없습니다.</p>}
                                {speakers.map(sp => (
                                    <div 
                                        key={sp.id} 
                                        onClick={() => setSpeakerForm(sp)}
                                        className={`flex items-center gap-3 p-3 rounded cursor-pointer border transition-all relative group ${speakerForm.id === sp.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-50 border-transparent'}`}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
                                            {sp.photoUrl ? <img src={sp.photoUrl} alt="" className="w-full h-full object-cover"/> : <User className="w-6 h-6 m-2 text-slate-400"/>}
                                        </div>
                                        <div className="overflow-hidden flex-1">
                                            <p className="font-medium truncate text-sm">{sp.name.ko}</p>
                                            <p className="text-xs text-slate-500 truncate">{sp.organization}</p>
                                        </div>
                                        <button 
                                            onClick={(e) => handleDeleteSpeaker(e, sp.id)}
                                            className="opacity-0 group-hover:opacity-100 absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-opacity"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Speaker Form */}
                            <div className="w-2/3 space-y-4 overflow-y-auto pr-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Name (KR)</Label>
                                        <Input 
                                            value={speakerForm.name?.ko || ''} 
                                            onChange={e => setSpeakerForm(prev => ({ ...prev, name: { ...prev.name, ko: e.target.value, en: prev.name?.en || '' } }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Name (EN)</Label>
                                        <Input 
                                            value={speakerForm.name?.en || ''} 
                                            onChange={e => setSpeakerForm(prev => ({ ...prev, name: { ...prev.name, en: e.target.value, ko: prev.name?.ko || '' } }))}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Affiliation (소속)</Label>
                                    <Input 
                                        value={speakerForm.organization || ''} 
                                        onChange={e => setSpeakerForm(prev => ({ ...prev, organization: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Session Time (e.g. 10:00 - 10:20)</Label>
                                    <Input 
                                        placeholder="Time string (optional)"
                                        value={speakerForm.sessionTime || ''} 
                                        onChange={e => setSpeakerForm(prev => ({ ...prev, sessionTime: e.target.value }))}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Lecture Title (KR)</Label>
                                        <Input 
                                            value={speakerForm.presentationTitle?.ko || ''} 
                                            onChange={e => setSpeakerForm(prev => ({ ...prev, presentationTitle: { ...prev.presentationTitle, ko: e.target.value, en: prev.presentationTitle?.en || '' } }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Lecture Title (EN)</Label>
                                        <Input 
                                            value={speakerForm.presentationTitle?.en || ''} 
                                            onChange={e => setSpeakerForm(prev => ({ ...prev, presentationTitle: { ...prev.presentationTitle, en: e.target.value, ko: prev.presentationTitle?.ko || '' } }))}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Abstract Link (URL)</Label>
                                    <Input 
                                        placeholder="https://..."
                                        value={speakerForm.abstractUrl || ''} 
                                        onChange={e => setSpeakerForm(prev => ({ ...prev, abstractUrl: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Bio (Biography)</Label>
                                    <Textarea 
                                        value={speakerForm.bio?.ko || ''} 
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSpeakerForm(prev => ({ ...prev, bio: { ...prev.bio, ko: e.target.value, en: prev.bio?.en || '' } }))}
                                        rows={3}
                                    />
                                </div>

                                <div className="space-y-2 mb-6">
                                    <Label>Photo</Label>
                                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                        <ImageUpload
                                            key={speakerForm.id || 'new'} 
                                            path={`conferences/${confId}/speakers`}
                                            onUploadComplete={handleImageUploadComplete}
                                            previewUrl={speakerForm.photoUrl}
                                            className="h-32"
                                        />
                                        <p className="text-xs text-slate-400 mt-2 text-center">
                                            Click 'X' on the image to remove. (Updates immediately on Save)
                                        </p>
                                    </div>
                                </div>

                                <Button className="w-full mt-8" onClick={handleSaveSpeaker} disabled={loading || uploading}>
                                    {loading || uploading ? <LoadingSpinner /> : (speakerForm.id ? '연자 수정 (Update)' : '연자 추가 (Add)')}
                                </Button>
                                <div className="h-4" /> {/* Extra spacing at bottom */}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AgendaManager;