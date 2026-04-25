import React, { useState, useEffect, useRef, useMemo } from 'react';
import { translationDb as rtdb } from '../../lib/translationFirebase';
import { ref, get, onValue } from 'firebase/database';
import { useProjectStream } from '../../hooks/useProjectStream';
import TextItem from './TextItem';

interface ProjectSettings {
  name: string;
  conferenceId: string;
  sourceLanguage: string;
  targetLanguages: string[];
  slug: string;
  parkingMessage?: string;
}

export const TranslationPanel: React.FC<{ defaultConferenceId?: string }> = ({ defaultConferenceId }) => {
  const [projects, setProjects] = useState<ProjectSettings[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionInfo, setActiveSessionInfo] = useState<any | null>(null);
  const [activeLang, setActiveLang] = useState<string>('ko');

  // Viewer Settings
  const [fontSize, setFontSize] = useState<number>(18);
  const [letterSpacing, setLetterSpacing] = useState<number>(0);
  const [lineHeight, setLineHeight] = useState<number>(1.6);

  // Load available halls (projects)
  useEffect(() => {
    const projectsRef = ref(rtdb, 'projects');
    const unsubscribe = onValue(projectsRef, (projSnap) => {
      if (projSnap.exists()) {
        const data = projSnap.val();
        let list = Object.keys(data).map(k => {
          const s = data[k].settings || {};
          return { ...s, slug: k } as ProjectSettings;
        });
        
        // If defaultConferenceId is provided, try to filter (e.g. kap_2026spring)
        // Also fallback to showing all if the filter yields nothing or if conferenceId matches loosely
        if (defaultConferenceId) {
          const defaultSlug = defaultConferenceId.split('_').pop() || defaultConferenceId; // e.g. 2026spring
          
          let filtered = list.filter(p => p.conferenceId === defaultConferenceId);
          if (filtered.length === 0) {
            // Try matching by just the slug part (e.g., matching '2026spring' or 'kamos')
            filtered = list.filter(p => 
              (p.conferenceId && p.conferenceId.includes(defaultSlug)) || 
              (p.slug && p.slug.includes(defaultSlug)) ||
              (p.conferenceId && defaultConferenceId.includes(p.conferenceId))
            );
          }
          if (filtered.length > 0) {
             list = filtered;
          }
        }
        
        setProjects(list);

        // Auto-select project if there's only one matching the conference
        if (list.length === 1) {
          setSelectedProjectId(prev => prev || list[0].slug);
        }
      } else {
        setProjects([]);
      }
    });

    return () => unsubscribe();
  }, [defaultConferenceId]);

  const lastProcessedSessIdRef = useRef<string | null>(null);

  // Subscribe to active session for selected project
  useEffect(() => {
    if (!selectedProjectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveSessionId(null);
      setActiveSessionInfo(null);
      return;
    }
    
    const activeRef = ref(rtdb, `projects/${selectedProjectId}/activeSessionId`);
    const unsubscribeActive = onValue(activeRef, (snap) => {
      const sessId = snap.val();
      setActiveSessionId(sessId);
      
      if (sessId) {
        // Fetch session info
        const sessionRef = ref(rtdb, `projects/${selectedProjectId}/sessions/${sessId}`);
        get(sessionRef).then(sessSnap => {
          if (sessSnap.exists()) {
            const sessData = sessSnap.val();
            setActiveSessionInfo(sessData);
            
            // Set default language based on sourceLanguage ONLY when the session ID actually changes
            if (sessId !== lastProcessedSessIdRef.current) {
              lastProcessedSessIdRef.current = sessId;
              
              if (sessData.sourceLanguage === 'ko') {
                setActiveLang('en');
              } else if (sessData.sourceLanguage === 'en') {
                setActiveLang('ko');
              }
            }
          } else {
            setActiveSessionInfo(null);
          }
        });
      } else {
        setActiveSessionInfo(null);
        lastProcessedSessIdRef.current = null;
      }
    });

    return () => {
      unsubscribeActive();
    };
  }, [selectedProjectId]);

  // Subscribe to stream
  const streamOptions = useMemo(() => ({ subscribe: !!selectedProjectId }), [selectedProjectId]);
  const { streamData } = useProjectStream(selectedProjectId, activeSessionId, streamOptions);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const segmentsMap = streamData || {};

  // sessionId 기반 필터 제거 — 오리지널 translation-comm.web.app/audience/{id} 동작과 정합.
  // RTDB 쿼리의 limitToLast(50) 가 자연스러운 스크롤백 윈도우를 제공하고,
  // status === 'merged' 는 렌더 단계에서 숨긴다. sessionId 불일치 케이스에서
  // 전체 세그먼트가 잘리는 증상(=빈 화면 + "Waiting for translation...") 방지.
  const segmentsOrder = Object.keys(segmentsMap)
    .filter(k => !!segmentsMap[k])
    .sort((a, b) => (segmentsMap[a]?.timestamp || 0) - (segmentsMap[b]?.timestamp || 0));

  // Scroll to bottom when a new segment is added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segmentsOrder.length]);

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!selectedProjectId) {
    return (
      <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 mt-4">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
          </span>
          {activeLang === 'en' ? 'Live AI Translation - Select Room' : '실시간 AI 번역 - 홀 선택'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {projects.map(p => (
            <button
              key={p.slug}
              onClick={() => setSelectedProjectId(p.slug)}
              className="p-4 text-left border rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <div className="font-bold text-gray-800">{p.name || p.slug}</div>
              <div className="text-xs text-gray-500 mt-1">
                {activeLang === 'en' ? 'Supported Languages' : '지원 언어'}: {p.targetLanguages?.join(', ') || 'ko, en'}
              </div>
            </button>
          ))}
          {projects.length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-500">
              {activeLang === 'en' ? 'No active translation sessions.' : '현재 진행 중인 번역 세션이 없습니다.'}
            </div>
          )}
        </div>
      </div>
    );
  }

  const project = projects.find(p => p.slug === selectedProjectId);

  return (
    <div className="relative bg-gray-900 text-white rounded-2xl flex flex-col h-[800px] sm:h-[1000px] lg:h-[1200px] overflow-hidden shadow-xl mt-4">
      <style>{`
        @keyframes blink-cursor {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
        }
      `}</style>
      <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSelectedProjectId(null)}
            className="text-gray-400 hover:text-white"
          >
            ← {activeLang === 'en' ? 'Back' : '뒤로'}
          </button>
          <span className="font-bold truncate max-w-[120px] sm:max-w-[200px]">{project?.name || selectedProjectId}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-1 rounded-md border bg-gray-900 border-gray-700 shadow-sm hidden sm:flex">
            <button onClick={() => setFontSize(v => Math.max(12, v - 2))} className="p-1 hover:bg-white/10 rounded text-xs font-medium text-gray-400 hover:text-white">A−</button>
            <button onClick={() => setFontSize(v => Math.min(48, v + 2))} className="p-1 hover:bg-white/10 rounded text-sm font-bold text-gray-400 hover:text-white">A+</button>
            <div className="w-px h-3 bg-gray-700 mx-1"></div>
            <button onClick={() => setLetterSpacing(v => Math.max(-1, parseFloat((v - 0.5).toFixed(1))))} className="p-1 hover:bg-white/10 rounded text-xs font-medium text-gray-400 hover:text-white">↔−</button>
            <button onClick={() => setLetterSpacing(v => Math.min(8, parseFloat((v + 0.5).toFixed(1))))} className="p-1 hover:bg-white/10 rounded text-xs font-medium text-gray-400 hover:text-white">↔+</button>
            <div className="w-px h-3 bg-gray-700 mx-1"></div>
            <button onClick={() => setLineHeight(v => Math.max(1.0, parseFloat((v - 0.1).toFixed(1))))} className="p-1 hover:bg-white/10 rounded text-xs font-medium text-gray-400 hover:text-white">↕−</button>
            <button onClick={() => setLineHeight(v => Math.min(4.0, parseFloat((v + 0.1).toFixed(1))))} className="p-1 hover:bg-white/10 rounded text-xs font-medium text-gray-400 hover:text-white">↕+</button>
          </div>
          <div className="flex gap-2">
            {['ko', 'en'].filter(l => project?.targetLanguages?.includes(l) || ['ko', 'en'].includes(l)).map(lang => (
              <button
                key={lang}
                onClick={() => setActiveLang(lang)}
                className={`px-3 py-1 text-xs rounded-full font-bold ${activeLang === lang ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
              >
                {lang === 'ko' ? 'KR' : 'EN'}
              </button>
            ))}
            <button
              onClick={() => window.open(`https://translation-comm.web.app/audience/${selectedProjectId}`, '_blank')}
              className="px-3 py-1 text-xs rounded-full font-bold bg-blue-600 text-white hover:bg-blue-500 transition-colors hidden sm:inline-flex items-center gap-1 shadow-sm"
            >
              <span aria-hidden>↗</span>
              {activeLang === 'en' ? 'Open in New Tab' : '새 창에서 열기'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile Settings Bar */}
      <div className="sm:hidden bg-gray-800 border-b border-gray-700 px-4 py-2 flex justify-between items-center overflow-x-auto gap-2">
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setFontSize(v => Math.max(12, v - 2))} className="p-1.5 hover:bg-white/10 rounded text-xs font-medium text-gray-400 hover:text-white">A−</button>
          <button onClick={() => setFontSize(v => Math.min(48, v + 2))} className="p-1.5 hover:bg-white/10 rounded text-sm font-bold text-gray-400 hover:text-white">A+</button>
          <div className="w-px h-3 bg-gray-700 mx-1"></div>
          <button onClick={() => setLetterSpacing(v => Math.max(-1, parseFloat((v - 0.5).toFixed(1))))} className="p-1.5 hover:bg-white/10 rounded text-xs font-medium text-gray-400 hover:text-white">↔−</button>
          <button onClick={() => setLetterSpacing(v => Math.min(8, parseFloat((v + 0.5).toFixed(1))))} className="p-1.5 hover:bg-white/10 rounded text-xs font-medium text-gray-400 hover:text-white">↔+</button>
          <div className="w-px h-3 bg-gray-700 mx-1"></div>
          <button onClick={() => setLineHeight(v => Math.max(1.0, parseFloat((v - 0.1).toFixed(1))))} className="p-1.5 hover:bg-white/10 rounded text-xs font-medium text-gray-400 hover:text-white">↕−</button>
          <button onClick={() => setLineHeight(v => Math.min(4.0, parseFloat((v + 0.1).toFixed(1))))} className="p-1.5 hover:bg-white/10 rounded text-xs font-medium text-gray-400 hover:text-white">↕+</button>
        </div>
        <button
          onClick={() => window.open(`https://translation-comm.web.app/audience/${selectedProjectId}`, '_blank')}
          className="shrink-0 px-3 py-1 text-[10px] rounded-full font-bold bg-blue-600 text-white hover:bg-blue-500 transition-colors whitespace-nowrap inline-flex items-center gap-1 shadow-sm"
        >
          <span aria-hidden>↗</span>
          {activeLang === 'en' ? 'New Tab' : '새 창'}
        </button>
      </div>

      {activeSessionInfo && (
        <div className="bg-gray-800/80 border-b border-gray-700 p-3 px-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                LIVE
              </span>
              {activeSessionInfo.startTime && (
                <span className="text-xs text-gray-400">{activeSessionInfo.startTime}</span>
              )}
            </div>
            <h4 className="text-sm font-bold text-gray-200 truncate">
              {activeSessionInfo.topic || (activeLang === 'en' ? 'Active Session' : '진행 중인 세션')}
            </h4>
          </div>
          {activeSessionInfo.speaker && (
            <div className="flex items-center gap-2 bg-gray-900/50 rounded-lg px-3 py-2 border border-gray-700/50 flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center text-blue-300 font-bold text-sm">
                {activeSessionInfo.speaker.charAt(0)}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-200">{activeSessionInfo.speaker}</span>
                {activeSessionInfo.affiliation && (
                  <span className="text-[10px] text-gray-500 truncate max-w-[120px]">{activeSessionInfo.affiliation}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4 relative"
        style={{ letterSpacing: `${letterSpacing}px`, lineHeight }}
      >
        {segmentsOrder.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            {!activeSessionId
              ? (project?.parkingMessage || (activeLang === 'en' ? 'No active session.' : '진행 중인 세션이 없습니다.'))
              : (activeLang === 'en' ? 'Waiting for translation...' : '번역을 대기 중입니다...')}
          </div>
        ) : (
          segmentsOrder.map(id => {
            const seg = segmentsMap[id];
            if (!seg) return null;
            if (seg.status === 'merged') return null;

            let text = "";
            let isFallback = false;

            if (activeLang === 'ko') {
              text = seg.ko as string || seg.refined || seg.original || "";
            } else if (activeLang === 'en') {
              text = seg.en as string || "";
              if (!text) {
                text = seg.ko as string || seg.refined || seg.original || "";
                isFallback = true;
              }
            } else {
              text = seg.refined || seg.original || "";
            }

            if (!text) return null;

            // 영어 모드에서 번역을 기다리는 동안, 아직 한국어만 있는 경우
            // 원래 시스템처럼 아예 노출시키지 않거나 투명하게 처리합니다.
            // 하지만 "아예 안나온다"면 opacity-0가 문제를 일으켰을 수 있으므로
            // 원래 시스템(AudienceView.tsx)과 100% 동일한 로직으로 복원합니다.
            // 원래 AudienceView.tsx 로직:
            // if (activeLang === 'en' && /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text)) {
            //     return <TextItem ... isRaw={true} opacity={0.6} color="#6b7280" /> (즉, 흐릿하게 보여줌)
            // }

            const isTranslating = seg.status === 'translating';
            const isFinal = seg.status === 'final';
            const isTimeOut = (now - (seg.timestamp || 0)) > 5000;
            const showAsRaw = !isFinal && !isTimeOut && !isFallback;

            if (activeLang === 'en' && /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text)) {
              return (
                <TextItem
                  key={id}
                  id={id}
                  text={text}
                  isRaw={true}
                  targetLang={activeLang}
                  fontSize={`${fontSize}px`}
                  color="#9ca3af"
                  opacity={0.6}
                />
              );
            }

            return (
              <TextItem
                key={id}
                id={id}
                text={text}
                isRaw={showAsRaw}
                targetLang={activeLang}
                fontSize={`${fontSize}px`}
                color={isFallback ? "#9ca3af" : "white"}
                opacity={!showAsRaw && !isTranslating ? 1 : 0.7}
              />
            );
          })
        )}
        <div ref={messagesEndRef} className="h-1" />
      </div>
    </div>
  );
};
