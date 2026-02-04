import React from 'react';
import { EregiButton } from '../../eregi/EregiForm';

interface WideMobileFooterProps {
  onRegisterClick: () => void;
  lang: string;
  labels: {
    register: string;
    dday: string;
    untilDeadline: string;
  };
  deadline: Date;
}

export const WideMobileFooter: React.FC<WideMobileFooterProps> = ({
  onRegisterClick,
  deadline,
  labels,
}) => {
  // Calculate D-Day
  const today = new Date();
  const diffTime = deadline.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const ddayText = diffDays > 0 
    ? `${labels.dday}${diffDays} ${labels.untilDeadline}` 
    : diffDays === 0 ? "D-Day" : "Ended";

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.1)] lg:hidden z-50 flex gap-3">
      <div className="flex-1 flex items-center justify-between gap-4">
        {/* D-Day Badge (Optional, added for context) */}
        <div className="hidden sm:block text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded">
          {ddayText}
        </div>
        
        <EregiButton 
          onClick={onRegisterClick} 
          className="flex-1 py-3 text-base shadow-lg bg-[var(--primary)] text-white"
        >
          {labels.register}
          <span className="ml-2 text-xs opacity-80 font-normal sm:hidden">({ddayText})</span>
        </EregiButton>
      </div>
      
      <button 
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
        className="w-12 h-12 flex items-center justify-center bg-slate-100 rounded-xl text-slate-600 hover:bg-slate-200"
      >
        ↑
      </button>
    </div>
  );
};
