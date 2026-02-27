import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 md:p-10 rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full text-center space-y-8 relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-300"></div>

        <div className="flex justify-center">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-10 h-10 text-amber-500" />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight">404</h1>
          <h2 className="text-xl md:text-2xl font-bold text-slate-700 tracking-tight">
            요청하신 페이지를 찾을 수 없습니다.
          </h2>
          <p className="text-slate-500 text-sm md:text-base leading-relaxed break-keep">
            입력하신 주소가 올바른지 다시 한번 확인해 주시기 바랍니다.<br />
            페이지의 주소가 변경되었거나 삭제되어 현재 접근이 불가능할 수 있습니다.
          </p>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left overflow-hidden shadow-inner">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">요청하신 주소 (Requested URL)</p>
          <p className="text-sm font-mono text-slate-600 break-all">{window.location.pathname}</p>
        </div>

        <div className="flex flex-col gap-3 pt-4">
          <div className="flex gap-3 justify-center w-full">
            <Button onClick={() => navigate('/')} className="flex-1 h-14 text-lg rounded-xl font-bold gap-2 bg-blue-600 hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
              <Home className="w-5 h-5 mr-1" />
              홈으로 이동
            </Button>
            <Button variant="outline" onClick={() => window.history.back()} className="flex-1 h-14 text-lg rounded-xl font-bold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 border-slate-200 hover:bg-slate-50">
              이전 페이지
            </Button>
          </div>

          <a
            href="http://pf.kakao.com/_wxexmxgn/chat"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-14 flex items-center justify-center text-lg rounded-xl font-bold gap-2 bg-[#FEE500] hover:bg-[#FADA0A] text-[#000000] opacity-90 hover:opacity-100 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 mt-2"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 4C7.02944 4 3 7.218 3 11.1872C3 13.5298 4.414 15.6143 6.57502 16.8523L5.61869 20.3541C5.52084 20.7126 5.92215 21 6.23075 20.803L10.3842 18.1517C10.906 18.2255 11.4452 18.2646 12 18.2646C16.9705 18.2646 21 15.0465 21 11.0773C21 7.10815 16.9706 4 12 4Z" fill="currentColor" />
            </svg>
            궁금한 점이 있으시다면? 카카오톡 문의
          </a>
        </div>
      </div>
    </div>
  );
}