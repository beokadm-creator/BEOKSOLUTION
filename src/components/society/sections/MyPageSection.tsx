import React from 'react';
import { User, LogOut, Calendar, ChevronRight } from 'lucide-react';

interface MyPageSectionProps {
  onNavigateToMypage: () => void;
  onLogout: () => void;
  userName?: string;
}

const MyPageSection: React.FC<MyPageSectionProps> = ({ onNavigateToMypage, onLogout, userName }) => {
  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-0">
      <div className="bg-white/95 rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-sm">
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-6 sm:mb-8 flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
            <User size={24} />
          </div>
          마이페이지
        </h2>

        <div className="space-y-5 sm:space-y-6">
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5 sm:p-8 border border-blue-100">
            <div className="text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <User size={36} />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
                {userName || '회원'}님
              </h3>
              <p className="text-slate-600">환영합니다!</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <button
              onClick={onNavigateToMypage}
              className="p-5 sm:p-6 bg-blue-50 hover:bg-blue-100 rounded-2xl border border-blue-200 transition-all text-left"
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-11 h-11 sm:w-12 sm:h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center">
                  <User size={20} />
                </div>
                <div className="flex-1">
                  <h4 className="text-base sm:text-lg font-black text-slate-900">회원정보</h4>
                  <p className="text-sm text-slate-600">내 정보 관리</p>
                </div>
                <ChevronRight className="w-4 h-4 text-blue-500" />
              </div>
            </button>

            <button
              onClick={onNavigateToMypage}
              className="p-5 sm:p-6 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 transition-all text-left"
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-11 h-11 sm:w-12 sm:h-12 bg-slate-700 text-white rounded-xl flex items-center justify-center">
                  <Calendar size={20} />
                </div>
                <div className="flex-1">
                  <h4 className="text-base sm:text-lg font-black text-slate-900">참여현황</h4>
                  <p className="text-sm text-slate-600">학술대회 참여 내역</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </div>
            </button>
          </div>

          <div className="pt-6 border-t border-slate-200">
            <button
              onClick={onLogout}
              className="w-full p-4 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 transition-all flex items-center justify-center gap-3 text-red-600 font-bold"
            >
              <LogOut size={20} />
              로그아웃
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyPageSection;
