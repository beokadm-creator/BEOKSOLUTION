import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLog, PerformanceMetric, DataIntegrityAlert } from '../types/schema';

interface UseMonitoringDataOptions {
    confId?: string;
    societyId?: string;
}

export const useMonitoringData = (selectedDate: string, options?: UseMonitoringDataOptions) => {
    const { confId, societyId } = options || {};

    const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
    const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
    const [dataIntegrityAlerts, setDataIntegrityAlerts] = useState<DataIntegrityAlert[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchErrorLogs = useCallback(async (date: string) => {
        try {
            const errorsRef = collection(db, `logs/errors/${date}`);
            const snapshot = await getDocs(errorsRef);
            const logs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ErrorLog));
            setErrorLogs(logs);
        } catch (err) {
            console.error('[useMonitoringData] Fetch error logs failed:', err);
            throw err;
        }
    }, []);

    const fetchPerformanceMetrics = useCallback(async (date: string) => {
        try {
            const perfRef = collection(db, `logs/performance/${date}`);
            const snapshot = await getDocs(perfRef);
            const metrics = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as PerformanceMetric));
            setPerformanceMetrics(metrics);
        } catch (err) {
            console.error('[useMonitoringData] Fetch performance metrics failed:', err);
            throw err;
        }
    }, []);

    const fetchDataIntegrityAlerts = useCallback(async (date: string) => {
        try {
            const integrityRef = collection(db, `logs/data_integrity/${date}`);
            const snapshot = await getDocs(integrityRef);
            const alerts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as DataIntegrityAlert));
            setDataIntegrityAlerts(alerts);
        } catch (err) {
            console.error('[useMonitoringData] Fetch data integrity alerts failed:', err);
            throw err;
        }
    }, []);

    const fetchAllData = useCallback(async (date: string) => {
        setLoading(true);
        setError(null);
        try {
            await Promise.all([
                fetchErrorLogs(date),
                fetchPerformanceMetrics(date),
                fetchDataIntegrityAlerts(date)
            ]);
        } catch (err) {
            setError('Failed to fetch monitoring data');
            console.error('[useMonitoringData] Fetch all data failed:', err);
        } finally {
            setLoading(false);
        }
    }, [fetchErrorLogs, fetchPerformanceMetrics, fetchDataIntegrityAlerts]);

    useEffect(() => {
        if (selectedDate) {
            fetchAllData(selectedDate);
        }
    }, [selectedDate, fetchAllData]);

    // Filter metrics by confId or societyId
    const filteredPerformanceMetrics = useMemo(() => {
        if (!confId && !societyId) return performanceMetrics;

        return performanceMetrics.filter(metric => {
            // Filter by confId if provided
            if (confId && metric.confId !== confId) return false;

            // Filter by societyId if provided
            if (societyId && metric.societyId !== societyId) return false;

            return true;
        });
    }, [performanceMetrics, confId, societyId]);

    // Filter error logs by confId or societyId (if they have these fields)
    const filteredErrorLogs = useMemo(() => {
        if (!confId && !societyId) return errorLogs;

        return errorLogs.filter(log => {
            // Check if log has confId/societyId in metadata
            const logConfId = log.metadata?.confId as string | undefined;
            const logSocietyId = log.metadata?.societyId as string | undefined;

            // Filter by confId if provided
            if (confId && logConfId !== confId) return false;

            // Filter by societyId if provided
            if (societyId && logSocietyId !== societyId) return false;

            return true;
        });
    }, [errorLogs, confId, societyId]);

    // Filter data integrity alerts by confId or societyId
    const filteredDataIntegrityAlerts = useMemo(() => {
        if (!confId && !societyId) return dataIntegrityAlerts;

        return dataIntegrityAlerts.filter(alert => {
            // Extract confId from collection path (e.g., "conferences/kap_2026spring/registrations")
            const pathParts = alert.collection.split('/');
            const alertConfId = pathParts[1]; // "kap_2026spring"

            // Extract societyId from confId (e.g., "kap_2026spring" -> "kap")
            const alertSocietyId = alertConfId?.split('_')[0]; // "kap"

            // Filter by confId if provided
            if (confId && alertConfId !== confId) return false;

            // Filter by societyId if provided
            if (societyId && alertSocietyId !== societyId) return false;

            return true;
        });
    }, [dataIntegrityAlerts, confId, societyId]);

    return {
        errorLogs: filteredErrorLogs,
        performanceMetrics: filteredPerformanceMetrics,
        dataIntegrityAlerts: filteredDataIntegrityAlerts,
        loading,
        error,
        refetch: () => fetchAllData(selectedDate)
    };
};
