import React from 'react';

/**
 * [Design Agent Note]
 * This component serves as a VISUAL GUIDE for the "Submission Confirmation Email".
 * It is not used directly in the app execution but is a reference for the 
 * HTML email template development to ensure the same tone & manner as the Success Page.
 */

export const ConfirmationEmailPreview = () => {
    return (
        <div style={{
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            maxWidth: '600px',
            margin: '0 auto',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid #e2e8f0'
        }}>
            {/* Header: Deep Blue Brand Color */}
            <div style={{
                backgroundColor: '#003366',
                padding: '32px 24px',
                textAlign: 'center',
                color: '#ffffff'
            }}>
                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>초록 접수 확인</h1>
                <p style={{ margin: '8px 0 0 0', opacity: 0.8, fontSize: '14px' }}>Submission Confirmation</p>
            </div>

            {/* Content Body */}
            <div style={{ padding: '40px 32px', textAlign: 'center' }}>
                {/* Success Icon */}
                <div style={{
                    width: '64px',
                    height: '64px',
                    backgroundColor: '#dcfce7', // green-100
                    color: '#16a34a', // green-600
                    borderRadius: '50%',
                    fontSize: '32px',
                    lineHeight: '64px',
                    margin: '0 auto 24px auto',
                    textAlign: 'center'
                }}>
                    ✓
                </div>

                <h2 style={{ color: '#1e293b', fontSize: '20px', fontWeight: 'bold', margin: '0 0 16px 0' }}>
                    초록이 성공적으로 접수되었습니다.
                </h2>
                <p style={{ color: '#64748b', fontSize: '16px', lineHeight: '1.6', margin: '0 0 32px 0' }}>
                    귀하의 소중한 연구 초록이 안전하게 서버에 저장되었습니다.<br />
                    심사 결과는 추후 마이페이지를 통해 확인하실 수 있습니다.
                </p>

                {/* Info Card */}
                <div style={{
                    backgroundColor: '#f8fafc',
                    borderRadius: '12px',
                    padding: '24px',
                    textAlign: 'left',
                    marginBottom: '32px',
                    border: '1px solid #e2e8f0'
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '8px 0', color: '#64748b', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>접수 번호</td>
                                <td style={{ padding: '8px 0', color: '#0f172a', fontWeight: 'bold', textAlign: 'right' }}>#SUB-2026-001</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 0', color: '#64748b', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>제출 일시</td>
                                <td style={{ padding: '8px 0', color: '#0f172a', fontWeight: 'bold', textAlign: 'right' }}>2026. 01. 18.</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 0', color: '#64748b', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>발표자</td>
                                <td style={{ padding: '8px 0', color: '#0f172a', fontWeight: 'bold', textAlign: 'right' }}>홍길동 (Gildong Hong)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Primary Button */}
                <a href="https://eregi.co.kr/mypage" style={{
                    display: 'inline-block',
                    backgroundColor: '#003366',
                    color: '#ffffff',
                    padding: '16px 32px',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    boxShadow: '0 4px 6px -1px rgba(0, 51, 102, 0.2)'
                }}>
                    마이페이지에서 확인하기
                </a>
            </div>

            {/* Footer */}
            <div style={{
                backgroundColor: '#f8fafc',
                padding: '24px',
                textAlign: 'center',
                borderTop: '1px solid #e2e8f0'
            }}>
                <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>
                    본 메일은 발신 전용입니다. 문의사항은 학회 사무국으로 연락 바랍니다.
                </p>
                <p style={{ color: '#cbd5e1', fontSize: '12px', margin: '8px 0 0 0' }}>
                    © 2026 e-Regi Platform. All rights reserved.
                </p>
            </div>
        </div>
    );
};
