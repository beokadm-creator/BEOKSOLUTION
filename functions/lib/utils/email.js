"use strict";
/**
 * Email Utility for System Monitoring
 *
 * TEMPORARILY DISABLED - nodemailer dependency not available
 * All functions are stubs that log but don't send emails
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.sendErrorAlertEmail = sendErrorAlertEmail;
exports.sendDailyErrorReport = sendDailyErrorReport;
exports.sendWeeklyPerformanceReport = sendWeeklyPerformanceReport;
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
async function sendEmail({ to, subject, html, text, }) {
    console.warn('[Email] Email sending temporarily disabled:', { to, subject });
}
/**
 * Send error alert email - STUB (disabled)
 */
async function sendErrorAlertEmail({ error, context, }) {
    console.warn('[Email] Error alert email temporarily disabled:', { error: error.message, context });
}
/**
 * Send daily error report - STUB (disabled)
 */
async function sendDailyErrorReport({ date, totalErrors, criticalErrors, highErrors, topErrors, }) {
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
async function sendWeeklyPerformanceReport({ weekStart, weekEnd, avgLoadTime, slowestPages, totalRequests, }) {
    console.warn('[Email] Weekly performance report email temporarily disabled:', {
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        avgLoadTime,
        totalRequests
    });
}
//# sourceMappingURL=email.js.map