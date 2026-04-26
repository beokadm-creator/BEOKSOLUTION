import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, doc, getDoc, onSnapshot, query, where, orderBy, updateDoc, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { ModeratorToken, Agenda, Speaker } from '@/types/schema';
import { MessageSquare, CheckCircle, Clock, Maximize2, X } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useConference } from '@/hooks/useConference';

// 기존 QnAModeratorPage에서 사용하던 Question 타입 정의 보완
interface QnAQuestion {
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

export default function ModeratorLivePage() {
  const { token } = useParams<{ slug: string; token: string }>();
  const confData = useConference();
  const [modToken, setModToken] = useState<ModeratorToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [questions, setQuestions] = useState<QnAQuestion[]>([]);
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  
  const [selectedAgendaId, setSelectedAgendaId] = useState<string>('all');
  const [showAnswered, setShowAnswered] = useState(false);
  const [fullscreenQuestion, setFullscreenQuestion] = useState<QnAQuestion | null>(null);

  useEffect(() => {
    if (confData.loading || !confData) return;
    if (!token) {
      setError('유효하지 않은 링크입니다.');
      setLoading(false);
      return;
    }

    const fetchToken = async () => {
      try {
        const tokenRef = doc(db, `conferences/${confData.id}/moderator_tokens`, token);
        const tokenSnap = await getDoc(tokenRef);

        if (!tokenSnap.exists()) {
          setError('존재하지 않거나 삭제된 좌장 링크입니다.');
          return;
        }

        const data = tokenSnap.data() as ModeratorToken;
        
        if (!data.isActive) {
          setError('비활성화된 좌장 링크입니다.');
          return;
        }

        if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
          setError('만료된 좌장 링크입니다.');
          return;
        }

        setModToken(data);
        
        // 마지막 접속 시간 업데이트
        updateDoc(tokenRef, {
          lastAccessedAt: Timestamp.now()
        }).catch(console.error);

      } catch (err) {
        console.error('Error fetching token:', err);
        setError('정보를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchToken();
  }, [confData, token]);

  useEffect(() => {
    if (!confData || !modToken) return;

    // 아젠다와 연자 데이터 가져오기 (토큰에 해당하는 것만 또는 전체)
    const fetchAgendasAndSpeakers = async () => {
      const agendasSnap = await getDocs(query(collection(db, `conferences/${confData.id}/agendas`), orderBy("startTime", "asc")));
      setAgendas(agendasSnap.docs.map(d => ({ id: d.id, ...d.data() } as Agenda)));

      const speakersSnap = await getDocs(collection(db, `conferences/${confData.id}/speakers`));
      setSpeakers(speakersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Speaker)));
    };

    fetchAgendasAndSpeakers();

    // 질문 실시간 구독
    let q;
    const questionsRef = collection(db, `conferences/${confData.id}/questions`);
    
    // 토큰에 할당된 아젠다 ID 목록으로 필터링 (IN 쿼리는 최대 10개 제한)
    if (modToken.agendaIds && modToken.agendaIds.length > 0 && modToken.agendaIds.length <= 10) {
      q = query(
        questionsRef, 
        where("agendaId", "in", modToken.agendaIds),
        orderBy("createdAt", "desc")
      );
    } else {
      q = query(questionsRef, orderBy("createdAt", "desc"));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as QnAQuestion));
      setQuestions(data);
    }, (err) => {
      console.error('QnA Subscription Error:', err);
      // 인덱스 에러 등의 경우 처리
    });

    return () => unsubscribe();
  }, [confData, modToken]);

  const toggleAnswered = async (qId: string, currentStatus: boolean) => {
    if (!confData) return;
    try {
      await updateDoc(doc(db, `conferences/${confData.id}/questions`, qId), {
        isAnswered: !currentStatus
      });
    } catch (err) {
      console.error('Toggle Answer Error:', err);
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  if (confData.loading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !modToken) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">접근 불가</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <p className="text-sm text-slate-400">학회 관리자에게 새로운 링크를 요청해주세요.</p>
        </div>
      </div>
    );
  }

  // 필터링 적용 (클라이언트 사이드)
  let filteredQuestions = questions;
  
  // 1. 답변 완료 필터
  if (!showAnswered) {
    filteredQuestions = filteredQuestions.filter(q => !q.isAnswered);
  }

  // 2. 특정 아젠다 필터 (드롭다운 선택)
  if (selectedAgendaId !== 'all') {
    filteredQuestions = filteredQuestions.filter(q => q.agendaId === selectedAgendaId);
  } else if (modToken.agendaIds && modToken.agendaIds.length > 0) {
    // IN 쿼리를 못 썼을 경우를 대비한 클라이언트 필터
    filteredQuestions = filteredQuestions.filter(q => modToken.agendaIds.includes(q.agendaId));
  }

  // 3. 특정 연자 필터 (토큰에 지정된 경우만)
  if (modToken.speakerIds && modToken.speakerIds.length > 0) {
    filteredQuestions = filteredQuestions.filter(q => modToken.speakerIds!.includes(q.speakerId));
  }

  const tokenAgendas = agendas.filter(a => modToken.agendaIds.includes(a.id));

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-blue-600" />
                {modToken.label}
              </h1>
              <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                LIVE
              </span>
            </div>
            <p className="text-slate-500 text-sm">현장에서 실시간으로 올라오는 질문을 확인하고 화면에 띄울 수 있습니다.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {tokenAgendas.length > 1 && (
              <select 
                value={selectedAgendaId} 
                onChange={e => setSelectedAgendaId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 flex-1 min-w-[200px]"
              >
                <option value="all">배정된 세션 전체</option>
                {tokenAgendas.map(a => <option key={a.id} value={a.id}>{a.title?.ko || a.title?.en}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex justify-between items-center px-2">
          <div className="text-sm font-bold text-slate-600">
            대기 중인 질문 {filteredQuestions.filter(q => !q.isAnswered).length}개
            <span className="mx-2 text-slate-300">|</span>
            총 {filteredQuestions.length}개
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
              <div key={q.id} className={`bg-white rounded-2xl p-6 border shadow-sm transition-all flex flex-col ${q.isAnswered ? 'border-slate-200 opacity-60' : 'border-blue-200 shadow-md ring-1 ring-blue-50'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-lg border border-blue-100">
                      {q.userName.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{q.userName}</div>
                      <div className="text-xs text-slate-500">{q.userAff}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleAnswered(q.id, q.isAnswered)}
                    className={`p-2 rounded-full transition-colors flex-shrink-0 ${q.isAnswered ? 'text-green-500 bg-green-50 hover:bg-green-100' : 'text-slate-400 bg-slate-50 hover:bg-blue-50 hover:text-blue-600'}`}
                    title={q.isAnswered ? "답변 완료됨 (클릭시 취소)" : "답변 완료 처리"}
                  >
                    <CheckCircle className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="flex-1 my-2">
                  <p className="text-slate-800 font-medium leading-relaxed whitespace-pre-wrap text-lg">{q.question}</p>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-end">
                  <div className="text-xs text-slate-400 flex flex-col gap-1.5">
                    <span className="font-semibold text-blue-600">{agenda?.title?.ko || '알 수 없는 세션'}</span>
                    <span className="text-slate-500">{speaker ? `연자: ${speaker.name?.ko}` : '세션 공통 질문'}</span>
                    <span className="flex items-center gap-1 mt-1 text-slate-400">
                      <Clock className="w-3 h-3" />
                      {q.createdAt?.toDate ? format(q.createdAt.toDate(), 'HH:mm', { locale: ko }) : ''}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => setFullscreenQuestion(q)}
                    className="px-3 py-2 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 rounded-lg transition-colors flex items-center gap-2 text-sm font-semibold border border-slate-200 hover:border-blue-200"
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
            <h3 className="text-lg font-bold text-slate-700">대기 중인 질문이 없습니다.</h3>
            <p className="text-slate-500 mt-2">새로운 질문이 등록되면 이곳에 실시간으로 표시됩니다.</p>
          </div>
        )}
      </div>

      {/* Fullscreen Modal */}
      {fullscreenQuestion && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in fade-in duration-200">
          <div className="p-6 flex justify-end">
            <button 
              onClick={() => setFullscreenQuestion(null)}
              className="p-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors focus:outline-none focus:ring-4 focus:ring-slate-200"
            >
              <X className="w-8 h-8" />
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-12 max-w-7xl mx-auto w-full">
            <div className="text-center mb-12">
              <div className="text-3xl md:text-4xl font-black text-blue-600 mb-4 flex items-center justify-center gap-4">
                <span className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center border-2 border-blue-100">
                  {fullscreenQuestion.userName.charAt(0)}
                </span>
                {fullscreenQuestion.userName} 
                <span className="text-2xl md:text-3xl text-slate-500 font-bold">({fullscreenQuestion.userAff})</span>
              </div>
              <div className="text-xl md:text-2xl text-slate-500 font-medium px-6 py-3 bg-slate-50 rounded-full inline-block">
                <span className="text-slate-700 font-bold">{agendas.find(a => a.id === fullscreenQuestion.agendaId)?.title?.ko}</span>
                {fullscreenQuestion.speakerId ? <span className="mx-2">|</span> : ''}
                {fullscreenQuestion.speakerId ? <span className="text-blue-600">연자: {speakers.find(s => s.id === fullscreenQuestion.speakerId)?.name?.ko}</span> : ''}
              </div>
            </div>
            
            <div className="text-4xl md:text-6xl lg:text-7xl font-black text-slate-900 leading-tight md:leading-tight lg:leading-tight text-center break-keep whitespace-pre-wrap px-4">
              "{fullscreenQuestion.question}"
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
