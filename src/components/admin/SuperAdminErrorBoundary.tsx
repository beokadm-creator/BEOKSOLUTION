import React, { Component, ReactNode } from 'react';
import { Button } from '../ui/button';
import { ShieldAlert, RefreshCcw } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class SuperAdminErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Super Admin Console Crash:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 bg-[#1a1a1a] flex items-center justify-center p-4">
                    <div className="bg-[#2a2a2a] max-w-md w-full p-8 rounded-2xl border border-red-900 shadow-2xl text-center">
                        <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                            <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" />
                        </div>

                        <h2 className="text-xl font-bold text-gray-100 mb-2">MASTER CONSOLE ERROR</h2>
                        <p className="text-gray-400 text-sm mb-6">
                            시스템 복구 중입니다. 오류가 지속되면 개발팀에 문의하십시오.<br />
                            <span className="font-mono text-xs text-red-400 mt-2 block bg-black/30 p-2 rounded">
                                {this.state.error?.message}
                            </span>
                        </p>

                        <div className="flex gap-3 justify-center">
                            <Button
                                onClick={() => window.location.href = '/'}
                                className="bg-gray-700 hover:bg-gray-600 text-white"
                            >
                                메인 홈으로 이동
                            </Button>
                            <Button
                                onClick={() => window.location.reload()}
                                className="bg-red-700 hover:bg-red-800 text-white"
                            >
                                <RefreshCcw className="w-4 h-4 mr-2" />
                                콘솔 재시작
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
