import React, { useState, useRef, useEffect } from 'react';
import { useVendor } from '../../hooks/useVendor';
import * as XLSX from 'xlsx';
import { Html5Qrcode } from 'html5-qrcode';

interface Props {
    confId?: string;
}

const VendorDashboard: React.FC<Props> = ({ confId: initialConfId }) => {
    const {
        vendor,
        conferences,
        conferenceId,
        setConferenceId,
        logout,
        scanBadge,
        scanResult,
        processVisit,
        visits,
        loading,
        error,
        resetScan,
        updateVendorProfile
    } = useVendor(initialConfId);

    const [qrInput, setQrInput] = useState('');
    const [tab, setTab] = useState<'scan' | 'settings'>('scan');
    const inputRef = useRef<HTMLInputElement>(null);

    // Camera Scan State
    const [isScanning, setIsScanning] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);

    // Profile state
    const [pName, setPName] = useState('');
    const [pDesc, setPDesc] = useState('');
    const [pHome, setPHome] = useState('');
    const [pProduct, setPProduct] = useState('');
    const prevVendorRef = useRef<typeof vendor | undefined>(undefined);

    useEffect(() => {
        if (vendor && vendor !== prevVendorRef.current) {
            setTimeout(() => {
                setPName(vendor.name || '');
                setPDesc(vendor.description || '');
                setPHome(vendor.homeUrl || '');
                setPProduct(vendor.productUrl || '');
            }, 0);
            prevVendorRef.current = vendor;
        }
    }, [vendor]);

    useEffect(() => {
        if (tab === 'scan') {
            inputRef.current?.focus();
        }
    }, [scanResult, tab]);

    const handleScan = (e: React.FormEvent) => {
        e.preventDefault();
        if (qrInput.trim()) {
            scanBadge(qrInput.trim());
            setQrInput('');
        }
    };

    const startScanner = () => {
        if (isScanning) return;
        setIsScanning(true);
        setCameraError(null);

        setTimeout(() => {
            if (!scannerRef.current) {
                const html5QrCode = new Html5Qrcode("vendor-reader");
                scannerRef.current = html5QrCode;

                html5QrCode.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    (decodedText) => {
                        scanBadge(decodedText);
                        // Stop immediately
                        stopScanner();
                    },
                    (_errorMessage) => {
                        // ignore general scan errors
                    }
                ).catch((_err) => {
                    console.error("Camera fail:", _err);
                    setCameraError("카메라 접근에 실패했습니다. 권한을 확인해주세요.");
                    setIsScanning(false);
                });
            }
        }, 300);
    };

    const stopScanner = () => {
        if (scannerRef.current) {
            scannerRef.current.stop().then(() => {
                scannerRef.current?.clear();
                scannerRef.current = null;
                setIsScanning(false);
            }).catch(console.error);
        } else {
            setIsScanning(false);
        }
    };

    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().then(() => scannerRef.current?.clear()).catch(console.error);
            }
        };
    }, []);

    const handleExport = async () => {
        if (!vendor?.id) return;
        try {
            const data = visits.map(v => ({
                Time: v.timestamp?.toLocaleString(),
                Name: v.visitorName,
                Organization: v.visitorOrg,
                Phone: v.visitorPhone,
                Email: v.visitorEmail,
                ConferenceId: v.conferenceId,
                Consent: v.isConsentAgreed ? 'Yes' : 'No'
            }));

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Leads");
            XLSX.writeFile(wb, `${vendor.name}_Leads.xlsx`);
        } catch (e) {
            console.error("Export failed", e);
            alert("Export failed");
        }
    };

    const handleSaveProfile = () => {
        updateVendorProfile({
            name: pName,
            description: pDesc,
            homeUrl: pHome,
            productUrl: pProduct
        });
    };

    if (loading && !vendor) {
        return <div style={{ padding: 20 }}>Loading Vendor Context...</div>;
    }

    if (error && !vendor) {
        return <div style={{ padding: 20, color: 'red' }}>Error: {error}</div>;
    }

    return (
        <div style={{ padding: 20, maxWidth: 800, margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, backgroundColor: 'white', padding: 20, borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div>
                    <h2 style={{ margin: 0 }}>{vendor?.name} <span style={{ fontSize: 14, color: '#888', fontWeight: 'normal' }}>| L3 Partner Admin</span></h2>
                </div>
                <div>
                    <button onClick={logout} style={{ padding: '8px 16px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' }}>Logout</button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <button
                    onClick={() => setTab('scan')}
                    style={{ flex: 1, padding: 15, fontSize: 16, backgroundColor: tab === 'scan' ? '#3498db' : 'white', color: tab === 'scan' ? 'white' : 'black', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer' }}>
                    QR 스캔 및 리드 관리
                </button>
                <button
                    onClick={() => setTab('settings')}
                    style={{ flex: 1, padding: 15, fontSize: 16, backgroundColor: tab === 'settings' ? '#3498db' : 'white', color: tab === 'settings' ? 'white' : 'black', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer' }}>
                    기업 정보 설정
                </button>
            </div>

            {tab === 'scan' && (
                <div>
                    {/* Conference Selector */}
                    {conferences.length > 0 && (
                        <div style={{ marginBottom: 20, padding: 15, backgroundColor: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                            <label style={{ fontWeight: 'bold', marginRight: 10 }}>현재 참여 학회 선택:</label>
                            <select
                                value={conferenceId || ''}
                                onChange={e => setConferenceId(e.target.value)}
                                style={{ padding: 8, borderRadius: 5, border: '1px solid #ccc' }}
                            >
                                {conferences.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Scan Area */}
                    {!scanResult ? (
                        <div style={{ textAlign: 'center', marginBottom: 40, backgroundColor: 'white', padding: '30px 20px', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>

                            {/* Camera UI */}
                            {isScanning ? (
                                <div style={{ marginBottom: 20 }}>
                                    <div id="vendor-reader" style={{ width: '100%', maxWidth: 400, margin: '0 auto', border: '2px solid #3498db', borderRadius: 10, overflow: 'hidden' }}></div>
                                    <button
                                        onClick={stopScanner}
                                        style={{ marginTop: 15, padding: '10px 20px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 'bold' }}
                                    >
                                        카메라 스캔 중지
                                    </button>
                                </div>
                            ) : (
                                <div style={{ marginBottom: 30 }}>
                                    <div style={{ padding: '30px', backgroundColor: '#f0f4f8', borderRadius: '15px', border: '2px dashed #3498db', margin: '0 auto', maxWidth: 400, cursor: 'pointer' }} onClick={startScanner}>
                                        <div style={{ fontSize: '40px', marginBottom: '10px' }}>📷</div>
                                        <h3 style={{ margin: 0, color: '#2c3e50' }}>모바일 카메라 스캔</h3>
                                        <p style={{ margin: '5px 0 0', color: '#7f8c8d', fontSize: '0.9rem' }}>터치하여 카메라 켜기</p>
                                    </div>
                                    {cameraError && <p style={{ color: '#e74c3c', marginTop: 10 }}>{cameraError}</p>}
                                </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: 20 }}>
                                <div style={{ height: '1px', backgroundColor: '#eee', flex: 1, maxWidth: 100 }}></div>
                                <span style={{ color: '#aaa', fontSize: '0.9rem' }}>또는 직접/바코드 입력</span>
                                <div style={{ height: '1px', backgroundColor: '#eee', flex: 1, maxWidth: 100 }}></div>
                            </div>

                            <form onSubmit={handleScan}>
                                <input
                                    ref={inputRef}
                                    value={qrInput}
                                    onChange={e => setQrInput(e.target.value)}
                                    placeholder="QR 코드 직접 입력"
                                    style={{ width: '100%', maxWidth: 400, padding: 15, fontSize: 16, borderRadius: 8, border: '1px solid #ddd', textAlign: 'center' }}
                                />
                            </form>
                            {error && <p style={{ color: 'red', marginTop: 10 }}>{error}</p>}
                        </div>
                    ) : (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.85)', color: 'white',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            padding: 20, zIndex: 1000
                        }}>
                            <div style={{ backgroundColor: 'white', color: 'black', padding: 40, borderRadius: 15, width: '100%', maxWidth: 450, textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                                <h1 style={{ marginBottom: 5, fontSize: '1.8rem', color: '#2c3e50' }}>{scanResult.user.name} 님</h1>
                                <p style={{ marginBottom: 20, color: '#7f8c8d' }}>{scanResult.reg.affiliation || scanResult.user.affiliation || '소속 미상'}</p>

                                <div style={{ borderTop: '1px solid #eee', borderBottom: '1px solid #eee', padding: '20px 0', marginBottom: 30 }}>
                                    <h2 style={{ fontSize: '1.2rem', marginBottom: 15, color: '#e74c3c' }}>제3자 개인정보 제공 동의</h2>
                                    <p style={{ fontSize: '1rem', lineHeight: 1.6, color: '#555' }}>
                                        귀하의 연락처 정보(이름, 소속, 이메일, 연락처)를 <strong>{vendor?.name}</strong>에 마케팅 및 안내 목적으로 제공하는 것에 동의하십니까?
                                    </p>
                                    <p style={{ fontSize: '0.85rem', color: '#888', marginTop: 10 }}>
                                        * 동의 거부 시에도 스탬프 투어 인증은 처리됩니다 (익명).
                                    </p>
                                </div>

                                <div style={{ display: 'flex', gap: 15 }}>
                                    <button
                                        onClick={() => processVisit(false)}
                                        disabled={loading}
                                        style={{ flex: 1, padding: 15, fontSize: 16, backgroundColor: '#95a5a6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                                    >
                                        거부 (스탬프만)
                                    </button>
                                    <button
                                        onClick={() => processVisit(true)}
                                        disabled={loading}
                                        style={{ flex: 1, padding: 15, fontSize: 16, backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
                                    >
                                        동의 (제공)
                                    </button>
                                </div>
                                <button onClick={resetScan} style={{ marginTop: 20, background: 'none', border: 'none', color: '#95a5a6', textDecoration: 'underline', cursor: 'pointer' }}>취소</button>
                            </div>
                        </div>
                    )}

                    {/* Stats & Recent */}
                    <div style={{ backgroundColor: 'white', padding: 25, borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 style={{ margin: 0, color: '#2c3e50' }}>수집된 리드 데이터 (Leads)</h3>
                            <button onClick={handleExport} style={{ padding: '8px 16px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                📥 엑셀 다운로드
                            </button>
                        </div>
                        <p style={{ marginBottom: 15, color: '#7f8c8d' }}>총 {visits.length} 명</p>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #eee' }}>
                                        <th style={{ padding: 10 }}>시간</th>
                                        <th style={{ padding: 10 }}>이름</th>
                                        <th style={{ padding: 10 }}>소속</th>
                                        <th style={{ padding: 10 }}>상태</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visits.map(v => (
                                        <tr key={v.id} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: 10, color: '#555', fontSize: '0.9rem' }}>{v.timestamp.toLocaleString()}</td>
                                            <td style={{ padding: 10 }}>{v.visitorName}</td>
                                            <td style={{ padding: 10 }}>{v.visitorOrg || '-'}</td>
                                            <td style={{ padding: 10 }}>
                                                {v.isConsentAgreed
                                                    ? <span style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '0.85rem' }}>동의 (Lead)</span>
                                                    : <span style={{ color: '#95a5a6', fontSize: '0.85rem' }}>거절 (익명)</span>}
                                            </td>
                                        </tr>
                                    ))}
                                    {visits.length === 0 && (
                                        <tr>
                                            <td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#999' }}>데이터가 없습니다.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {tab === 'settings' && (
                <div style={{ backgroundColor: 'white', padding: 30, borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h2 style={{ marginBottom: 20, color: '#2c3e50' }}>기업 소개 및 정보 설정</h2>
                    <p style={{ color: '#7f8c8d', marginBottom: 30, lineHeight: 1.5 }}>
                        이 정보는 참가자들이 디지털 명찰이나 부스 안내에서 귀사를 클릭했을 때 보이는 "소개 페이지"에 노출됩니다.
                    </p>

                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 8 }}>파트너사명</label>
                        <input value={pName} onChange={e => setPName(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 6, border: '1px solid #ccc', fontSize: 16 }} />
                    </div>

                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 8 }}>간단 소개글 (참가자 노출용)</label>
                        <textarea value={pDesc} onChange={e => setPDesc(e.target.value)} rows={4} style={{ width: '100%', padding: 12, borderRadius: 6, border: '1px solid #ccc', fontSize: 16 }} placeholder="우리 회사를 나타내는 매력적인 소개글을 짧게 적어주세요." />
                    </div>

                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 8 }}>홈페이지 URL (CTA 버튼)</label>
                        <input value={pHome} onChange={e => setPHome(e.target.value)} placeholder="https://..." style={{ width: '100%', padding: 12, borderRadius: 6, border: '1px solid #ccc', fontSize: 16 }} />
                    </div>

                    <div style={{ marginBottom: 30 }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 8 }}>제품/서비스 소개서 URL (선택)</label>
                        <input value={pProduct} onChange={e => setPProduct(e.target.value)} placeholder="https://..." style={{ width: '100%', padding: 12, borderRadius: 6, border: '1px solid #ccc', fontSize: 16 }} />
                    </div>

                    <button
                        onClick={handleSaveProfile}
                        disabled={loading}
                        style={{ padding: '15px 30px', fontSize: 16, backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', width: '100%' }}
                    >
                        {loading ? '저장 중...' : '프로필 저장하기'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default VendorDashboard;
