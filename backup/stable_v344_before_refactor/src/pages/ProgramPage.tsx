import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useConference } from '../hooks/useConference';
import { useUserStore } from '../store/userStore';
import { safeText } from '../utils/safeText';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Button } from '../components/ui/button';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle 
} from '../components/ui/dialog';
import { ChevronLeft, MapPin, Clock, User } from 'lucide-react';
import { Agenda, Speaker } from '../types/schema';
import { format } from 'date-fns';

const ProgramPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { info, agendas, speakers, loading, error } = useConference();
    const { language } = useUserStore();

    // Bio Modal State
    const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null);

    // Group agendas by date
    const groupedAgendas = useMemo(() => {
        if (!agendas) return {};

        const groups: Record<string, Agenda[]> = {};
        
        agendas.forEach(agenda => {
            if (!agenda.startTime) return;
            const date = new Date(agenda.startTime.seconds * 1000);
            const dateKey = format(date, 'yyyy-MM-dd'); // e.g. 2026-05-20
            
            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(agenda);
        });

        // Sort items by time within each group
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => a.startTime.seconds - b.startTime.seconds);
        });

        return groups;
    }, [agendas]);

    // Sort dates
    const sortedDates = Object.keys(groupedAgendas).sort();

    if (loading) return <LoadingSpinner />;
    if (error) return <div className="p-8 text-center text-red-500">Error loading program: {error}</div>;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-900">
             {/* Header */}
             <header className="sticky top-0 w-full bg-white/90 backdrop-blur-md border-b z-50">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => navigate(`/${slug}`)}
                        className="text-slate-600 hover:text-blue-600 pl-0"
                    >
                        <ChevronLeft className="w-5 h-5 mr-1" />
                        {language === 'ko' ? '홈으로' : 'Home'}
                    </Button>
                    <div className="font-bold text-lg text-slate-900 truncate max-w-[200px]">
                        {info ? safeText(info.title) : 'Conference'}
                    </div>
                    <div className="w-10" /> {/* Spacer for centering */}
                </div>
            </header>

            <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
                <h1 className="text-3xl font-bold mb-8 text-center">
                    {language === 'ko' ? '프로그램' : 'Program'}
                </h1>

                {sortedDates.length === 0 ? (
                    <div className="text-center text-gray-500 py-12 bg-white rounded-xl border border-gray-100 shadow-sm">
                        {language === 'ko' ? '등록된 일정이 없습니다.' : 'No sessions scheduled yet.'}
                    </div>
                ) : (
                    <div className="space-y-12">
                        {sortedDates.map(dateKey => {
                            const dayAgendas = groupedAgendas[dateKey];
                            const dateObj = new Date(dayAgendas[0].startTime.seconds * 1000);
                            
                            return (
                                <div key={dateKey} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-800 border-b pb-2 border-blue-100">
                                        <div className="bg-blue-100 text-blue-700 p-2 rounded-lg">
                                            {format(dateObj, 'MMM d')}
                                        </div>
                                        <span>{format(dateObj, 'EEEE')}</span>
                                    </h2>
                                    
                                    <div className="space-y-4">
                                        {dayAgendas.map(agenda => {
                                            const start = new Date(agenda.startTime.seconds * 1000);
                                            const end = new Date(agenda.endTime.seconds * 1000);
                                            const sessionSpeakers = speakers.filter(s => s.agendaId === agenda.id);
                                            
                                            return (
                                                <div key={agenda.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="flex flex-col md:flex-row gap-4">
                                                        {/* Time Column */}
                                                        <div className="md:w-32 flex-shrink-0 flex flex-row md:flex-col items-center md:items-start gap-2 text-slate-500 font-medium text-sm">
                                                            <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                                                <Clock className="w-3.5 h-3.5" />
                                                                {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Content Column */}
                                                        <div className="flex-1">
                                                            {agenda.sessionType && (
                                                                <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-600 mb-2 border border-indigo-100">
                                                                    {agenda.sessionType.toUpperCase()}
                                                                </span>
                                                            )}
                                                            <h3 className="text-lg font-bold text-slate-900 mb-2">
                                                                {safeText(agenda.title)}
                                                            </h3>
                                                            {agenda.description && (
                                                                <p className="text-slate-600 text-sm mb-3 leading-relaxed">
                                                                    {safeText(agenda.description)}
                                                                </p>
                                                            )}
                                                            
                                                            {agenda.location && (
                                                                <div className="flex items-center gap-1 text-xs text-slate-500 mt-2 mb-3">
                                                                    <MapPin className="w-3.5 h-3.5" />
                                                                    {agenda.location}
                                                                </div>
                                                            )}

                                                            {/* Speakers List */}
                                                            {sessionSpeakers.length > 0 && (
                                                                <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                                                                    {sessionSpeakers.map(speaker => (
                                                                         <div 
                                                                             key={speaker.id} 
                                                                             className="flex flex-col md:flex-row items-start gap-4 cursor-pointer hover:bg-slate-50 p-3 rounded-lg transition-colors group border border-transparent hover:border-slate-100"
                                                                             onClick={() => setSelectedSpeaker(speaker)}
                                                                         >
                                                                             {/* Time Column (Left) */}
                                                                             {speaker.sessionTime && (
                                                                                 <div className="md:w-24 flex-shrink-0 pt-1">
                                                                                     <span className="inline-block px-2 py-1 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                                                                         {speaker.sessionTime}
                                                                                     </span>
                                                                                 </div>
                                                                             )}

                                                                             {/* Content Column (Center/Right) */}
                                                                             <div className="flex-1">
                                                                                 {/* Lecture Title */}
                                                                                 {speaker.presentationTitle ? (
                                                                                     <h4 className="font-bold text-slate-900 text-lg mb-2 group-hover:text-blue-700 transition-colors leading-tight">
                                                                                         {safeText(speaker.presentationTitle)}
                                                                                     </h4>
                                                                                 ) : (
                                                                                     <h4 className="font-bold text-slate-400 text-sm mb-2 italic">
                                                                                         {language === 'ko' ? '제목 미정' : 'Title TBD'}
                                                                                     </h4>
                                                                                 )}
                                                                                 
                                                                                 {/* Speaker Info */}
                                                                                 <div className="flex items-center gap-3">
                                                                                     <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                                                                         {speaker.photoUrl ? (
                                                                                             <img src={speaker.photoUrl} alt={safeText(speaker.name)} className="w-full h-full object-cover" />
                                                                                         ) : (
                                                                                             <User className="w-5 h-5 text-slate-400" />
                                                                                         )}
                                                                                     </div>
                                                                                     <div className="text-sm text-slate-600">
                                                                                         <span className="font-bold text-slate-800 block">{safeText(speaker.name)}</span>
                                                                                         {speaker.organization && (
                                                                                             <span className="text-slate-500 text-xs">
                                                                                                 {speaker.organization}
                                                                                             </span>
                                                                                         )}
                                                                                     </div>
                                                                                 </div>
                                                                             </div>
                                                                         </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Bio Modal */}
            <Dialog open={!!selectedSpeaker} onOpenChange={() => setSelectedSpeaker(null)}>
                <DialogContent className="max-w-md sm:max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-center">
                            {language === 'ko' ? '연자 소개' : 'Speaker Biography'}
                        </DialogTitle>
                    </DialogHeader>
                    
                    {selectedSpeaker && (
                        <div className="flex flex-col items-center text-center">
                            <div className="w-32 h-32 rounded-full bg-slate-100 border-4 border-white shadow-lg overflow-hidden mb-6">
                                {selectedSpeaker.photoUrl ? (
                                    <img src={selectedSpeaker.photoUrl} alt={safeText(selectedSpeaker.name)} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-200">
                                        <User className="w-12 h-12 text-slate-400" />
                                    </div>
                                )}
                            </div>
                            
                            <h2 className="text-2xl font-bold text-slate-900 mb-1">
                                {safeText(selectedSpeaker.name)}
                            </h2>
                            {selectedSpeaker.organization && (
                                <p className="text-blue-600 font-medium mb-6">
                                    {selectedSpeaker.organization}
                                </p>
                            )}

                            {selectedSpeaker.presentationTitle && (
                                <div className="w-full bg-slate-50 p-4 rounded-lg mb-6 border border-slate-100">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                        {language === 'ko' ? '발표 주제' : 'Lecture Title'}
                                    </h3>
                                    <p className="font-bold text-slate-800">
                                        {safeText(selectedSpeaker.presentationTitle)}
                                    </p>
                                </div>
                            )}
                            
                            {selectedSpeaker.bio && (
                                <div className="w-full text-left">
                                    <h3 className="text-sm font-bold text-slate-900 mb-2 border-b pb-2">
                                        {language === 'ko' ? '약력' : 'Biography'}
                                    </h3>
                                    <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                                        {safeText(selectedSpeaker.bio)}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ProgramPage;