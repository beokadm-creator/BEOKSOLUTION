import { logPerformanceIssue } from '@/utils/errorLogger';

/**
 * Hook to manually report performance metrics
 * Useful for custom performance measurements
 *
 * @example
 * const { reportMetric } = usePerformanceReporting();
 * reportMetric('CustomMetric', 1500, 1000, { customData: 'value' });
 */
export function usePerformanceReporting() {
    const reportMetric = (
        metricName: string,
        value: number,
        threshold: number,
        metadata?: Record<string, unknown>
    ) => {
        logPerformanceIssue(metricName, value, threshold, {
            ...metadata,
            url: window.location.href,
            route: window.location.pathname,
        });
    };

    return { reportMetric };
}
