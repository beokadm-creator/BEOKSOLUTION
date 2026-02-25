
import React, { useEffect, useState } from 'react';
import { Outlet, useParams, Link, useLocation } from 'react-router-dom';
import { SocietyProvider } from '../contexts/SocietyContext';
import { useSubdomain } from '../hooks/useSubdomain';
import { DEFAULT_SOCIETY_FEATURES, APP_VERSION } from '../constants/defaults';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Button } from '../components/ui/button';
import { LayoutDashboard, Settings, Users, Mail, ShieldCheck, LogOut, Building2, CreditCard, Globe } from 'lucide-react';
import { cn } from '../lib/utils';
import LoadingSpinner from '../components/common/LoadingSpinner';


// ✅ DEV 환경용 URL 파라미터 생성 함수
const getDevParams = () => {
  const params = new URLSearchParams(window.location.search);
  const society = params.get('society');
  const admin = params.get('admin');

  if (society || admin) {
    const newParams = new URLSearchParams();
    if (society) newParams.set('society', society);
    if (admin) newParams.set('admin', admin);
    return `?${newParams.toString()}`;
  }
  return '';
};

export default function SocietyLayout() {
  const { sid: paramSid, societyId: paramSocietyId } = useParams<{ sid: string; societyId: string }>();
  const { subdomain } = useSubdomain();

  // ✅ DEV 환경: URL 파라미터에서 society 가져오기
  const params = new URLSearchParams(window.location.search);
  const societyParam = params.get('society');

  // ✅ sessionStorage에서 societyId 가져오기 (로그인 후 리다이렉트 시)
  const sessionSocietyId = sessionStorage.getItem('societyId');

  // Priority: URL param > sessionStorage > subdomain > URL path param
  const sid = societyParam || sessionSocietyId || subdomain || paramSocietyId || paramSid;

  // Stabilize sid: only update when it changes (not on every render)
  const [stableSid, setStableSid] = useState<string>(societyParam || sessionSocietyId || subdomain || paramSocietyId || paramSid || '');

  useEffect(() => {
    if (sid && sid !== stableSid) {
      setStableSid(sid);
    }
  }, [sid, stableSid]);

  const [society, setSociety] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  // Fetch Society Data
  useEffect(() => {
    if (!stableSid) {
      console.error('[SocietyLayout] No sid provided');
      setLoading(false);
      return;
    }

    console.log('[SocietyLayout] Fetching society with sid:', stableSid);

    const fetchSociety = async () => {
      try {
        const docRef = doc(db, 'societies', stableSid);
        const docSnap = await getDoc(docRef);
        console.log('[SocietyLayout] Doc exists:', docSnap.exists());
        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log('[SocietyLayout] Society data:', data);
          setSociety({ id: docSnap.id, ...data });
        } else {
          console.error('[SocietyLayout] Society not found for sid:', stableSid);
        }
      } catch (e) {
        console.error('[SocietyLayout] Error fetching society:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchSociety();
  }, [stableSid]);

  // Merge Features (Deep Merge Simulation)
  const features = { ...DEFAULT_SOCIETY_FEATURES, ...(society?.features || {}) };

  // Theme
  useEffect(() => {
    // Navy Theme
    document.body.style.backgroundColor = '#f3f4f6'; // gray-100
    return () => { document.body.style.backgroundColor = ''; };
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!sid) return <SocietyIdMissingError />;
  if (!society) return <SocietyNotFoundError sid={sid} />;

  // ✅ DEV 환경용 URL 파라미터
  const devParams = getDevParams();

  const navItems = [
    { href: `/admin/society${devParams}`, label: '대시보드', icon: LayoutDashboard, key: 'dashboard' },
    { href: `/admin/society/content${devParams}`, label: '콘텐츠 관리', icon: Globe, key: 'content' },
    { href: `/admin/society/infra${devParams}`, label: '인프라 설정', icon: Settings, key: 'infra' },
    { href: `/admin/society/identity${devParams}`, label: '아이덴티티', icon: Building2, key: 'identity' },
    { href: `/admin/society/members${devParams}`, label: '회원 명단', icon: ShieldCheck, key: 'members' },
    { href: `/admin/society/membership-fees${devParams}`, label: '회비 설정', icon: CreditCard, key: 'membership-fees' },
    { href: `/admin/society/templates${devParams}`, label: '알림톡 템플릿', icon: Mail, key: 'templates' },
    { href: `/admin/society/users${devParams}`, label: '관리자 계정', icon: Users, key: 'users' },
  ];

  return (
    <SocietyProvider value={{ societyId: sid!, society, features }}>
      <div className="flex h-screen bg-gray-100">
        <aside className="w-64 bg-[#001f3f] text-white flex flex-col border-r border-[#003366]">
          {/* ✅ DEV 환경 표기 */}
          {societyParam && (
            <div className="bg-yellow-500 text-yellow-900 text-center py-2 text-sm font-bold">
              ⚠️ DEV 환경 - 테스트용
            </div>
          )}
          <div className="h-16 flex items-center justify-center border-b border-[#003366] font-bold text-xl">
            {society.name?.ko || society.name?.en || sid?.toUpperCase()} HQ
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map(item => {
              const isActive = location.pathname === item.href;
              const isFeatureActive = features[item.key] ?? true;

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors relative",
                    isActive
                      ? "bg-[#003366] text-white border border-blue-400"
                      : isFeatureActive
                        ? "text-blue-200 hover:bg-[#003366]/50 hover:text-white"
                        : "text-blue-300/50 hover:bg-[#003366]/30 hover:text-blue-300/70"
                  )}
                >
                  <item.icon className={cn(
                    "w-4 h-4",
                    !isFeatureActive && "opacity-50"
                  )} />
                  <span className={cn(
                    "flex-1",
                    !isFeatureActive && "opacity-60"
                  )}>
                    {item.label}
                  </span>
                  {!isFeatureActive && (
                    <span className="ml-auto px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full border border-yellow-200">
                      준비 중
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-[#003366]">
            <Button variant="ghost" className="w-full justify-start gap-2 text-blue-300 hover:text-white" onClick={() => auth.signOut()}>
              <LogOut className="w-4 h-4" /> 로그아웃
            </Button>
          </div>
          <div className="p-2 bg-[#00152b] text-[10px] text-blue-400 text-center">
            v{APP_VERSION}
          </div>
        </aside>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </SocietyProvider>
  );
}

// ─── DEV Helper Components ───────────────────────────────────────────────────

function SocietyIdMissingError() {
  const [inputVal, setInputVal] = React.useState('');
  const hostname = window.location.hostname;
  const isDev = hostname.includes('web.app') || hostname.includes('localhost');

  const handleGo = () => {
    if (!inputVal.trim()) return;
    const params = new URLSearchParams(window.location.search);
    params.set('society', inputVal.trim());
    window.location.href = `/admin/society?${params.toString()}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-10 max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
          <span className="text-3xl">🏢</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">학회 ID가 필요합니다</h2>
          <p className="text-sm text-slate-500">
            {isDev
              ? 'DEV 환경에서는 URL에 학회 ID 파라미터가 필요합니다.'
              : '학회 도메인을 통해 접근해주세요.'}
          </p>
        </div>
        {isDev && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400 font-mono bg-slate-50 p-3 rounded-lg border">
              예시: /admin/society?society=<strong>kadd</strong>
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="학회 ID 입력 (예: kadd)"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGo()}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleGo}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
              >
                이동
              </button>
            </div>
          </div>
        )}
        <a
          href="/super"
          className="block text-sm text-blue-600 hover:underline font-medium"
        >
          슈퍼 어드민으로 이동 →
        </a>
      </div>
    </div>
  );
}

function SocietyNotFoundError({ sid }: { sid: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-10 max-w-md w-full text-center space-y-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <span className="text-3xl">❌</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900">학회를 찾을 수 없습니다</h2>
        <p className="text-sm text-slate-500">
          학회 ID: <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{sid}</code>
        </p>
        <p className="text-xs text-slate-400">Firestore에 해당 학회 문서가 존재하지 않습니다.</p>
        <a href="/super" className="block text-sm text-blue-600 hover:underline font-medium">
          슈퍼 어드민으로 이동 →
        </a>
      </div>
    </div>
  );
}
