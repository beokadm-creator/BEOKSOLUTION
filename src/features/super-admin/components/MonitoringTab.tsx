import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useSuperAdminMonitoring } from '../hooks/useSuperAdminMonitoring';

interface MonitoringTabProps {
    societies: Array<{ id: string; name: { ko: string } }>;
}

export const MonitoringTab: React.FC<MonitoringTabProps> = ({ societies }) => {
    const {
        monitoringDate,
        setMonitoringDate,
        errorLogs,
        performanceMetrics,
        dataIntegrityAlerts,
        monitoringLoading,
        refetchMonitoring,
        resolvingAlertId,
        resolveAlert,
        healthCheckData,
        healthCheckLoading,
        fetchHealthCheck,
        alimTalkConfigData,
        alimTalkConfigLoading,
        selectedSocietyForAlimTalk,
        setSelectedSocietyForAlimTalk,
        fetchAlimTalkConfig
    } = useSuperAdminMonitoring();

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-[#fbbf24] mb-2">시스템 모니터링</h2>
                    <p className="text-gray-400 text-sm">실시간 오류, 성능, 데이터 무결성 추적</p>
                </div>
                <div className="flex items-center gap-4">
                    <input
                        type="date"
                        value={monitoringDate}
                        onChange={(e) => setMonitoringDate(e.target.value)}
                        className="bg-[#2a2a2a] border border-[#333] text-gray-200 px-4 py-2 rounded-lg focus:border-[#fbbf24] focus:outline-none"
                    />
                    <button
                        onClick={refetchMonitoring}
                        className="bg-[#fbbf24] hover:bg-[#e0a520] text-black px-4 py-2 rounded-lg font-semibold flex items-center gap-2"
                    >
                        새로고침
                    </button>
                </div>
            </div>

            {monitoringLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <LoadingSpinner />
                    <p className="text-sm text-gray-400">모니터링 데이터 로딩 중...</p>
                </div>
            ) : (
                <>
                    {/* Health Check & AlimTalk Config Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Health Check Card */}
                        <Card className="shadow-lg border-t-4 border-t-green-500 bg-[#1e1e1e] border-[#333]">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-xl flex items-center gap-2 text-green-400">
                                    <Activity className="w-5 h-5" /> 시스템 헬스체크
                                </CardTitle>
                                <CardDescription className="text-gray-400">
                                    Firestore, 환경변수, Functions 상태 확인
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button
                                    onClick={fetchHealthCheck}
                                    disabled={healthCheckLoading}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold"
                                >
                                    {healthCheckLoading ? '확인 중...' : '헬스체크 실행'}
                                </Button>

                                {healthCheckData && (
                                    <div className="space-y-3">
                                        <div className={`p-4 rounded-lg border-2 ${healthCheckData.status === 'healthy' ? 'bg-green-500/10 border-green-500' :
                                            healthCheckData.status === 'degraded' ? 'bg-yellow-500/10 border-yellow-500' :
                                                'bg-red-500/10 border-red-500'
                                            }`}>
                                            <div className="flex items-center gap-2 mb-2">
                                                {healthCheckData.status === 'healthy' ? <CheckCircle2 className="w-5 h-5 text-green-400" /> :
                                                    healthCheckData.status === 'degraded' ? <Activity className="w-5 h-5 text-yellow-400" /> :
                                                        <XCircle className="w-5 h-5 text-red-400" />}
                                                <span className="font-bold text-lg">
                                                    {healthCheckData.status === 'healthy' ? '정상' :
                                                        healthCheckData.status === 'degraded' ? '경고' : '오류'}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                {healthCheckData.timestamp && new Date(healthCheckData.timestamp).toLocaleString('ko-KR')}
                                            </div>
                                        </div>

                                        {healthCheckData.checks && (
                                            <div className="space-y-2">
                                                {Object.entries((healthCheckData as Record<string, any>).checks as Record<string, any>).map(([key, check]: [string, any]) => (
                                                    <div key={key} className="flex items-center justify-between p-3 bg-[#2a2a2a] rounded-lg">
                                                        <div className="flex items-center gap-2">
                                                            {check.status === 'pass' ? <CheckCircle2 className="w-4 h-4 text-green-400" /> :
                                                                check.status === 'warn' ? <Activity className="w-4 h-4 text-yellow-400" /> :
                                                                    <XCircle className="w-4 h-4 text-red-400" />}
                                                            <span className="text-sm font-medium text-gray-200">{key}</span>
                                                        </div>
                                                        <span className="text-xs text-gray-400">{check.message}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* AlimTalk Config Check Card */}
                        <Card className="shadow-lg border-t-4 border-t-purple-500 bg-[#1e1e1e] border-[#333]">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-xl flex items-center gap-2 text-purple-400">
                                    💬 알림톡 설정 확인
                                </CardTitle>
                                <CardDescription className="text-gray-400">
                                    템플릿, Aligo 설정, Infrastructure 확인
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-2">
                                    <select
                                        className="flex-1 p-3 bg-[#2a2a2a] border border-[#333] rounded-lg text-gray-200 focus:border-purple-600"
                                        value={selectedSocietyForAlimTalk}
                                        onChange={(e) => setSelectedSocietyForAlimTalk(e.target.value)}
                                    >
                                        <option value="">학회 선택...</option>
                                        {societies.map(s => <option key={s.id} value={s.id}>{s.name.ko}</option>)}
                                    </select>
                                    <Button
                                        onClick={() => fetchAlimTalkConfig(selectedSocietyForAlimTalk)}
                                        disabled={alimTalkConfigLoading || !selectedSocietyForAlimTalk}
                                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
                                    >
                                        {alimTalkConfigLoading ? '확인 중...' : '확인'}
                                    </Button>
                                </div>

                                {alimTalkConfigData && (
                                    <div className="space-y-3">
                                        <div className={`p-4 rounded-lg border-2 ${alimTalkConfigData.success ? 'bg-green-500/10 border-green-500' : 'bg-red-500/10 border-red-500'
                                            }`}>
                                            <div className="flex items-center gap-2 mb-2">
                                                {alimTalkConfigData.success ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
                                                <span className="font-bold text-lg">
                                                    {alimTalkConfigData.success ? '설정 정상' : '설정 오류'}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                {alimTalkConfigData.timestamp && new Date(alimTalkConfigData.timestamp).toLocaleString('ko-KR')}
                                            </div>
                                        </div>

                                        {alimTalkConfigData.summary && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="p-3 bg-[#2a2a2a] rounded-lg">
                                                    <div className="text-xs text-gray-400">총 템플릿</div>
                                                    <div className="text-2xl font-bold text-gray-200">{alimTalkConfigData.summary.totalTemplates}</div>
                                                </div>
                                                <div className="p-3 bg-[#2a2a2a] rounded-lg">
                                                    <div className="text-xs text-gray-400">활성 템플릿</div>
                                                    <div className="text-2xl font-bold text-green-400">{alimTalkConfigData.summary.activeTemplates}</div>
                                                </div>
                                                <div className="p-3 bg-[#2a2a2a] rounded-lg">
                                                    <div className="text-xs text-gray-400">승인된 템플릿</div>
                                                    <div className="text-2xl font-bold text-blue-400">{alimTalkConfigData.summary.approvedTemplates}</div>
                                                </div>
                                                <div className="p-3 bg-[#2a2a2a] rounded-lg">
                                                    <div className="text-xs text-gray-400">Aligo 설정</div>
                                                    <div className="text-2xl font-bold">
                                                        {alimTalkConfigData.summary.hasAligoConfig ? '✅' : '❌'}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {alimTalkConfigData.warnings && alimTalkConfigData.warnings.length > 0 && (
                                            <div className="p-3 bg-yellow-500/10 border border-yellow-500 rounded-lg">
                                                <div className="text-xs font-bold text-yellow-400 mb-1">경고</div>
                                                {alimTalkConfigData.warnings.map((warning: string, idx: number) => (
                                                    <div key={idx} className="text-xs text-gray-300">• {warning}</div>
                                                ))}
                                            </div>
                                        )}

                                        {alimTalkConfigData.errors && alimTalkConfigData.errors.length > 0 && (
                                            <div className="p-3 bg-red-500/10 border border-red-500 rounded-lg">
                                                <div className="text-xs font-bold text-red-400 mb-1">오류</div>
                                                {alimTalkConfigData.errors.map((error: string, idx: number) => (
                                                    <div key={idx} className="text-xs text-gray-300">• {error}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Error Logs Section */}
                    <Card className="shadow-lg border-t-4 border-t-red-500 bg-[#1e1e1e] border-[#333]">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-xl flex items-center gap-2 text-red-400">
                                ⚠️ 오류 로그 ({errorLogs.length})
                            </CardTitle>
                            <CardDescription className="text-gray-400">
                                시스템 오류 및 예외 사항 추적
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {errorLogs.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <div className="text-4xl mb-2">✅</div>
                                    <p>오류 없음</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-[#2a2a2a] text-gray-400 uppercase text-xs font-semibold">
                                            <tr>
                                                <th className="p-4 pl-6">시간</th>
                                                <th className="p-4">심각도</th>
                                                <th className="p-4">카테고리</th>
                                                <th className="p-4">메시지</th>
                                                <th className="p-4">발생 횟수</th>
                                                <th className="p-4">URL</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#333]">
                                            {errorLogs.map((log) => (
                                                <tr key={log.id} className="hover:bg-[#2a2a2a] transition-colors">
                                                    <td className="p-4 pl-6 text-gray-300">
                                                        {log.timestamp?.toDate ?
                                                            new Date(log.timestamp.toDate()).toLocaleTimeString('ko-KR') :
                                                            '-'}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${log.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                                                            log.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                                                                log.severity === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                                                                    'bg-gray-500/20 text-gray-400'
                                                            }`}>
                                                            {log.severity}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-gray-300">{log.category}</td>
                                                    <td className="p-4 text-gray-200 max-w-md truncate">{log.message}</td>
                                                    <td className="p-4 text-center font-bold text-gray-300">{log.occurrenceCount || 1}</td>
                                                    <td className="p-4 text-gray-400 text-xs max-w-xs truncate">{log.url || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Performance Metrics Section */}
                    <Card className="shadow-lg border-t-4 border-t-blue-500 bg-[#1e1e1e] border-[#333]">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-xl flex items-center gap-2 text-blue-400">
                                📊 성능 지표 ({performanceMetrics.length})
                            </CardTitle>
                            <CardDescription className="text-gray-400">
                                웹 바이탈 및 API 성능 측정
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {performanceMetrics.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <div className="text-4xl mb-2">📈</div>
                                    <p>성능 데이터 없음</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-[#2a2a2a] text-gray-400 uppercase text-xs font-semibold">
                                            <tr>
                                                <th className="p-4 pl-6">시간</th>
                                                <th className="p-4">지표</th>
                                                <th className="p-4">값</th>
                                                <th className="p-4">경로</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#333]">
                                            {performanceMetrics.slice(0, 20).map((metric) => (
                                                <tr key={metric.id} className="hover:bg-[#2a2a2a] transition-colors">
                                                    <td className="p-4 pl-6 text-gray-300">
                                                        {metric.timestamp?.toDate ?
                                                            new Date(metric.timestamp.toDate()).toLocaleTimeString('ko-KR') :
                                                            '-'}
                                                    </td>
                                                    <td className="p-4 text-gray-300 font-mono">{metric.metricName}</td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${metric.value > 3000 ? 'bg-red-500/20 text-red-400' :
                                                            metric.value > 1000 ? 'bg-yellow-500/20 text-yellow-400' :
                                                                'bg-green-500/20 text-green-400'
                                                            }`}>
                                                            {metric.value.toFixed(0)} {metric.unit}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-gray-400 text-xs max-w-xs truncate">{metric.url || metric.route || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Data Integrity Alerts Section */}
                    <Card className="shadow-lg border-t-4 border-t-orange-500 bg-[#1e1e1e] border-[#333]">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-xl flex items-center gap-2 text-orange-400">
                                🛡️ 데이터 무결성 알림 ({dataIntegrityAlerts.length})
                            </CardTitle>
                            <CardDescription className="text-gray-400">
                                데이터 무결성 위반 사항 감지
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {dataIntegrityAlerts.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <div className="text-4xl mb-2">✅</div>
                                    <p>무결성 이슈 없음</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-[#2a2a2a] text-gray-400 uppercase text-xs font-semibold">
                                            <tr>
                                                <th className="p-4 pl-6">시간</th>
                                                <th className="p-4">심각도</th>
                                                <th className="p-4">컬렉션</th>
                                                <th className="p-4">문서 ID</th>
                                                <th className="p-4">위반 규칙</th>
                                                <th className="p-4">해결 여부</th>
                                                <th className="p-4">작업</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#333]">
                                            {dataIntegrityAlerts.map((alert) => (
                                                <tr key={alert.id} className="hover:bg-[#2a2a2a] transition-colors">
                                                    <td className="p-4 pl-6 text-gray-300">
                                                        {alert.timestamp?.toDate ?
                                                            new Date(alert.timestamp.toDate()).toLocaleTimeString('ko-KR') :
                                                            '-'}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${alert.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                                                            alert.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                                                                'bg-yellow-500/20 text-yellow-400'
                                                            }`}>
                                                            {alert.severity}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-gray-300 text-xs font-mono">{alert.collection}</td>
                                                    <td className="p-4 text-gray-300 text-xs font-mono max-w-xs truncate">{alert.documentId}</td>
                                                    <td className="p-4 text-gray-200 text-sm">{alert.rule}</td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${alert.resolved ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                                            }`}>
                                                            {alert.resolved ? '해결됨' : '미해결'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        {!alert.resolved && (
                                                            <Button
                                                                onClick={() => resolveAlert(alert.id, `${alert.timestamp.toDate().toISOString().split('T')[0]}/${alert.id}`)}
                                                                disabled={resolvingAlertId === alert.id}
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 text-xs"
                                                            >
                                                                {resolvingAlertId === alert.id ? (
                                                                    <>
                                                                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                                        처리 중...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                                                        해결
                                                                    </>
                                                                )}
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
};
