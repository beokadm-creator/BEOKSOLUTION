import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { Agenda, Speaker } from '@/types/schema';
import { MessageSquare, CheckCircle, Clock, Search, Maximize2, X, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Question {
  id: string;
  userId: string;
  userName: string;
  userAff: string;
  agendaId: string;
  speakerId: string;
  question: string;
  isAnswered: boolean;
  createdAt: Timestamp | null;
}

export const QnAModeratorPage = () => {
  const { confId } = useParams();
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [selectedAgendaId, setSelectedAgendaId] = useState<string>('all');
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>('all');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [fullscreenQuestion, setFullscreenQuestion] = useState<Question | null>(null);
  const [showAnswered, setShowAnswered] = useState(false);

  useEffect(() => {
    if (!confId) return;
    const fetchAgendasAndSpeakers = async () => {
      const agendasSnap = await getDocs(query(collection(db, `conferences/${confId}/agendas`), orderBy("startTime", "asc")));
      setAgendas(agendasSnap.docs.map(d => ({ id: d.id, ...d.data() } as Agenda)));
      
      const speakersSnap = await getDocs(collection(db, `conferences/${confId}/speakers`));
      setSpeakers(speakersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Speaker)));
    };
    fetchAgendasAndSpeakers();
  }, [confId]);

  useEffect(() => {
    if (!confId) return;

    let q = query(collection(db, `conferences/${confId}/questions`), orderBy("createdAt", "desc"));
    
    if (selectedAgendaId !== 'all') {
      // NOTE: requires composite index for agendaId + createdAt
      q = query(collection(db, `conferences/${confId}/questions`), where("agendaId", "==", selectedAgendaId), orderBy("createdAt", "desc"));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Question));
      setQuestions(data);
    });

    return () => unsubscribe();
  }, [confId, selectedAgendaId]);

  const toggleAnswered = async (qId: string, currentStatus: boolean) => {
    await updateDoc(doc(db, `conferences/${confId}/questions`, qId), {
      isAnswered: !currentStatus
    });
  };

  const filteredQuestions = questions
    .filter(q => showAnswered ? true : !q.isAnswered)
    .filter(q => selectedSpeakerId === 'all' || q.speakerId === selectedSpeakerId);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-blue-600" />
              좌장 뷰 (실시간 Q&A)
            </h1>
            <p className="text-slate-500 mt-1 text-sm">실시간으로 올라오는 질문을 확인하고 화면에 띄울 수 있습니다.</p>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
            <select 
              value={selectedAgendaId} 
              onChange={e => { setSelectedAgendaId(e.target.value); setSelectedSpeakerId('all'); }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 flex-1 md:w-48"
            >
              <option value="all">전체 세션</option>
              {agendas.map(a => <option key={a.id} value={a.id}>{a.title?.ko || a.title?.en}</option>)}
            </select>

            <select 
              value={selectedSpeakerId} 
              onChange={e => setSelectedSpeakerId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 flex-1 md:w-48"
            >
              <option value="all">전체 연자</option>
              {speakers
                .filter(s => selectedAgendaId === 'all' || s.agendaId === selectedAgendaId)
                .map(s => <option key={s.id} value={s.id}>{s.name?.ko || s.name?.en}</option>)
              }
            </select>
          </div>
        </div>

        {/* Filters */}
        <div className="flex justify-between items-center px-2">
          <div className="text-sm font-bold text-slate-600">
            총 {filteredQuestions.length}개의 질문
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
            <input 
              type="checkbox" 
              checked={showAnswered} 
              onChange={e => setShowAnswered(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            답변 완료된 질문 포함
          </label>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredQuestions.map(q => {
            const agenda = agendas.find(a => a.id === q.agendaId);
            const speaker = speakers.find(s => s.id === q.speakerId);
            
            return (
              <div key={q.id} className={`bg-white rounded-2xl p-6 border shadow-sm transition-all flex flex-col ${q.isAnswered ? 'border-slate-200 opacity-60' : 'border-blue-100 hover:shadow-md'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-lg">
                      {q.userName.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{q.userName}</div>
                      <div className="text-xs text-slate-500">{q.userAff}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleAnswered(q.id, q.isAnswered)}
                    className={`p-2 rounded-full transition-colors ${q.isAnswered ? 'text-green-500 bg-green-50 hover:bg-green-100' : 'text-slate-400 hover:bg-slate-100'}`}
                    title={q.isAnswered ? "답변 완료됨 (클릭시 취소)" : "답변 완료 처리"}
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="flex-1">
                  <p className="text-slate-800 font-medium leading-relaxed whitespace-pre-wrap text-lg">{q.question}</p>
                </div>
                
                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
                  <div className="text-xs text-slate-400 flex flex-col gap-1">
                    <span className="font-semibold text-blue-600">{agenda?.title?.ko}</span>
                    <span>{speaker ? `연자: ${speaker.name?.ko}` : '세션 공통 질문'}</span>
                    <span className="flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      {q.createdAt?.toDate ? format(q.createdAt.toDate(), 'HH:mm', { locale: ko }) : ''}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => setFullscreenQuestion(q)}
                    className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors flex items-center gap-2 text-sm font-semibold"
                  >
                    <Maximize2 className="w-4 h-4" />
                    크게 보기
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredQuestions.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
            <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-700">등록된 질문이 없습니다.</h3>
            <p className="text-slate-500 mt-2">선택한 조건에 해당하는 질문이 올라오면 이곳에 표시됩니다.</p>
          </div>
        )}
      </div>

      {/* Fullscreen Modal */}
      {fullscreenQuestion && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <div className="p-6 flex justify-end">
            <button 
              onClick={() => setFullscreenQuestion(null)}
              className="p-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-12 max-w-6xl mx-auto w-full">
            <div className="text-center mb-12">
              <div className="text-3xl font-black text-blue-600 mb-4">
                {fullscreenQuestion.userName} <span className="text-2xl text-slate-500 font-bold">({fullscreenQuestion.userAff})</span>
              </div>
              <div className="text-xl text-slate-400 font-medium">
                {agendas.find(a => a.id === fullscreenQuestion.agendaId)?.title?.ko}
                {fullscreenQuestion.speakerId ? ` - 연자: ${speakers.find(s => s.id === fullscreenQuestion.speakerId)?.name?.ko}` : ''}
              </div>
            </div>
            
            <div className="text-5xl md:text-6xl font-black text-slate-900 leading-tight text-center break-keep whitespace-pre-wrap">
              "{fullscreenQuestion.question}"
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QnAModeratorPage;