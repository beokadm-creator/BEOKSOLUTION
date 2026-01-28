import React, { useState, useRef, useEffect } from 'react';
import { useVendor } from '../../hooks/useVendor';
import * as XLSX from 'xlsx';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';

interface Props {
    confId?: string;
}

const VendorDashboard: React.FC<Props> = ({ confId }) => {
    const { vendor, logout, scanBadge, scanResult, processVisit, visits, loading, conferenceId } = useVendor(confId);
    
    const [qrInput, setQrInput] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, [scanResult]);

    const handleScan = (e: React.FormEvent) => {
        e.preventDefault();
        if (qrInput.trim()) {
            scanBadge(qrInput);
            setQrInput('');
        }
    };

    const handleExport = async () => {
        if (!conferenceId || !vendor?.id) return;
        try {
            const q = query(
                collection(db, `conferences/${conferenceId}/booth_visits`),
                where('vendorId', '==', vendor.id),
                orderBy('timestamp', 'desc')
            );
            const snap = await getDocs(q);
            const data = snap.docs.map(d => {
                const v = d.data();
                return {
                    Time: v.timestamp?.toDate().toLocaleString(),
                    Name: v.visitorName,
                    Organization: v.visitorOrg,
                    Phone: v.visitorPhone,
                    Email: v.visitorEmail,
                    Consent: v.isConsentAgreed ? 'Yes' : 'No'
                };
            });

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Leads");
            XLSX.writeFile(wb, `${vendor.name}_Leads.xlsx`);
        } catch (e) {
            console.error("Export failed", e);
            alert("Export failed");
        }
    };

    return (
        <div style={{ padding: 20, maxWidth: 600, margin: '0 auto', fontFamily: 'sans-serif' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2>{vendor?.name}</h2>
                <button onClick={logout} style={{ padding: '5px 10px' }}>Logout</button>
            </div>

            {/* Scan Area */}
            {!scanResult ? (
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <form onSubmit={handleScan}>
                        <input 
                            ref={inputRef}
                            value={qrInput}
                            onChange={e => setQrInput(e.target.value)}
                            placeholder="Scan Visitor Badge QR"
                            style={{ width: '100%', padding: 20, fontSize: 20, borderRadius: 10, border: '2px solid #3498db', textAlign: 'center' }}
                            autoFocus
                        />
                    </form>
                    <p style={{ marginTop: 10, color: '#888' }}>Use a barcode scanner or type manually</p>
                </div>
            ) : (
                <div style={{ 
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                    backgroundColor: 'rgba(0,0,0,0.8)', color: 'white',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: 20, zIndex: 1000
                }}>
                    <h1 style={{ marginBottom: 20 }}>Visitor Detected</h1>
                    <div style={{ backgroundColor: 'white', color: 'black', padding: 30, borderRadius: 15, width: '100%', maxWidth: 400, textAlign: 'center' }}>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: 10 }}>Privacy Consent</h2>
                        <p style={{ marginBottom: 30, fontSize: '1.1rem', lineHeight: 1.5 }}>
                            Do you agree to provide your contact information to <strong>{vendor?.name}</strong> for marketing purposes?
                        </p>
                        
                        <div style={{ display: 'flex', gap: 15 }}>
                            <button 
                                onClick={() => processVisit(false)} 
                                disabled={loading}
                                style={{ flex: 1, padding: 15, fontSize: 18, backgroundColor: '#95a5a6', color: 'white', border: 'none', borderRadius: 8 }}
                            >
                                No (Anonymous)
                            </button>
                            <button 
                                onClick={() => processVisit(true)} 
                                disabled={loading}
                                style={{ flex: 1, padding: 15, fontSize: 18, backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: 8 }}
                            >
                                Yes (Agree)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats & Recent */}
            <div style={{ backgroundColor: 'white', padding: 20, borderRadius: 10, boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>Recent Visits</h3>
                    <button onClick={handleExport} style={{ padding: '8px 12px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.9rem' }}>
                        📥 Export Excel
                    </button>
                </div>
                <p>Total: {visits.length}</p>
                <ul style={{ listStyle: 'none', padding: 0, marginTop: 10 }}>
                    {visits.map(v => (
                        <li key={v.id} style={{ padding: '10px 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{v.visitorName}</span>
                            <span style={{ color: '#888', fontSize: 12 }}>
                                {v.timestamp.toLocaleTimeString()} 
                                {v.isConsentAgreed ? ' (Lead)' : ' (Anon)'}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default VendorDashboard;
