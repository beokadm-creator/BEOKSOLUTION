import React, { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface MembershipPaymentLayoutProps {
  children: ReactNode;
}

export default function MembershipPaymentLayout({ children }: MembershipPaymentLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Back button + Title */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/mypage')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-medium">마이페이지</span>
              </button>
              <div className="h-6 w-px bg-gray-300" />
              <h1 className="text-xl font-bold text-gray-900">학회 회비 납부</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-600">
            <p>&copy; 2026 eRegi. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="/terms" className="hover:text-gray-900 transition-colors">이용약관</a>
              <a href="/privacy" className="hover:text-gray-900 transition-colors">개인정보처리방침</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
