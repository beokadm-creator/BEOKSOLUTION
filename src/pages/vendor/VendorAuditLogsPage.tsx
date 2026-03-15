import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { FileText, Filter, Calendar, Download, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import type { AuditLog, AuditAction } from '../../types/schema';

export default function VendorAuditLogsPage() {
    const { vendorId } = useParams<{ vendorId: string }>();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionFilter, setActionFilter] = useState<string>('all');
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
        start: '',
        end: ''
    });

    useEffect(() => {
        if (!vendorId) {
            setLoading(false);
            return;
        }

        fetchLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vendorId]);

    const fetchLogs = async () => {
        if (!vendorId) return;

        setLoading(true);
        setError(null);

        try {
            const logsRef = collection(db, `vendors/${vendorId}/audit_logs`);
            const q = query(
                logsRef,
                orderBy('timestamp', 'desc'),
                limit(500)
            );

            const snap = await getDocs(q);
            const logsData = snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                timestamp: d.data().timestamp instanceof Timestamp
                    ? d.data().timestamp
                    : Timestamp.fromDate(new Date(d.data().timestamp))
            } as AuditLog));

            setLogs(logsData);
        } catch (e) {
            console.error('Error fetching audit logs:', e);
            setError('감사 로그를 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = useMemo(() => {
        let result = logs;

        // Filter by action
        if (actionFilter !== 'all') {
            result = result.filter(log => log.action === actionFilter);
        }

        // Filter by date range
        if (dateRange.start) {
            const startDate = new Date(dateRange.start);
            startDate.setHours(0, 0, 0, 0);
            result = result.filter(log => {
                const logDate = log.timestamp.toDate();
                return logDate >= startDate;
            });
        }

        if (dateRange.end) {
            const endDate = new Date(dateRange.end);
            endDate.setHours(23, 59, 59, 999);
            result = result.filter(log => {
                const logDate = log.timestamp.toDate();
                return logDate <= endDate;
            });
        }

        return result;
    }, [logs, actionFilter, dateRange]);

    const handleExport = () => {
        if (!filteredLogs.length) return;

        const csvContent = [
            ['Timestamp', 'Action', 'Entity Type', 'Entity ID', 'Actor', 'Result', 'Details'].join(','),
            ...filteredLogs.map(log => [
                log.timestamp.toDate().toISOString(),
                log.action,
                log.entityType,
                log.entityId,
                `${log.actorType} (${log.actorEmail || log.actorId})`,
                log.result,
                JSON.stringify(log.details).replace(/"/g, '""')
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `audit_logs_${vendorId}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const getActionLabel = (action: AuditAction): string => {
        const labels: Record<AuditAction, string> = {
            'LEAD_CREATED': '리드 생성',
            'LEAD_VIEWED': '리드 조회',
            'LEAD_EXPORTED': '리드 내보내기',
            'LEAD_DELETED': '리드 삭제',
            'STAMP_CREATED': '스탬프 생성',
            'ALIMTALK_SENT': '알림톡 발송',
            'ALIMTALK_FAILED': '알림톡 실패',
            'CONSENT_WITHDRAWN': '동의 철회',
            'VENDOR_LOGIN': '벤더 로그인',
            'VENDOR_SETTINGS_CHANGED': '설정 변경'
        };
        return labels[action] || action;
    };

    const getResultIcon = (result: 'SUCCESS' | 'FAILURE') => {
        return result === 'SUCCESS'
            ? <CheckCircle className="w-4 h-4 text-green-500" />
            : <XCircle className="w-4 h-4 text-red-500" />;
    };

    if (loading) return <div className="p-8 flex justify-center"><LoadingSpinner /></div>;

    if (error) return (
        <div className="p-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span className="text-red-700">{error}</span>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">감사 로그 (Audit Logs)</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        파트너 계정의 모든 활동 내역을 추적합니다.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={fetchLogs}
                        variant="outline"
                        className="border-gray-300"
                    >
                        새로고침
                    </Button>
                    <Button
                        onClick={handleExport}
                        disabled={!filteredLogs.length}
                        className="bg-indigo-600 hover:bg-indigo-700"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        CSV 내보내기
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Filter className="w-4 h-4 inline mr-1" />
                                활동 유형
                            </label>
                            <select
                                value={actionFilter}
                                onChange={(e) => setActionFilter(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="all">전체</option>
                                <option value="LEAD_CREATED">리드 생성</option>
                                <option value="ALIMTALK_SENT">알림톡 발송</option>
                                <option value="ALIMTALK_FAILED">알림톡 실패</option>
                                <option value="CONSENT_WITHDRAWN">동의 철회</option>
                                <option value="VENDOR_LOGIN">로그인</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Calendar className="w-4 h-4 inline mr-1" />
                                시작일
                            </label>
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Calendar className="w-4 h-4 inline mr-1" />
                                종료일
                            </label>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600 text-sm">총 로그 수</span>
                            <FileText className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="text-2xl font-bold text-blue-900 mt-2">{logs.length}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-50 to-white border-green-100">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600 text-sm">성공</span>
                            <CheckCircle className="w-5 h-5 text-green-500" />
                        </div>
                        <div className="text-2xl font-bold text-green-900 mt-2">
                            {logs.filter(l => l.result === 'SUCCESS').length}
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-red-50 to-white border-red-100">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600 text-sm">실패</span>
                            <XCircle className="w-5 h-5 text-red-500" />
                        </div>
                        <div className="text-2xl font-bold text-red-900 mt-2">
                            {logs.filter(l => l.result === 'FAILURE').length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Logs Table */}
            <Card>
                <CardHeader>
                    <CardTitle>활동 내역</CardTitle>
                </CardHeader>
                <CardContent>
                    {filteredLogs.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            표시할 로그가 없습니다.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">시간</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">활동</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">대상</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수행자</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">결과</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {log.timestamp.toDate().toLocaleString('ko-KR')}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-2">
                                                    {getResultIcon(log.result)}
                                                    <span className="text-sm font-medium text-gray-900">
                                                        {getActionLabel(log.action)}
                                                    </span>
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {log.entityType} / {log.entityId.substring(0, 8)}...
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {log.actorEmail || log.actorId}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                                    log.result === 'SUCCESS'
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-red-100 text-red-800'
                                                }`}>
                                                    {log.result === 'SUCCESS' ? '성공' : '실패'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
