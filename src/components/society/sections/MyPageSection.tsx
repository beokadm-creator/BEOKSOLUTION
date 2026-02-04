import React from 'react';
import { User, LogOut, Calendar } from 'lucide-react';

interface MyPageSectionProps {
  onNavigateToMypage: () => void;
  onLogout: () => void;
  userName?: string;
}

const MyPageSection: React.FC<MyPageSectionProps> = ({ onNavigateToMypage, onLogout, userName }) => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-3xl border border-slate-100 p-12 shadow-sm">
        <h2 className="text-3xl font-black text-slate-900 mb-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
            <User size={24} />
          </div>
          마이페이지
        </h2>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-8 border border-slate-100">
            <div className="text-center">
              <div className="w-20 h-20 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <User size={36} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">
                {userName || '회원'}님
              </h3>
              <p className="text-slate-600">환영합니다!</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={onNavigateToMypage}
              className="p-6 bg-blue-50 hover:bg-blue-100 rounded-2xl border border-blue-200 transition-all text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center">
                  <User size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900">회원정보</h4>
                  <p className="text-sm text-slate-600">내 정보 관리</p>
                </div>
              </div>
            </button>

            <button
              onClick={onNavigateToMypage}
              className="p-6 bg-indigo-50 hover:bg-indigo-100 rounded-2xl border border-indigo-200 transition-all text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center">
                  <Calendar size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900">참여현황</h4>
                  <p className="text-sm text-slate-600">학술대회 참여 내역</p>
                </div>
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
