"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWeeklyPerformanceReport = exports.sendDailyErrorReport = exports.sendErrorAlertEmail = exports.sendEmail = void 0;
const nodemailer = __importStar(require("nodemailer"));
/**
 * Email Utility for System Monitoring
 *
 * Sends emails using Gmail SMTP
 * Configuration via environment variables
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
 * Create reusable transporter
 */
let transporter = null;
function getTransporter() {
    if (!transporter) {
        if (!EMAIL_USER || !EMAIL_PASSWORD) {
            throw new Error('Email configuration not set');
        }
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: EMAIL_USER,
                pass: EMAIL_PASSWORD,
            },
        });
    }
    return transporter;
}
/**
 * Send email
 */
async function sendEmail({ to, subject, html, text, }) {
    try {
        if (!EMAIL_USER || !EMAIL_PASSWORD) {
            console.warn('[Email] Skipped - configuration not set');
            return;
        }
        const transport = getTransporter();
        await transport.sendMail({
            from: EMAIL_FROM,
            to: Array.isArray(to) ? to.join(', ') : to,
            subject,
            html: html || text,
            text: text || (html === null || html === void 0 ? void 0 : html.replace(/<[^>]*>/g, '')), // Strip HTML if text not provided
        });
        console.log(`[Email] Sent to: ${Array.isArray(to) ? to.join(', ') : to}`);
    }
    catch (error) {
        console.error('[Email] Failed to send:', error);
        throw error;
    }
}
exports.sendEmail = sendEmail;
/**
 * Send error alert email to admin
 */
async function sendErrorAlertEmail({ errorId, message, severity, category, occurrenceCount, url, userId, }) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@eregi.co.kr';
    const severityColors = {
        CRITICAL: '#dc2626',
        HIGH: '#f97316',
        MEDIUM: '#eab308',
        LOW: '#6b7280',
    };
    const color = severityColors[severity] || '#6b7280';
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: ${color};">⚠️ ${severity} Error Detected</h2>

            <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p><strong>Error ID:</strong> ${errorId}</p>
                <p><strong>Message:</strong> ${message}</p>
                <p><strong>Category:</strong> ${category}</p>
                <p><strong>Severity:</strong> <span style="color: ${color}; font-weight: bold;">${severity}</span></p>
                <p><strong>Occurrences:</strong> ${occurrenceCount}</p>
                ${url ? `<p><strong>URL:</strong> <a href="${url}">${url}</a></p>` : ''}
                ${userId ? `<p><strong>User ID:</strong> ${userId}</p>` : ''}
            </div>

            <p style="color: #6b7280; font-size: 14px;">
                Check the monitoring dashboard for more details.
            </p>
        </div>
    `;
    await sendEmail({
        to: adminEmail,
        subject: `🚨 [${severity}] ${category} Error Detected`,
        html,
    });
}
exports.sendErrorAlertEmail = sendErrorAlertEmail;
/**
 * Send daily error report
 */
async function sendDailyErrorReport({ date, totalErrors, criticalErrors, highErrors, topErrors, }) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@eregi.co.kr';
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>📊 Daily Error Report - ${date}</h2>

            <div style="display: flex; gap: 16px; margin: 20px 0;">
                <div style="flex: 1; background: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #dc2626;">${criticalErrors}</div>
                    <div style="font-size: 14px; color: #6b7280;">Critical</div>
                </div>
                <div style="flex: 1; background: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #f97316;">${highErrors}</div>
                    <div style="font-size: 14px; color: #6b7280;">High</div>
                </div>
                <div style="flex: 1; background: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #6b7280;">${totalErrors}</div>
                    <div style="font-size: 14px; color: #6b7280;">Total</div>
                </div>
            </div>

            ${topErrors.length > 0 ? `
                <h3>Top Errors</h3>
                <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                    <thead>
                        <tr style="background: #f3f4f6;">
                            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Error</th>
                            <th style="padding: 8px; text-align: center; border-bottom: 2px solid #e5e7eb;">Count</th>
                            <th style="padding: 8px; text-align: center; border-bottom: 2px solid #e5e7eb;">Severity</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${topErrors.map(error => `
                            <tr>
                                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${error.message}</td>
                                <td style="padding: 8px; text-align: center; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${error.occurrenceCount}</td>
                                <td style="padding: 8px; text-align: center; border-bottom: 1px solid #e5e7eb;">${error.severity}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p style="color: #10b981;">✅ No errors reported</p>'}
        </div>
    `;
    await sendEmail({
        to: adminEmail,
        subject: `📊 Daily Error Report - ${date}`,
        html,
    });
}
exports.sendDailyErrorReport = sendDailyErrorReport;
/**
 * Send weekly performance report
 */
async function sendWeeklyPerformanceReport({ weekStart, weekEnd, avgLoadTime, slowestPages, totalRequests, }) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@eregi.co.kr';
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>📈 Weekly Performance Report</h2>
            <p style="color: #6b7280;">${weekStart} - ${weekEnd}</p>

            <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <div style="display: flex; gap: 16px;">
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 32px; font-weight: bold; color: ${avgLoadTime > 3000 ? '#dc2626' : avgLoadTime > 1000 ? '#f97316' : '#10b981'};">
                            ${avgLoadTime.toFixed(0)}ms
                        </div>
                        <div style="font-size: 14px; color: #6b7280;">Avg Load Time</div>
                    </div>
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 32px; font-weight: bold; color: #6b7280;">
                            ${totalRequests}
                        </div>
                        <div style="font-size: 14px; color: #6b7280;">Total Requests</div>
                    </div>
                </div>
            </div>

            ${slowestPages.length > 0 ? `
                <h3>Slowest Pages</h3>
                <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                    <thead>
                        <tr style="background: #f3f4f6;">
                            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Page</th>
                            <th style="padding: 8px; text-align: right; border-bottom: 2px solid #e5e7eb;">Avg Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${slowestPages.map(page => `
                            <tr>
                                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${page.url}</td>
                                <td style="padding: 8px; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: ${page.avgLoadTime > 3000 ? '#dc2626' : '#6b7280'};">
                                    ${page.avgLoadTime.toFixed(0)}ms
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p>No performance data available</p>'}
        </div>
    `;
    await sendEmail({
        to: adminEmail,
        subject: `📈 Weekly Performance Report`,
        html,
    });
}
exports.sendWeeklyPerformanceReport = sendWeeklyPerformanceReport;
//# sourceMappingURL=email.js.map