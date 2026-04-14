import { useState } from 'react';
import { useSuperAdmin } from '../../hooks/useSuperAdmin';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Button } from '../../components/ui/button';
import { LogOut, Building2, Calendar, Users, Settings, Key, Activity, Store } from 'lucide-react';
import { auth } from '../../firebase';

import { SocietyTab } from '../../features/super-admin/components/SocietyTab';
import { ConferenceTab } from '../../features/super-admin/components/ConferenceTab';
import { SettingsTab } from '../../features/super-admin/components/SettingsTab';
import { MonitoringTab } from '../../features/super-admin/components/MonitoringTab';
import { MembersTab } from '../../features/super-admin/components/MembersTab';
import { CodesTab } from '../../features/super-admin/components/CodesTab';
import { VendorsTab } from '../../features/super-admin/components/VendorsTab';

const SuperAdminPage: React.FC = () => {
    const { societies, createSociety, createConference, refreshSocieties, loading } = useSuperAdmin();
    const [activeTab, setActiveTab] = useState<'SOCIETY' | 'CONFERENCE' | 'MEMBERS' | 'CODES' | 'SETTINGS' | 'MONITORING' | 'VENDORS'>('SOCIETY');

    const [currentSocietyId, setCurrentSocietyId] = useState<string>('');
    const effectiveSocietyId = currentSocietyId || societies[0]?.id || '';

    if (loading) {
        return <LoadingSpinner />;
    }

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900 p-4 sm:p-6">
            <header className="mb-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-3xl font-bold text-[#fbbf24] tracking-wider">ROOT CONTROL</h1>
                        <Button variant="outline" className="border-slate-300 text-slate-600 hover:bg-slate-200 hover:text-slate-900" onClick={() => auth.signOut()}>
                            <LogOut className="w-5 h-5" />
                        </Button>
                    </div>
                    <nav className="bg-white rounded-xl p-2 flex gap-2 border border-slate-200 shadow-sm">
                        {[
                            { id: 'SOCIETY', label: 'Societies', icon: <Building2 className="w-4 h-4" /> },
                            { id: 'CONFERENCE', label: 'Conferences', icon: <Calendar className="w-4 h-4" /> },
                            { id: 'MEMBERS', label: 'Members', icon: <Users className="w-4 h-4" /> },
                            { id: 'CODES', label: 'Codes', icon: <Key className="w-4 h-4" /> },
                            { id: 'SETTINGS', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
                            { id: 'MONITORING', label: '모니터링', icon: <Activity className="w-4 h-4" /> },
                            { id: 'VENDORS', label: 'Vendors', icon: <Store className="w-4 h-4" /> }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as 'SOCIETY' | 'CONFERENCE' | 'MEMBERS' | 'CODES' | 'SETTINGS' | 'MONITORING' | 'VENDORS')}
                                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === tab.id ? 'bg-[#fbbf24] text-black' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'}`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </header>

            <main className="max-w-7xl mx-auto">
                {activeTab === 'SOCIETY' && (
                    <SocietyTab societies={societies} refreshSocieties={refreshSocieties} createSociety={createSociety} />
                )}

                {activeTab === 'CONFERENCE' && (
                    <ConferenceTab societies={societies} createConference={createConference} />
                )}

                {activeTab === 'MEMBERS' && (
                    <MembersTab societies={societies} currentSocietyId={effectiveSocietyId} setCurrentSocietyId={setCurrentSocietyId} />
                )}

                {activeTab === 'CODES' && (
                    <CodesTab societies={societies} currentSocietyId={effectiveSocietyId} />
                )}

                {activeTab === 'SETTINGS' && (
                    <SettingsTab />
                )}

                {activeTab === 'MONITORING' && (
                    <MonitoringTab societies={societies} />
                )}

                {activeTab === 'VENDORS' && (
                    <VendorsTab />
                )}
            </main>
        </div>
    );
};

export default SuperAdminPage;
