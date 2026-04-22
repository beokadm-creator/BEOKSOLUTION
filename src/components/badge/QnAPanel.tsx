import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc, orderBy } from "firebase/firestore";
import { db } from "@/firebase";
import { Agenda, Speaker } from "@/types/schema";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { getKstToday, parseDatetimeLocalAsKst } from "@/utils/dateUtils";
import toast from "react-hot-toast";

interface QnAPanelProps {
  confId: string;
  userId: string;
  userName: string;
  userAff: string;
  badgeLang: "ko" | "en";
}

export const QnAPanel: React.FC<QnAPanelProps> = ({
  confId,
  userId,
  userName,
  userAff,
  badgeLang
}) => {
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [selectedAgendaId, setSelectedAgendaId] = useState<string>("");
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [qnaEnabled, setQnaEnabled] = useState(false);

  const t = (ko: string, en: string) => (badgeLang === "ko" ? ko : en);

  useEffect(() => {
    const initQnA = async () => {
      setLoading(true);
      try {
        // 1. Check QnA Config (Time bounds)
        const configSnap = await getDoc(doc(db, `conferences/${confId}/settings/qna_config`));
        let isEnabled = true;
        
        if (configSnap.exists()) {
          const cfg = configSnap.data();
          if (cfg.enabled === false) isEnabled = false;
          
          if (isEnabled && cfg.startTime && cfg.endTime) {
            const now = new Date();
            // cfg.startTime is stored as an ISO string like "2026-04-22T09:00" from datetime-local
            // We need to parse it correctly as KST to UTC before comparing with current UTC time
            const startUtc = parseDatetimeLocalAsKst(cfg.startTime);
            const endUtc = parseDatetimeLocalAsKst(cfg.endTime);
            if (now < startUtc || now > endUtc) {
              isEnabled = false;
            }
          }
        }
        setQnaEnabled(isEnabled);

        if (!isEnabled) {
          setLoading(false);
          return;
        }

        // 2. Load Agendas
        const agendasSnap = await getDocs(query(collection(db, `conferences/${confId}/agendas`), orderBy("startTime", "asc")));
        const agendaData = agendasSnap.docs.map(d => ({ id: d.id, ...d.data() } as Agenda));
        setAgendas(agendaData);
        
        if (agendaData.length > 0) {
          setSelectedAgendaId(agendaData[0].id);
        }
      } catch (err) {
        console.error("Failed to init QnA", err);
      } finally {
        setLoading(false);
      }
    };

    initQnA();
  }, [confId]);

  // Load speakers when agenda changes
  useEffect(() => {
    if (!selectedAgendaId) {
      setSpeakers([]);
      setSelectedSpeakerId("");
      return;
    }

    const fetchSpeakers = async () => {
      try {
        const speakersSnap = await getDocs(query(
          collection(db, `conferences/${confId}/speakers`),
          where("agendaId", "==", selectedAgendaId)
        ));
        const speakerData = speakersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Speaker));
        setSpeakers(speakerData);
        if (speakerData.length > 0) {
          setSelectedSpeakerId(speakerData[0].id);
        } else {
          setSelectedSpeakerId("");
        }
      } catch (err) {
        console.error("Failed to load speakers", err);
      }
    };

    fetchSpeakers();
  }, [confId, selectedAgendaId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return toast.error(t("질문을 입력해주세요.", "Please enter your question."));
    if (!selectedAgendaId) return toast.error(t("세션을 선택해주세요.", "Please select a session."));

    try {
      setSubmitting(true);
      await addDoc(collection(db, `conferences/${confId}/questions`), {
        userId,
        userName,
        userAff,
        agendaId: selectedAgendaId,
        speakerId: selectedSpeakerId, // Can be empty if asking a general session question
        question: question.trim(),
        isAnswered: false,
        createdAt: serverTimestamp(),
      });

      toast.success(t("질문이 성공적으로 등록되었습니다.", "Your question has been submitted."));
      setQuestion("");
    } catch (err) {
      console.error("Submit question error", err);
      toast.error(t("질문 등록에 실패했습니다.", "Failed to submit question."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!qnaEnabled) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-10 px-4 text-center">
        <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-bold text-gray-800 mb-1">
          {t("현재 Q&A 시간이 아닙니다.", "Q&A is not active right now.")}
        </p>
        <p className="text-xs text-gray-500">
          {t("지정된 시간에만 질문을 등록할 수 있습니다.", "Questions can only be submitted during active Q&A sessions.")}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare className="w-5 h-5 text-purple-600" />
        <h3 className="font-bold text-gray-900">{t("실시간 Q&A", "Live Q&A")}</h3>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">{t("세션 (Session)", "Session")}</label>
          <select 
            value={selectedAgendaId} 
            onChange={e => setSelectedAgendaId(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="" disabled>{t("세션을 선택하세요", "Select a session")}</option>
            {agendas.map(agenda => (
              <option key={agenda.id} value={agenda.id}>
                {agenda.title?.ko || agenda.title?.en}
              </option>
            ))}
          </select>
        </div>

        {speakers.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">{t("연자 (Speaker)", "Speaker")}</label>
            <select 
              value={selectedSpeakerId} 
              onChange={e => setSelectedSpeakerId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">{t("세션 전체 (공통)", "General Session Question")}</option>
              {speakers.map(speaker => (
                <option key={speaker.id} value={speaker.id}>
                  {speaker.name?.ko || speaker.name?.en} {speaker.organization ? `(${speaker.organization})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">{t("질문 내용", "Your Question")}</label>
          <textarea 
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder={t("질문을 자유롭게 작성해주세요.", "Type your question here...")}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[100px] resize-none"
          />
        </div>

        <button 
          type="submit"
          disabled={submitting || !question.trim() || !selectedAgendaId}
          className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white rounded-xl py-3.5 text-sm font-bold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4" />
              {t("질문 등록하기", "Submit Question")}
            </>
          )}
        </button>
      </form>
    </div>
  );
};