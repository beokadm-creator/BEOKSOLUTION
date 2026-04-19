import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/card';
import {
    Building2,
    Calendar,
    Users,
    Settings,
    Activity,
    LogOut,
    Key,
    Store
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { SocietyTab } from '../../components/admin/super/SocietyTab';
import { ConferenceTab } from '../../components/admin/super/ConferenceTab';
import { MembersTab } from '../../components/admin/super/MembersTab';
import { CodesTab } from '../../components/admin/super/CodesTab';
import { SettingsTab } from '../../components/admin/super/SettingsTab';
import { MonitoringTab } from '../../components/admin/super/MonitoringTab';
import { VendorsTab } from '../../components/admin/super/VendorsTab';

const SuperAdminPage: React.FC = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'SOCIETY' | 'CONFERENCE' | 'MEMBERS' | 'CODES' | 'SETTINGS' | 'MONITORING' | 'VENDORS'>('SOCIETY');

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/admin/login');
        } catch (e) {
            console.error("Logout Error:", e);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <h1 className="text-xl font-bold tracking-tight">Super Admin <span className="text-slate-400 font-normal">Console</span></h1>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Logout
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Navigation Tabs */}
                <div className="flex flex-wrap gap-2 mb-8 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                    <TabButton active={activeTab === 'SOCIETY'} onClick={() => setActiveTab('SOCIETY')} icon={<Building2 className="w-4 h-4" />} label="Societies" color="amber" />
                    <TabButton active={activeTab === 'CONFERENCE'} onClick={() => setActiveTab('CONFERENCE')} icon={<Calendar className="w-4 h-4" />} label="Conferences" color="green" />
                    <TabButton active={activeTab === 'MEMBERS'} onClick={() => setActiveTab('MEMBERS')} icon={<Users className="w-4 h-4" />} label="Members" color="blue" />
                    <TabButton active={activeTab === 'CODES'} onClick={() => setActiveTab('CODES')} icon={<Key className="w-4 h-4" />} label="Codes" color="indigo" />
                    <TabButton active={activeTab === 'VENDORS'} onClick={() => setActiveTab('VENDORS')} icon={<Store className="w-4 h-4" />} label="Vendors" color="orange" />
                    <div className="w-px bg-slate-200 mx-2 hidden md:block" />
                    <TabButton active={activeTab === 'SETTINGS'} onClick={() => setActiveTab('SETTINGS')} icon={<Settings className="w-4 h-4" />} label="Settings" color="slate" />
                    <TabButton active={activeTab === 'MONITORING'} onClick={() => setActiveTab('MONITORING')} icon={<Activity className="w-4 h-4" />} label="Monitoring" color="red" />
                </div>

                {/* Tab Contents */}
                <div className="animate-in fade-in duration-300">
                    {activeTab === 'SOCIETY' && <SocietyTab />}
                    {activeTab === 'CONFERENCE' && <ConferenceTab />}
                    {activeTab === 'MEMBERS' && <MembersTab />}
                    {activeTab === 'CODES' && <CodesTab />}
                    {activeTab === 'SETTINGS' && <SettingsTab />}
                    {activeTab === 'MONITORING' && <MonitoringTab />}
                    {activeTab === 'VENDORS' && <VendorsTab />}
                </div>
            </main>
        </div>
    );
};

const Shield = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

const TabButton = ({ active, onClick, icon, label, color }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, color: string }) => {
    const colorClasses: Record<string, string> = {
        amber: active ? 'bg-[#fbbf24] text-black shadow-md' : 'hover:bg-amber-50 text-slate-600',
        green: active ? 'bg-green-600 text-white shadow-md' : 'hover:bg-green-50 text-slate-600',
        blue: active ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-blue-50 text-slate-600',
        indigo: active ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-indigo-50 text-slate-600',
        orange: active ? 'bg-orange-500 text-white shadow-md' : 'hover:bg-orange-50 text-slate-600',
        slate: active ? 'bg-slate-800 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600',
        red: active ? 'bg-red-500 text-white shadow-md' : 'hover:bg-red-50 text-slate-600',
    };

    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${colorClasses[color]}`}
        >
            {icon} {label}
        </button>
    );
};

export default SuperAdminPage;
