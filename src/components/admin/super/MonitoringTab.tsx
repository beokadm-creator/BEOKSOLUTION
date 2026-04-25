import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../ui/card';
import { Activity, AlertTriangle, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '../../ui/button';
import { useMonitoringData } from '../../../hooks/useMonitoringData';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase';
import toast from 'react-hot-toast';
import { Badge } from '../../ui/badge';
import LoadingSpinner from '../../common/LoadingSpinner';

export const MonitoringTab: React.FC = () => {
    const [monitoringDate, setMonitoringDate] = useState(() => new Date().toISOString().split('T')[0]);
    const { data, loading: monitoringLoading, error, refetch: refetchMonitoring, resolveAlert } = useMonitoringData(monitoringDate);

    const [healthCheckData, setHealthCheckData] = useState<Record<string, unknown> | null>(null);
    const [healthCheckLoading, setHealthCheckLoading] = useState(false);
    const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);

    const fetchHealthCheck = async () => {
        setHealthCheckLoading(true);
        try {
            const checkFn = httpsCallable(functions, 'healthCheck');
            const res = await checkFn();
            setHealthCheckData(res.data as Record<string, unknown>);
            toast.success("Health check completed.");
        } catch (e) {
            console.error("Health Check Error:", e);
            toast.error("Health check failed.");
            setHealthCheckData({ status: 'fail', checks: { error: { status: 'fail', message: e instanceof Error ? e.message : 'Unknown' } } });
        } finally {
            setHealthCheckLoading(false);
        }
    };

    const handleResolveAlert = async (alertId: string) => {
        setResolvingAlertId(alertId);
        try {
            await resolveAlert(alertId, 'Super Admin Resolved', 'admin');
            toast.success("Alert resolved.");
        } catch (_e) {
            toast.error("Failed to resolve alert.");
        } finally {
            setResolvingAlertId(null);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-[#fbbf24] mb-2 flex items-center gap-2">
                        <Activity className="w-6 h-6" /> System Monitoring
                    </h2>
                    <p className="text-slate-400 text-sm">Track errors, performance, and data integrity in real-time</p>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <input
                        type="date"
                        value={monitoringDate}
                        onChange={(e) => setMonitoringDate(e.target.value)}
                        className="w-full md:w-auto bg-slate-800 border border-slate-700 text-slate-200 px-4 py-2 rounded-lg focus:border-[#fbbf24] focus:outline-none"
                    />
                    <Button onClick={refetchMonitoring} className="bg-[#fbbf24] hover:bg-[#e0a520] text-black font-bold whitespace-nowrap">
                        Refresh
                    </Button>
                </div>
            </div>

            {monitoringLoading ? (
                <div className="flex justify-center py-20"><LoadingSpinner /></div>
            ) : error ? (
                <div className="p-8 text-center text-red-400 bg-red-950/20 rounded-xl border border-red-900">
                    Failed to load monitoring data. Please try again.
                </div>
            ) : (
                <div className="space-y-6">
                    {/* System Health Check */}
                    <Card className="shadow-lg border-t-4 border-t-green-500 bg-slate-900 border-slate-800">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-xl flex items-center gap-2 text-green-400">
                                <ShieldAlert className="w-5 h-5" /> Backend Health Status
                            </CardTitle>
                            <CardDescription className="text-slate-400">
                                Run on-demand diagnostics for Cloud Functions and environment configs.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Button
                                onClick={fetchHealthCheck}
                                disabled={healthCheckLoading}
                                className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white font-bold"
                            >
                                {healthCheckLoading ? 'Running Diagnostics...' : 'Run Health Check'}
                            </Button>

                            {healthCheckData && (
                                <div className="mt-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className={`p-2 rounded-full ${healthCheckData.status === 'healthy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {healthCheckData.status === 'healthy' ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-lg text-slate-200">
                                                Status: <span className="uppercase">{healthCheckData.status}</span>
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                Last checked: {new Date().toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        {healthCheckData.checks && Object.entries(healthCheckData.checks as Record<string, any>).map(([key, check]) => (
                                            <div key={key} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                                                <span className="text-sm font-mono text-slate-300">{key}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-slate-400">{check.message}</span>
                                                    {check.status === 'pass' ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Integrity Alerts */}
                    <Card className="shadow-lg border-t-4 border-t-red-500 bg-slate-900 border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2 text-red-400">
                                <AlertTriangle className="w-5 h-5" /> Active Data Integrity Alerts
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {data?.alerts && data.alerts.length > 0 ? (
                                <div className="space-y-3">
                                    {data.alerts.map(alert => (
                                        <div key={alert.id} className="p-4 bg-slate-800 rounded-lg border border-red-900/50 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge className={`px-2 py-0.5 text-[10px] ${alert.severity === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                        {alert.severity.toUpperCase()}
                                                    </Badge>
                                                    <span className="font-bold text-slate-200">{alert.type}</span>
                                                </div>
                                                <p className="text-sm text-slate-400">{alert.message}</p>
                                                <p className="text-xs text-slate-500 mt-1">Detected: {alert.detectedAt.toLocaleString()}</p>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="border-red-900 text-red-400 hover:bg-red-950"
                                                disabled={resolvingAlertId === alert.id}
                                                onClick={() => handleResolveAlert(alert.id)}
                                            >
                                                {resolvingAlertId === alert.id ? 'Resolving...' : 'Mark Resolved'}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-8 text-center text-slate-500 flex flex-col items-center">
                                    <CheckCircle2 className="w-12 h-12 mb-2 opacity-20 text-green-500" />
                                    <p>No active integrity alerts. System is clean.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};
