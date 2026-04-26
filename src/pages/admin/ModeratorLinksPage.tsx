import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, getDocs, doc, setDoc, deleteDoc, Timestamp, orderBy, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { ModeratorToken, Agenda } from '@/types/schema';
import { Link2, Plus, Trash2, Copy, QrCode, Power, Clock, X } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';

export default function ModeratorLinksPage() {
  const { cid } = useParams<{ cid: string }>();
  const [tokens, setTokens] = useState<ModeratorToken[]>([]);
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [loading, setLoading] = useState(true);

  // 폼 상태
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [selectedAgendas, setSelectedAgendas] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState('');
  const [qrModalToken, setQrModalToken] = useState<string | null>(null);

  useEffect(() => {
    if (!cid) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const agendasSnap = await getDocs(query(collection(db, `conferences/${cid}/agendas`), orderBy("startTime", "asc")));
        setAgendas(agendasSnap.docs.map(d => ({ id: d.id, ...d.data() } as Agenda)));

        const tokensSnap = await getDocs(query(collection(db, `conferences/${cid}/moderator_tokens`), orderBy("createdAt", "desc")));
        setTokens(tokensSnap.docs.map(d => d.data() as ModeratorToken));
      } catch (err) {
        console.error('Error fetching moderator tokens:', err);
        toast.error('데이터를 불러오는 데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [cid]);

  // 재사용 가능한 fetchData는 별도로 두거나 의존성에 추가하지 않고
  // 토큰 갱신 시에는 간단히 다시 호출하도록 구성.
  const refreshTokens = async () => {
    if (!cid) return;
    try {
      const tokensSnap = await getDocs(query(collection(db, `conferences/${cid}/moderator_tokens`), orderBy("createdAt", "desc")));
      setTokens(tokensSnap.docs.map(d => d.data() as ModeratorToken));
    } catch (err) {
      console.error('Error fetching tokens:', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cid || !label.trim() || selectedAgendas.length === 0) {
      toast.error('라벨과 세션을 최소 1개 이상 선택해주세요.');
      return;
    }

    const tokenVal = `mod_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
    const newDocRef = doc(db, `conferences/${cid}/moderator_tokens`, tokenVal);

    const newToken: ModeratorToken = {
      token: tokenVal,
      label: label.trim(),
      agendaIds: selectedAgendas,
      createdAt: Timestamp.now(),
      createdBy: 'admin', // 실제 환경에서는 auth.currentUser.uid 사용
      isActive: true,
    };

    if (expiresAt) {
      newToken.expiresAt = Timestamp.fromDate(new Date(expiresAt));
    }

    try {
      await setDoc(newDocRef, newToken);
      toast.success('좌장 링크가 생성되었습니다.');
      setIsFormOpen(false);
      setLabel('');
      setSelectedAgendas([]);
      setExpiresAt('');
      refreshTokens();
    } catch (err) {
      console.error('Error creating token:', err);
      toast.error('링크 생성 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (token: string) => {
    if (!cid) return;
    if (!confirm('정말 삭제하시겠습니까? (삭제 시 해당 링크는 즉시 무효화됩니다)')) return;

    try {
      await deleteDoc(doc(db, `conferences/${cid}/moderator_tokens`, token));
      toast.success('링크가 삭제되었습니다.');
      refreshTokens();
    } catch (err) {
      console.error('Error deleting token:', err);
      toast.error('삭제 중 오류가 발생했습니다.');
    }
  };

  const toggleActive = async (token: string, currentStatus: boolean) => {
    if (!cid) return;
    try {
      await updateDoc(doc(db, `conferences/${cid}/moderator_tokens`, token), {
        isActive: !currentStatus
      });
      toast.success(currentStatus ? '링크가 비활성화되었습니다.' : '링크가 활성화되었습니다.');
      refreshTokens();
    } catch (err) {
      console.error('Error updating token:', err);
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  const getPublicUrl = (token: string) => {
    // Assuming subdomain pattern
    const slug = cid?.split('_')[1] || '';
    return `${window.location.origin}/${slug}/moderator/${token}`;
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL이 클립보드에 복사되었습니다.');
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">데이터를 불러오는 중입니다...</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Link2 className="w-6 h-6 text-blue-600" />
            좌장 전용 뷰 링크 관리
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            좌장에게 제공할 로그인 없는 독립적인 Q&A 실시간 뷰 링크를 생성하고 관리합니다.
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          새 링크 생성
        </button>
      </div>

      {isFormOpen && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100">
          <h2 className="text-lg font-bold text-slate-900 mb-4 border-b pb-3">신규 링크 발급</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  링크 이름 (라벨) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="예: 오전 세션 A 좌장 - 김교수님"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">만료 시간 (선택)</label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
                <p className="text-xs text-slate-400 mt-1">설정하지 않으면 계속 유지됩니다. (수동 비활성화 가능)</p>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                볼 수 있는 세션 (다중 선택 가능) <span className="text-red-500">*</span>
              </label>
              <div className="border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2 bg-slate-50">
                {agendas.map((a) => (
                  <label key={a.id} className="flex items-start gap-2 cursor-pointer p-2 hover:bg-white rounded transition-colors border border-transparent hover:border-slate-200">
                    <input
                      type="checkbox"
                      checked={selectedAgendas.includes(a.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAgendas([...selectedAgendas, a.id]);
                        } else {
                          setSelectedAgendas(selectedAgendas.filter(id => id !== a.id));
                        }
                      }}
                      className="mt-1 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div className="text-sm">
                      <div className="font-medium text-slate-900">{a.title?.ko || a.title?.en}</div>
                      <div className="text-xs text-slate-500">
                        {format(a.startTime.toDate(), 'MM.dd HH:mm')} - {format(a.endTime.toDate(), 'HH:mm')}
                      </div>
                    </div>
                  </label>
                ))}
                {agendas.length === 0 && <div className="text-sm text-slate-400 text-center py-4">등록된 세션이 없습니다.</div>}
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              생성하기
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-600">
                <th className="p-4">상태</th>
                <th className="p-4">라벨</th>
                <th className="p-4">연결된 세션</th>
                <th className="p-4">접속 링크 / QR</th>
                <th className="p-4">생성/만료 정보</th>
                <th className="p-4 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tokens.map((t) => {
                const url = getPublicUrl(t.token);
                const isExpired = t.expiresAt && t.expiresAt.toDate() < new Date();
                
                return (
                  <tr key={t.token} className={`hover:bg-slate-50/50 transition-colors ${!t.isActive || isExpired ? 'opacity-60 bg-slate-50' : ''}`}>
                    <td className="p-4">
                      <button
                        onClick={() => toggleActive(t.token, t.isActive)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                          t.isActive && !isExpired
                            ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                        }`}
                        title="클릭하여 상태 변경"
                      >
                        <Power className="w-3.5 h-3.5" />
                        {t.isActive ? (isExpired ? '만료됨' : '활성') : '차단됨'}
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{t.label}</div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        최근: {t.lastAccessedAt ? format(t.lastAccessedAt.toDate(), 'MM.dd HH:mm', { locale: ko }) : '접속 기록 없음'}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {t.agendaIds.map((id, idx) => {
                          const a = agendas.find(a => a.id === id);
                          if (!a) return null;
                          return (
                            <span key={id} className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded border border-slate-200" title={a.title?.ko}>
                              {idx < 2 ? (a.title?.ko?.substring(0, 15) + (a.title?.ko && a.title.ko.length > 15 ? '...' : '')) : ''}
                            </span>
                          );
                        })}
                        {t.agendaIds.length > 2 && (
                          <span className="px-2 py-1 bg-slate-100 text-slate-500 text-xs rounded border border-slate-200">
                            +{t.agendaIds.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={url}
                          className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-500 w-48 outline-none truncate"
                        />
                        <button
                          onClick={() => copyToClipboard(url)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="URL 복사"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setQrModalToken(t.token)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="QR 코드 보기"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-xs text-slate-500 space-y-1">
                        <div><span className="text-slate-400 w-8 inline-block">생성:</span> {format(t.createdAt.toDate(), 'MM.dd HH:mm')}</div>
                        {t.expiresAt && (
                          <div className={isExpired ? 'text-red-500 font-medium' : ''}>
                            <span className="text-slate-400 w-8 inline-block">만료:</span> {format(t.expiresAt.toDate(), 'MM.dd HH:mm')}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDelete(t.token)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="삭제"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {tokens.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Link2 className="w-12 h-12 text-slate-200 mb-3" />
                      <p className="text-lg font-medium text-slate-700">생성된 좌장 링크가 없습니다.</p>
                      <p className="text-sm mt-1">상단의 '새 링크 생성' 버튼을 눌러 추가해주세요.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR Modal */}
      {qrModalToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full relative">
            <button 
              onClick={() => setQrModalToken(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-slate-900">접속 QR 코드</h3>
              <p className="text-sm text-slate-500 mt-1">스마트폰 카메라로 스캔하여 접속하세요.</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex justify-center shadow-inner">
              <QRCodeSVG 
                value={getPublicUrl(qrModalToken)} 
                size={200}
                level="M"
                includeMargin={true}
              />
            </div>
            <div className="mt-6">
              <button
                onClick={() => copyToClipboard(getPublicUrl(qrModalToken))}
                className="w-full py-3 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Copy className="w-5 h-5" />
                URL 복사하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
