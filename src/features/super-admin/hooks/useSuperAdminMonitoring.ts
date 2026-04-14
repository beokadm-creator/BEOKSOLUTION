import { useState } from 'react';
import toast from 'react-hot-toast';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebase';
import { useMonitoringData } from '@/hooks/useMonitoringData';

export const useSuperAdminMonitoring = () => {
    const today = new Date().toISOString().split('T')[0];
    const [monitoringDate, setMonitoringDate] = useState(today);
    const { errorLogs, performanceMetrics, dataIntegrityAlerts, loading: monitoringLoading, refetch: refetchMonitoring } = useMonitoringData(monitoringDate);
    const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);

    // Health Check state
    const [healthCheckData, setHealthCheckData] = useState<unknown>(null);
    const [healthCheckLoading, setHealthCheckLoading] = useState(false);

    // AlimTalk Config Check state
    const [alimTalkConfigData, setAlimTalkConfigData] = useState<unknown>(null);
    const [alimTalkConfigLoading, setAlimTalkConfigLoading] = useState(false);
    const [selectedSocietyForAlimTalk, setSelectedSocietyForAlimTalk] = useState<string>('');

    // Resolve data integrity alert
    const resolveAlert = async (alertId: string, alertPath: string) => {
        setResolvingAlertId(alertId);
        try {
            const resolveAlertFunction = httpsCallable(functions, 'resolveDataIntegrityAlert');
            await resolveAlertFunction({ alertPath });
            toast.success('알림이 해결되었습니다');
            refetchMonitoring(); // Refresh monitoring data
        } catch (error: unknown) {
            console.error('[resolveAlert] Failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            toast.error('알림 해결 실패: ' + errorMessage);
        } finally {
            setResolvingAlertId(null);
        }
    };

    // Health Check
    const fetchHealthCheck = async () => {
        setHealthCheckLoading(true);
        try {
            const response = await fetch('https://us-central1-eregi-8fc1e.cloudfunctions.net/healthCheck');
            const data = await response.json();
            setHealthCheckData(data);
            if (data.status === 'healthy') {
                toast.success('시스템 정상');
            } else if (data.status === 'degraded') {
                toast('시스템 경고', { icon: '⚠️' });
            } else {
                toast.error('시스템 오류');
            }
        } catch (error: unknown) {
            console.error('[fetchHealthCheck] Failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            toast.error('헬스체크 실패: ' + errorMessage);
            setHealthCheckData({ status: 'unhealthy', error: errorMessage });
        } finally {
            setHealthCheckLoading(false);
        }
    };

    // AlimTalk Config Check
    const fetchAlimTalkConfig = async (societyId: string) => {
        if (!societyId) {
            toast.error('학회를 선택하세요');
            return;
        }

        setAlimTalkConfigLoading(true);
        try {
            const response = await fetch(`https://us-central1-eregi-8fc1e.cloudfunctions.net/checkAlimTalkConfigHttp?societyId=${societyId}`);
            const data = await response.json();
            setAlimTalkConfigData(data);

            if (data.success) {
                toast.success('알림톡 설정 정상');
            } else {
                toast.error(`알림톡 설정 오류: ${data.errors?.join(', ')}`);
            }
        } catch (error: unknown) {
            console.error('[fetchAlimTalkConfig] Failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            toast.error('알림톡 설정 확인 실패: ' + errorMessage);
            setAlimTalkConfigData({ success: false, error: errorMessage });
        } finally {
            setAlimTalkConfigLoading(false);
        }
    };

    return {
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
    };
};
