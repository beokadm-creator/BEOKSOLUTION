import React, { useState, useEffect, useRef } from 'react';
import { translationDb as rtdb } from '../../lib/translationFirebase';
import { ref, get, onValue } from 'firebase/database';
import { useProjectStream } from '../../hooks/useProjectStream';

interface ProjectSettings {
  name: string;
  conferenceId: string;
  sourceLanguage: string;
  targetLanguages: string[];
  slug: string;
}

export const TranslationPanel: React.FC<{ defaultConferenceId?: string }> = ({ defaultConferenceId }) => {
  const [projects, setProjects] = useState<ProjectSettings[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState<string>('ko');

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

  // Subscribe to active session for selected project
  useEffect(() => {
    if (!selectedProjectId) return;
    const activeRef = ref(rtdb, `projects/${selectedProjectId}/activeSessionId`);
    const unsubscribe = onValue(activeRef, (snap) => {
      setActiveSessionId(snap.val());
    });
    return () => unsubscribe();
  }, [selectedProjectId]);

  // Subscribe to stream
  const { streamData } = useProjectStream(selectedProjectId, { subscribe: !!selectedProjectId });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  // Handle scroll events to detect if user manually scrolled up
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 150;
    setIsAutoScroll(isAtBottom);
  };

  // Scroll to bottom
  useEffect(() => {
    if (isAutoScroll && messagesEndRef.current) {
      // Use 'auto' instead of 'smooth' to prevent jittering when rapid updates arrive
      messagesEndRef.current.scrollIntoView({ behavior: "auto", block: "end" });
    }
  }, [streamData, isAutoScroll]);

  const segmentsMap = streamData || {};
  const segmentsOrder = Object.keys(segmentsMap)
    .filter(k => segmentsMap[k]?.sessionId === activeSessionId)
    .sort((a, b) => (segmentsMap[a]?.timestamp || 0) - (segmentsMap[b]?.timestamp || 0));

  if (!selectedProjectId) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mt-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
          </span>
          실시간 AI 번역 - 홀 선택
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
                지원 언어: {p.targetLanguages?.join(', ') || 'ko, en'}
              </div>
            </button>
          ))}
          {projects.length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-500">
              현재 진행 중인 번역 세션이 없습니다.
            </div>
          )}
        </div>
      </div>
    );
  }

  const project = projects.find(p => p.slug === selectedProjectId);

  return (
    <div className="bg-gray-900 text-white rounded-2xl flex flex-col h-[500px] overflow-hidden shadow-xl mt-6">
      <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSelectedProjectId(null)}
            className="text-gray-400 hover:text-white"
          >
            ← 뒤로
          </button>
          <span className="font-bold">{project?.name || selectedProjectId}</span>
        </div>
        <div className="flex gap-2">
          {['ko', 'en', 'ja'].filter(l => project?.targetLanguages?.includes(l) || ['ko', 'en'].includes(l)).map(lang => (
            <button
              key={lang}
              onClick={() => setActiveLang(lang)}
              className={`px-3 py-1 text-xs rounded-full ${activeLang === lang ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
            >
              {lang === 'ko' ? '한국어' : lang === 'en' ? 'English' : '日本語'}
            </button>
          ))}
        </div>
      </div>

      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
      >
        {!activeSessionId ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            진행 중인 세션이 없습니다.
          </div>
        ) : segmentsOrder.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            번역을 대기 중입니다...
          </div>
        ) : (
          segmentsOrder.map(id => {
            const seg = segmentsMap[id];
            if (!seg) return null;
            if (seg.status === 'merged') return null;

            const text = seg[activeLang as keyof typeof seg] as string || seg.refined || seg.original;
            if (!text) return null;

            return (
              <div key={id} className={`transition-opacity ${seg.status === 'final' ? 'opacity-100' : 'opacity-70'}`}>
                <p className="text-lg leading-relaxed">{text}</p>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
