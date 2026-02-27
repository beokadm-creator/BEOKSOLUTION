import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '../ui/button';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // TODO: Log this to Sentry or Firebase Crashlytics
    console.error('Uncaught error:', _error, _errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
          <div className="bg-white p-8 md:p-10 rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full text-center space-y-8 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-400 via-amber-400 to-red-400"></div>

            <div className="flex justify-center">
              <div className="p-4 bg-red-50 rounded-full">
                <AlertTriangle className="w-14 h-14 text-red-500" />
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">
                시스템 접속이 원활하지 않습니다.
              </h1>
              <p className="text-slate-500 text-sm md:text-base leading-relaxed break-keep">
                일시적인 시스템 오류 또는 네트워크 문제로 인해 페이지를 불러오지 못했습니다.<br />
                이용에 불편을 드려 대단히 죄송합니다. 잠시 후 다시 시도해 주시기 바랍니다.
              </p>
            </div>

            {/* Development only error details */}
            {import.meta.env.MODE === 'development' && this.state.error && (
              <div className="bg-slate-50 p-4 rounded-xl text-left overflow-auto max-h-48 text-xs font-mono text-slate-600 border border-slate-200 shadow-inner">
                <span className="font-bold text-red-600 mb-2 block">Developer Error Log:</span>
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col gap-3 pt-4">
              <Button
                onClick={() => window.location.reload()}
                className="w-full h-14 text-lg rounded-xl font-bold gap-2 bg-slate-800 hover:bg-slate-900 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                <RefreshCcw className="w-5 h-5" />
                페이지 다시 시도하기
              </Button>

              <a
                href="http://pf.kakao.com/_wxexmxgn/chat"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-14 flex items-center justify-center text-lg rounded-xl font-bold gap-2 bg-[#FEE500] hover:bg-[#FADA0A] text-[#000000] opacity-90 hover:opacity-100 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 4C7.02944 4 3 7.218 3 11.1872C3 13.5298 4.414 15.6143 6.57502 16.8523L5.61869 20.3541C5.52084 20.7126 5.92215 21 6.23075 20.803L10.3842 18.1517C10.906 18.2255 11.4452 18.2646 12 18.2646C16.9705 18.2646 21 15.0465 21 11.0773C21 7.10815 16.9706 4 12 4Z" fill="currentColor" />
                </svg>
                카카오톡 고객센터 문의
              </a>
            </div>

            <p className="text-xs text-slate-400 mt-6">
              반복해서 오류가 발생한다면 언제든지 문의해 주세요.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
