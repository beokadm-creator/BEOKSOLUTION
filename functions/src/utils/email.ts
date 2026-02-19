/**
 * Email Utility for System Monitoring
 *
 * TEMPORARILY DISABLED - nodemailer dependency not available
 * All functions are stubs that log but don't send emails
 */

// Email configuration from environment
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'eRegi System <noreply@eregi.co.kr>';

// Validate configuration
if (!EMAIL_USER || !EMAIL_PASSWORD) {
    console.warn('[Email] EMAIL_USER or EMAIL_PASSWORD not set. Email functionality will be disabled.');
}

/**
 * Send email - STUB (disabled)
 */
export async function sendEmail({
    to,
    subject,
    html,
    text,
}: {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
}): Promise<void> {
    console.warn('[Email] Email sending temporarily disabled:', { to, subject });
}

/**
 * Send error alert email - STUB (disabled)
 */
export async function sendErrorAlertEmail({
    error,
    context,
}: {
    error: Error;
    context?: Record<string, unknown>;
}): Promise<void> {
    console.warn('[Email] Error alert email temporarily disabled:', { error: error.message, context });
}

/**
 * Send daily error report - STUB (disabled)
 */
export async function sendDailyErrorReport({
    date,
    totalErrors,
    criticalErrors,
    highErrors,
    topErrors,
}: {
    date: string;
    totalErrors: number;
    criticalErrors: number;
    highErrors: number;
    topErrors: Array<{ message: string; count: number }>;
}): Promise<void> {
    console.warn('[Email] Daily error report email temporarily disabled:', {
        date,
        totalErrors,
        criticalErrors,
        highErrors
    });
}

/**
 * Send weekly performance report - STUB (disabled)
 */
export async function sendWeeklyPerformanceReport({
    weekStart,
    weekEnd,
    avgLoadTime,
    slowestPages,
    totalRequests,
}: {
    weekStart: Date;
    weekEnd: Date;
    avgLoadTime: number;
    slowestPages: Array<{ path: string; avgLoadTime: number }>;
    totalRequests: number;
}): Promise<void> {
    console.warn('[Email] Weekly performance report email temporarily disabled:', {
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        avgLoadTime,
        totalRequests
    });
}
