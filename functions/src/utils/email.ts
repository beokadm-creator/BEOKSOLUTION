import * as nodemailer from 'nodemailer';

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

    } catch (error: unknown) {
        console.error('[Email] Failed to send:', error);
        throw error;
    }
}

/**
 * Send error alert email to admin
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

    const severityColors = {
        CRITICAL: '#dc2626',
        HIGH: '#f97316',
        MEDIUM: '#eab308',
        LOW: '#6b7280',
    };

    const color = severityColors[severity as keyof typeof severityColors] || '#6b7280';

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
    topErrors: Array<{ message: string; occurrenceCount: number; severity: string }>;
}): Promise<void> {
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

export async function sendBadgeTokenEmail({
    to,
    userName,
    societyName,
    eventName,
    badgePrepUrl,
    startDate,
    venueName,
    isEmailFallback = false,
}: {
    to: string;
    userName: string;
    societyName: string;
    eventName: string;
    badgePrepUrl: string;
    startDate?: string;
    venueName?: string;
    isEmailFallback?: boolean;
}): Promise<void> {
    const subject = isEmailFallback
        ? `[${societyName}] 배지 준비 안내 (알림톡 발송 실패 재발송)`
        : `[${societyName}] 배지 준비 안내`;

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
            <div style="background: #1d4ed8; padding: 24px; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 20px;">${societyName}</h1>
                <p style="color: #bfdbfe; margin: 4px 0 0 0; font-size: 14px;">학술대회 배지 준비 안내</p>
            </div>

            <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                ${isEmailFallback ? `
                <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px;">
                    <p style="margin: 0; color: #c2410c; font-size: 13px;">
                        ⚠️ 카카오 알림톡 발송에 실패하여 이메일로 재발송되었습니다.
                    </p>
                </div>` : ''}

                <p style="font-size: 16px; margin-top: 0;">안녕하세요, <strong>${userName}</strong>님.</p>

                <p style="color: #374151; line-height: 1.6;">
                    <strong>${eventName}</strong> 참가 등록이 완료되었습니다.<br>
                    아래 버튼을 눌러 배지 준비 페이지에서 등록 정보를 확인하고 배지를 준비하세요.
                </p>

                ${startDate || venueName ? `
                <div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 20px 0;">
                    ${startDate ? `<p style="margin: 0 0 8px 0; color: #374151;"><strong>📅 일시:</strong> ${startDate}</p>` : ''}
                    ${venueName ? `<p style="margin: 0; color: #374151;"><strong>📍 장소:</strong> ${venueName}</p>` : ''}
                </div>` : ''}

                <div style="text-align: center; margin: 32px 0;">
                    <a href="${badgePrepUrl}"
                       style="background: #1d4ed8; color: white; padding: 14px 32px; border-radius: 6px;
                              text-decoration: none; font-size: 16px; font-weight: bold; display: inline-block;">
                        배지 준비하기
                    </a>
                </div>

                <div style="border-top: 1px solid #e5e7eb; margin-top: 24px; padding-top: 16px;">
                    <p style="color: #6b7280; font-size: 13px; margin: 0; line-height: 1.6;">
                        버튼이 클릭되지 않을 경우 아래 링크를 복사하여 브라우저에 붙여넣기 하세요:<br>
                        <a href="${badgePrepUrl}" style="color: #1d4ed8; word-break: break-all;">${badgePrepUrl}</a>
                    </p>
                    <p style="color: #9ca3af; font-size: 12px; margin: 12px 0 0 0;">
                        본 메일은 발신 전용입니다. 문의는 학회 사무국으로 연락해 주세요.
                    </p>
                </div>
            </div>
        </div>
    `;

    await sendEmail({ to, subject, html });
}

/**
 * Send weekly performance report
 */
export async function sendWeeklyPerformanceReport({
    weekStart,
    weekEnd,
    avgLoadTime,
    slowestPages,
    totalRequests,
}: {
    weekStart: string;
    weekEnd: string;
    avgLoadTime: number;
    slowestPages: Array<{ url: string; avgLoadTime: number }>;
    totalRequests: number;
}): Promise<void> {
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
