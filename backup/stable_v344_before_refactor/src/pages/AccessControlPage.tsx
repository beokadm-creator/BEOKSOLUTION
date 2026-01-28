import React, { useState } from 'react';
import { useConference } from '../hooks/useConference';
import { useAccessControl } from '../hooks/useAccessControl';

const AccessControlPage: React.FC = () => {
    const { id: confId } = useConference();
    const { log, scanBadge } = useAccessControl(confId || '', 'ROOM_A'); // Hardcoded room for demo
    
    const [qrInput, setQrInput] = useState('');

    const handleScan = () => {
        scanBadge(qrInput);
        setQrInput(''); // Clear input for next scan
    };

    if (!confId) return <div>Loading...</div>;

    return (
        <div style={{ padding: 20 }}>
            <h1>Access Control (Room A)</h1>
            <div style={{ marginBottom: 20 }}>
                <input 
                    placeholder="Scan Badge QR..." 
                    value={qrInput} 
                    onChange={e => setQrInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleScan(); }} // Auto scan on enter (scanner behavior)
                    style={{ width: '300px', padding: 8 }}
                    autoFocus
                />
                <button onClick={handleScan} style={{ marginLeft: 10 }}>Scan</button>
            </div>

            <div style={{ 
                marginTop: 50, 
                padding: 40, 
                textAlign: 'center',
                backgroundColor: log.type === 'SUCCESS' ? '#d4edda' : (log.type === 'ERROR' ? '#f8d7da' : '#e2e3e5'),
                color: log.type === 'SUCCESS' ? '#155724' : (log.type === 'ERROR' ? '#721c24' : '#383d41'),
                borderRadius: 10
            }}>
                <h1 style={{ fontSize: '3rem', margin: 0 }}>
                    {log.type === 'SUCCESS' ? 'ALLOWED' : (log.type === 'ERROR' ? 'DENIED' : 'READY')}
                </h1>
                <p style={{ fontSize: '1.5rem', marginTop: 10 }}>{log.message}</p>
            </div>
        </div>
    );
};

export default AccessControlPage;
