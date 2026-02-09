import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { ErrorLog, PerformanceMetric, DataIntegrityAlert } from '../types/schema';

export const useMonitoringData = (selectedDate: string) => {
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

    return {
        errorLogs,
        performanceMetrics,
        dataIntegrityAlerts,
        loading,
        error,
        refetch: () => fetchAllData(selectedDate)
    };
};
