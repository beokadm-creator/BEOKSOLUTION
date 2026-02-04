import React, { useState } from 'react';
import { useConference } from '../../hooks/useConference';
import { useVendor } from '../../hooks/useVendor';
import VendorDashboard from './VendorDashboard';

const VendorPage: React.FC = () => {
    const { id: confId, loading: confLoading } = useConference();
    const { vendor, login, loading, error } = useVendor(confId || '');
    const [code, setCode] = useState('');

    if (confLoading) return <div>Loading...</div>;

    if (vendor) {
        return <VendorDashboard confId={confId || ''} />;
    }

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        login(code);
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f5f6fa' }}>
            <div style={{ padding: 40, backgroundColor: 'white', borderRadius: 10, boxShadow: '0 4px 10px rgba(0,0,0,0.1)', width: '100%', maxWidth: 400 }}>
                <h1 style={{ textAlign: 'center', marginBottom: 30 }}>Vendor Login</h1>
                <form onSubmit={handleLogin}>
                    <input 
                        type="password"
                        placeholder="Vendor Code" 
                        value={code} 
                        onChange={e => setCode(e.target.value)} 
                        style={{ width: '100%', padding: 15, fontSize: 16, marginBottom: 20, borderRadius: 5, border: '1px solid #ddd' }}
                    />
                    {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}
                    <button 
                        type="submit" 
                        disabled={loading}
                        style={{ width: '100%', padding: 15, fontSize: 16, backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' }}
                    >
                        {loading ? 'Verifying...' : 'Login'}
                    </button>
                </form>
                <p style={{ textAlign: 'center', marginTop: 20, color: '#888', fontSize: 12 }}>
                    Try code: VENDOR123
                </p>
            </div>
        </div>
    );
};

export default VendorPage;
