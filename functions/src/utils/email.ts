import * as nodemailer from 'nodemailer';

/**
 * Email Utility
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
    console.warn('EMAIL_USER or EMAIL_PASSWORD not set. Email functionality will be disabled.');
}

/**
 * Create reusable transporter
 */
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
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
            text: text || html?.replace(/<[^>]*>/g, ''), // Strip HTML if text not provided
        });

        console.log(`[Email] Sent to: ${Array.isArray(to) ? to.join(', ') : to}`);
    } catch (error: any) {
        console.error('[Email] Failed to send:', error);
        throw error;
    }
}

/**
 * Send error alert email
 */
export async function sendErrorAlertEmail({
    errorId,
    message,
    severity,
    category,
    occurrenceCount,
    url,
    userId,
}: {
    errorId: string;
    message: string;
    severity: string;
    category: string;
    occurrenceCount: number;
    url?: string;
    userId?: string;
}): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@eregi.co.kr';

    const subject = `[${severity}] ${category} Error - ${errorId}`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">🚨 Error Alert</h2>
            <p>A <strong>${severity}</strong> error has been detected in the eRegi system.</p>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">Error ID</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${errorId}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">Severity</td>
                    <td style="padding: 8px; border: 1px solid #ddd; color: ${severity === 'CRITICAL' ? '#dc2626' : '#f59e0b'};">${severity}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">Category</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${category}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">Occurrences</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${occurrenceCount}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">Message</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${message}</td>
                </tr>
                ${url ? `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">URL</td>
                    <td style="padding: 8px; border: 1px solid #ddd;"><a href="${url}">${url}</a></td>
                </tr>
                ` : ''}
                ${userId ? `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">User ID</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${userId}</td>
                </tr>
                ` : ''}
            </table>

            <p style="color: #666; font-size: 14px;">
                Please check the Firebase Console for more details.
            </p>
        </div>
    `;

    await sendEmail({
        to: adminEmail,
        subject,
        html,
    });
}

/**
 * Send daily error report
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
    topErrors: Array<{
        errorId: string;
        message: string;
        category: string;
        occurrenceCount: number;
    }>;
}): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@eregi.co.kr';

    const subject = `[Daily Report] Error Summary - ${date}`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">📊 Daily Error Report</h2>
            <p>Error summary for <strong>${date}</strong></p>

            <div style="display: flex; gap: 10px; margin: 20px 0;">
                <div style="flex: 1; padding: 15px; background: #f0f9ff; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #2563eb;">${totalErrors}</div>
                    <div style="font-size: 14px; color: #64748b;">Total Errors</div>
                </div>
                <div style="flex: 1; padding: 15px; background: #fef2f2; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #dc2626;">${criticalErrors}</div>
                    <div style="font-size: 14px; color: #64748b;">Critical</div>
                </div>
                <div style="flex: 1; padding: 15px; background: #fffbeb; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #f59e0b;">${highErrors}</div>
                    <div style="font-size: 14px; color: #64748b;">High</div>
                </div>
            </div>

            ${topErrors.length > 0 ? `
            <h3 style="margin-top: 30px;">Top Errors</h3>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                    <tr style="background: #f5f5f5;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Count</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Category</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Message</th>
                    </tr>
                </thead>
                <tbody>
                    ${topErrors.map(error => `
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${error.occurrenceCount}</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${error.category}</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${error.message.substring(0, 100)}${error.message.length > 100 ? '...' : ''}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : '<p style="color: #22c55e; margin-top: 20px;">✅ No errors recorded!</p>'}

            <p style="color: #666; font-size: 14px; margin-top: 30px;">
                Check Firebase Console for detailed logs.
            </p>
        </div>
    `;

    await sendEmail({
        to: adminEmail,
        subject,
        html,
    });
}
