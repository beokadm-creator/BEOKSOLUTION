import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendDailyErrorReport, sendWeeklyPerformanceReport } from '../utils/email';

/**
 * Scheduled: Daily Error Report
 *
 * Runs every day at 9 AM KST (midnight UTC)
 * Sends email summary of errors from previous day
 */
export const dailyErrorReport = functions.pubsub
    .schedule('0 0 * * *') // Every day at midnight UTC (9 AM KST)
    .timeZone('Asia/Seoul')
    .onRun(async (context) => {
        const db = admin.firestore();

        // Get yesterday's date in YYYY-MM-DD format (KST)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];

        functions.logger.log(`Generating daily error report for ${dateStr}`);

        try {
            // Query errors from yesterday
            const errorsRef = db.collection(`logs/errors/${dateStr}`);
            const snapshot = await errorsRef.get();

            if (snapshot.empty) {
                functions.logger.log('No errors found for yesterday');
                return null;
            }

            // Analyze errors
            let totalErrors = 0;
            let criticalErrors = 0;
            let highErrors = 0;
            const errorCounts = new Map<string, { count: number; error: any }>();

            snapshot.forEach((doc) => {
                const error = doc.data();
                totalErrors++;

                if (error.severity === 'CRITICAL') {
                    criticalErrors++;
                } else if (error.severity === 'HIGH') {
                    highErrors++;
                }

                // Group by error message for top errors
                const message = error.message;
                if (!errorCounts.has(message)) {
                    errorCounts.set(message, { count: 1, error });
                } else {
                    errorCounts.get(message)!.count += 1;
                }
            });

            // Sort by occurrence count
            const topErrors = Array.from(errorCounts.values())
                .sort((a, b) => b.count - a.count)
                .slice(0, 10) // Top 10 errors
                .map((item) => ({
                    message: item.error.message,
                    occurrenceCount: item.count,
                    severity: item.error.severity,
                }));

            // Send email report
            await sendDailyErrorReport({
                date: dateStr,
                totalErrors,
                criticalErrors,
                highErrors,
                topErrors,
            });

            functions.logger.log(`Daily error report sent for ${dateStr}`);
            return null;
        } catch (error: any) {
            functions.logger.error('Failed to generate daily error report:', error);
            throw error;
        }
    });

/**
 * Scheduled: Weekly Performance Report
 *
 * Runs every Monday at 9 AM KST
 * Sends weekly summary of performance metrics
 */
export const weeklyPerformanceReport = functions.pubsub
    .schedule('0 0 * * 1') // Every Monday at midnight UTC (9 AM KST)
    .timeZone('Asia/Seoul')
    .onRun(async (context) => {
        const db = admin.firestore();

        // Get last 7 days
        const today = new Date();
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);

        const dates: string[] = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            dates.push(date.toISOString().split('T')[0]);
        }

        functions.logger.log('Generating weekly performance report');

        try {
            // Collect performance metrics for the week
            let totalMetrics = 0;
            let totalLoadTime = 0;
            const pageMetrics = new Map<string, { count: number; totalTime: number }>();

            for (const dateStr of dates) {
                const perfRef = db.collection(`logs/performance/${dateStr}`);
                const snapshot = await perfRef.get();

                snapshot.forEach((doc) => {
                    const metric = doc.data();
                    totalMetrics++;
                    totalLoadTime += metric.value || 0;

                    // Group by URL
                    const url = metric.url || metric.route || 'unknown';
                    if (!pageMetrics.has(url)) {
                        pageMetrics.set(url, { count: 0, totalTime: 0 });
                    }

                    const summary = pageMetrics.get(url)!;
                    summary.count++;
                    summary.totalTime += metric.value || 0;
                });
            }

            // Calculate averages
            const avgLoadTime = totalMetrics > 0 ? totalLoadTime / totalMetrics : 0;
            const slowestPages = Array.from(pageMetrics.entries())
                .map(([url, data]) => ({
                    url,
                    avgLoadTime: data.totalTime / data.count,
                }))
                .sort((a, b) => b.avgLoadTime - a.avgLoadTime)
                .slice(0, 10);

            const weekEnd = dates[0];
            const weekStart = dates[dates.length - 1];

            // Send email report
            await sendWeeklyPerformanceReport({
                weekStart,
                weekEnd,
                avgLoadTime,
                slowestPages,
                totalRequests: totalMetrics,
            });

            functions.logger.log('Weekly performance report sent');
            return null;
        } catch (error: any) {
            functions.logger.error('Failed to generate weekly performance report:', error);
            throw error;
        }
    });
