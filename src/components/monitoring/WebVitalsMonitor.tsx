import { useEffect, useRef } from 'react';
import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals';
import { logPerformanceIssue } from '@/utils/errorLogger';

/**
 * WebVitalsMonitor Component
 *
 * Monitors Core Web Vitals and sends to Firestore
 * Metrics tracked:
 * - LCP (Largest Contentful Paint): Loading performance
 * - INP (Interaction to Next Paint): Interactivity (replaces FID)
 * - CLS (Cumulative Layout Shift): Visual stability
 * - FCP (First Contentful Paint): Initial render
 * - TTFB (Time to First Byte): Server response time
 *
 * Usage:
 * Simply include <WebVitalsMonitor /> in your App.tsx
 */
export function WebVitalsMonitor() {
    const initializedRef = useRef(false);

    useEffect(() => {
        if (initializedRef.current) return; // Run only once

        initializedRef.current = true;

        // Thresholds for "poor" performance (based on Web Vitals benchmarks)
        const THRESHOLDS = {
            LCP: 2500,  // ms - Good: < 2.5s, Needs Improvement: 2.5-4s, Poor: > 4s
            INP: 200,   // ms - Good: < 200ms, Needs Improvement: 200-500ms, Poor: > 500ms
            CLS: 0.1,   // score - Good: < 0.1, Needs Improvement: 0.1-0.25, Poor: > 0.25
            FCP: 1800,  // ms - Good: < 1.8s, Needs Improvement: 1.8-3s, Poor: > 3s
            TTFB: 800,  // ms - Good: < 800ms, Needs Improvement: 800-1800ms, Poor: > 1800ms
        };

        // Route info
        const url = window.location.href;
        const route = window.location.pathname;

        // LCP: Largest Contentful Paint
        onLCP((metric) => {
            const value = metric.value;
            const threshold = THRESHOLDS.LCP;
            const isPoor = value > threshold;

            console.log(`[WebVitals] LCP: ${value.toFixed(0)}ms ${isPoor ? '⚠️' : '✅'}`);

            logPerformanceIssue(
                'LCP',
                value,
                threshold,
                {
                    url,
                    route,
                    metricType: 'LCP',
                    unit: 'ms',
                }
            );
        });

        // INP: Interaction to Next Paint (replaces FID)
        onINP((metric) => {
            const value = metric.value;
            const threshold = THRESHOLDS.INP;
            const isPoor = value > threshold;

            console.log(`[WebVitals] INP: ${value.toFixed(0)}ms ${isPoor ? '⚠️' : '✅'}`);

            logPerformanceIssue(
                'INP',
                value,
                threshold,
                {
                    url,
                    route,
                    metricType: 'INP',
                    unit: 'ms',
                }
            );
        });

        // CLS: Cumulative Layout Shift
        onCLS((metric) => {
            const value = metric.value;
            const threshold = THRESHOLDS.CLS;
            const isPoor = value > threshold;

            console.log(`[WebVitals] CLS: ${value.toFixed(3)} ${isPoor ? '⚠️' : '✅'}`);

            logPerformanceIssue(
                'CLS',
                value,
                threshold,
                {
                    url,
                    route,
                    metricType: 'CLS',
                    unit: 'score',
                }
            );
        });

        // FCP: First Contentful Paint
        onFCP((metric) => {
            const value = metric.value;
            const threshold = THRESHOLDS.FCP;
            const isPoor = value > threshold;

            console.log(`[WebVitals] FCP: ${value.toFixed(0)}ms ${isPoor ? '⚠️' : '✅'}`);

            logPerformanceIssue(
                'FCP',
                value,
                threshold,
                {
                    url,
                    route,
                    metricType: 'FCP',
                    unit: 'ms',
                }
            );
        });

        // TTFB: Time to First Byte
        onTTFB((metric) => {
            const value = metric.value;
            const threshold = THRESHOLDS.TTFB;
            const isPoor = value > threshold;

            console.log(`[WebVitals] TTFB: ${value.toFixed(0)}ms ${isPoor ? '⚠️' : '✅'}`);

            logPerformanceIssue(
                'TTFB',
                value,
                threshold,
                {
                    url,
                    route,
                    metricType: 'TTFB',
                    unit: 'ms',
                }
            );
        });

        console.log('[WebVitals] Monitoring initialized');
    }, []);

    // This component doesn't render anything
    return null;
}


