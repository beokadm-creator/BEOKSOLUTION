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
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="w-12 h-12 text-red-600" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-900">
                일시적인 오류가 발생했습니다
              </h1>
              <p className="text-gray-500 text-sm">
                시스템 처리 중 예기치 않은 문제가 발생했습니다.<br/>
                잠시 후 다시 시도해 주세요.
              </p>
            </div>

            {/* Development only error details */}
            {import.meta.env.MODE === 'development' && this.state.error && (
              <div className="bg-gray-100 p-4 rounded text-left overflow-auto max-h-48 text-xs font-mono text-red-600">
                {this.state.error.toString()}
              </div>
            )}

            <div className="pt-4">
              <Button 
                onClick={() => window.location.reload()} 
                className="w-full gap-2 bg-[#003366] hover:bg-[#002244]"
              >
                <RefreshCcw className="w-4 h-4" />
                페이지 새로고침
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
