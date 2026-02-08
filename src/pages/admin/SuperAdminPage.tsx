import { useState, useCallback, useEffect } from 'react';
import { useSuperAdmin } from '../../hooks/useSuperAdmin';
import { useMonitoringData } from '../../hooks/useMonitoringData';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../components/ui/card';
import { LogOut, Plus, Building2, Calendar, Edit, Save, Users, Settings, Trash2, Key, ShieldCheck, Search, Filter, Activity } from 'lucide-react';
import { auth, functions } from '../../firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, updateDoc, getDocs, collection, getDoc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';

import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';

const SuperAdminPage: React.FC = () => {
    const { societies, createSociety, createConference, loading } = useSuperAdmin();
    const [activeTab, setActiveTab] = useState<'SOCIETY' | 'CONFERENCE' | 'MEMBERS' | 'CODES' | 'SETTINGS' | 'MONITORING'>('SOCIETY');

    const [socNameKo, setSocNameKo] = useState('');
    const [socNameEn, setSocNameEn] = useState('');
    const [socAdmin, setSocAdmin] = useState('');

    const [selectedSocId, setSelectedSocId] = useState('');
    const [slug, setSlug] = useState('');
    const [titleKo, setTitleKo] = useState('');
    const [titleEn, setTitleEn] = useState('');
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [location, setLocation] = useState('');

    const [currentSocietyId, setCurrentSocietyId] = useState<string>('');
    const [members, setMembers] = useState<Array<{ id: string; name?: string; email?: string; phone?: string; organization?: string; affiliation?: string; marketingAgreed?: boolean; infoAgreed?: boolean; createdAt?: { seconds: number } }>>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);

    const [codes, setCodes] = useState<Array<{ id: string; societyId: string; name: string; code: string; used: boolean; usedBy?: string; usedAt?: { seconds: number } | Date; expiryDate?: { seconds: number } | Date }>>([]);
    const [loadingCodes, setLoadingCodes] = useState(false);
    const [newCodeName, setNewCodeName] = useState('');
    const [newCodeValue, setNewCodeValue] = useState('');
    const [newCodeSocId, setNewCodeSocId] = useState('');
    const [newCodeExpiry, setNewCodeExpiry] = useState('');

    const [settingsLang, setSettingsLang] = useState<'KO' | 'EN'>('KO');
    const [termsService, setTermsService] = useState('');
    const [termsServiceEn, setTermsServiceEn] = useState('');
    const [privacy, setPrivacy] = useState('');
    const [privacyEn, setPrivacyEn] = useState('');
    const [thirdParty, setThirdParty] = useState('');
    const [thirdPartyEn, setThirdPartyEn] = useState('');
    const [termsMarketing, setTermsMarketing] = useState('');
    const [termsMarketingEn, setTermsMarketingEn] = useState('');
    const [termsAdInfo, setTermsAdInfo] = useState('');
    const [termsAdInfoEn, setTermsAdInfoEn] = useState('');
    const [termsPrivacy, setTermsPrivacy] = useState('');
    const [termsPrivacyEn, setTermsPrivacyEn] = useState('');
    const [loadingSettings, setLoadingSettings] = useState(false);

    const [editingSoc, setEditingSoc] = useState<{ id: string; name: { ko: string; en?: string }; description?: { ko?: string }; homepageUrl?: string; adminEmails?: string[] } | null>(null);
    const [editDescKo, setEditDescKo] = useState('');
    const [editHomepage, setEditHomepage] = useState('');

    // Monitoring state
    const today = new Date().toISOString().split('T')[0];
    const [monitoringDate, setMonitoringDate] = useState(today);
    const { errorLogs, performanceMetrics, dataIntegrityAlerts, loading: monitoringLoading, refetch: refetchMonitoring } = useMonitoringData(monitoringDate);

    const fetchMembers = useCallback(async () => {
        console.log('[SuperAdminPage] fetchMembers called, currentSocietyId:', currentSocietyId);
        setLoadingMembers(true);
        try {
            // Directly fetch all users from /users collection
            const usersRef = collection(db, 'users');
            const userSnap = await getDocs(usersRef);

            console.log('[SuperAdminPage] Total users in /users collection:', userSnap.docs.length);

            const membersList: Array<{ id: string; name?: string; email?: string; phone?: string; organization?: string; affiliation?: string; marketingAgreed?: boolean; infoAgreed?: boolean; createdAt?: { seconds: number } }> = [];

            userSnap.docs.forEach(userDoc => {
                const userData = userDoc.data() as { name?: string; email?: string; phone?: string; organization?: string; affiliation?: string; marketingAgreed?: boolean; infoAgreed?: boolean; createdAt?: { seconds: number } };
                membersList.push({
                    id: userDoc.id,
                    ...userData
                });
            });

            console.log('[SuperAdminPage] Final members count:', membersList.length);
            setMembers(membersList);
        } catch (e) {
            console.error('[SuperAdminPage] fetchMembers error:', e);
            toast.error("Failed to fetch members");
        } finally {
            setLoadingMembers(false);
        }
    }, [currentSocietyId]);

    useEffect(() => {
        console.log('[SuperAdminPage] Auto-select society, currentSocietyId:', currentSocietyId, 'societies.length:', societies.length);
        if (!currentSocietyId && societies.length > 0) {
            setCurrentSocietyId(societies[0].id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [societies]);

    useEffect(() => {
        console.log('[SuperAdminPage] useEffect triggered, activeTab:', activeTab, 'currentSocietyId:', currentSocietyId);
        if (activeTab === 'MEMBERS' && currentSocietyId) {
            fetchMembers();
        }
    }, [activeTab, currentSocietyId, fetchMembers]);

    useEffect(() => {
        const fetchCodes = async () => {
            if (!currentSocietyId) return;
            setLoadingCodes(true);
            try {
                const codeRef = collection(db, 'societies', currentSocietyId, 'verification_codes');
                const snap = await getDocs(codeRef);
                setCodes(snap.docs.map(d => ({ id: d.id, ...d.data() } as { id: string; societyId: string; name: string; code: string; used: boolean; usedBy?: string; usedAt?: { seconds: number } | Date; expiryDate?: { seconds: number } | Date })));
            } catch (e) {
                console.error("Fetch Codes Error:", e);
            } finally {
                setLoadingCodes(false);
            }
        };
        fetchCodes();
    }, [currentSocietyId]);

    useEffect(() => {
        const fetchSettings = async () => {
            setLoadingSettings(true);
            try {
                const snap = await getDoc(doc(db, 'system', 'settings'));
                if (snap.exists()) {
                    const data = snap.data() as {
                        privacy?: string;
                        privacyEn?: string;
                        termsService?: string;
                        termsServiceEn?: string;
                        termsAdInfo?: string;
                        termsAdInfoEn?: string;
                        termsMarketing?: string;
                        termsMarketingEn?: string;
                        termsPrivacy?: string;
                        termsPrivacyEn?: string;
                        thirdParty?: string;
                        thirdPartyEn?: string;
                    };
                    setPrivacy(data.privacy || '');
                    setPrivacyEn(data.privacyEn || '');
                    setTermsService(data.termsService || '');
                    setTermsServiceEn(data.termsServiceEn || '');
                    setTermsAdInfo(data.termsAdInfo || '');
                    setTermsAdInfoEn(data.termsAdInfoEn || '');
                    setTermsMarketing(data.termsMarketing || '');
                    setTermsMarketingEn(data.termsMarketingEn || '');
                    setTermsPrivacy(data.termsPrivacy || '');
                    setTermsPrivacyEn(data.termsPrivacyEn || '');
                    setThirdParty(data.thirdParty || '');
                    setThirdPartyEn(data.thirdPartyEn || '');
                }
            } catch (e) {
                console.error("Fetch Settings Error:", e);
            } finally {
                setLoadingSettings(false);
            }
        };
        fetchSettings();
    }, []);

    if (loading) {
        return <LoadingSpinner />;
    }

    const handleDeleteUser = async (uid: string) => {
        if (!confirm("WARNING: This will PERMANENTLY DELETE the user account (Auth + DB). This cannot be undone.\n\nAre you sure?")) return;

        const toastId = toast.loading("Deleting user...");
        try {
            const deleteFn = httpsCallable(functions, 'deleteUserAccount');
            const res = await deleteFn({ uid }) as { data: { success: boolean } };

            if (res.data.success) {
                toast.success("User terminated.", { id: toastId });
                setMembers(prev => prev.filter(m => m.id !== uid));
            } else {
                toast.error("Deletion failed.", { id: toastId });
            }
        } catch (e) {
            console.error("Delete Error:", e);
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            toast.error(`Error: ${errorMessage}`, { id: toastId });
        }
    };

    const handleCreateSociety = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!socNameKo) return toast.error("사회명 (한글) 필수");
        if (!socAdmin) return toast.error("관리자 이메일 필수");

        const toastId = toast.loading("Creating society...");
        try {
            await createSociety({
                name: { ko: socNameKo, en: socNameEn || undefined },
                description: { ko: undefined },
                adminEmails: [socAdmin]
            });
            toast.success("Society created.", { id: toastId });
            setSocNameKo('');
            setSocNameEn('');
            setSocAdmin('');
        } catch (e) {
            console.error("Create Society Error:", e);
            toast.error(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`, { id: toastId });
        }
    };

    const handleUpdateSociety = async (societyId: string) => {
        const toastId = toast.loading("Updating society...");
        try {
            const societyRef = doc(db, 'societies', societyId);
            await updateDoc(societyRef, {
                name: { ko: editDescKo },
                description: { ko: editDescKo },
                homepageUrl: editHomepage
            });
            toast.success("Updated.", { id: toastId });
            setEditingSoc(null);
            setEditDescKo('');
            setEditHomepage('');
        } catch (e) {
            console.error("Update Society Error:", e);
            toast.error(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`, { id: toastId });
        }
    };

    const handleCreateConference = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSocId || !slug || !titleKo || !start || !end) return toast.error("필수 항목 누락");

        const toastId = toast.loading("Creating conference...");
        try {
            await createConference({
                societyId: selectedSocId,
                slug,
                title: { ko: titleKo, en: titleEn || undefined },
                description: { ko: '' },
                venue: { name: 'TBD', address: 'TBD' },
                start: new Date(start),
                end: new Date(end),
                location
            });
            toast.success("Conference created.", { id: toastId });
            setSlug('');
            setTitleKo('');
            setTitleEn('');
            setStart('');
            setEnd('');
            setLocation('');
        } catch (e) {
            console.error("Create Conference Error:", e);
            toast.error(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`, { id: toastId });
        }
    };

    const handleCreateCode = async () => {
        if (!newCodeSocId || !newCodeName || !newCodeValue) return toast.error("필수 항목 누락");

        const toastId = toast.loading("Creating code...");
        try {
            const codeRef = collection(db, 'societies', newCodeSocId, 'verification_codes');
            await addDoc(codeRef, {
                name: newCodeName,
                code: newCodeValue,
                expiryDate: newCodeExpiry ? new Date(newCodeExpiry) : null,
                used: false
            });
            toast.success("Code created.", { id: toastId });
            setNewCodeName('');
            setNewCodeValue('');
            setNewCodeSocId('');
            setNewCodeExpiry('');
        } catch (e) {
            console.error("Create Code Error:", e);
            toast.error(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`, { id: toastId });
        }
    };

    const handleResetCodes = async () => {
        if (!confirm("모든 코드를 리셋합니다. 진행하시겠습니까?")) return;

        const toastId = toast.loading("Resetting codes...");
        try {
            const codeRef = collection(db, 'societies', currentSocietyId, 'verification_codes');
            const snap = await getDocs(codeRef);
            const batch = snap.docs.map(d => deleteDoc(d.ref));
            await Promise.all(batch);
            toast.success("All codes reset.", { id: toastId });
            setCodes([]);
        } catch (e) {
            console.error("Reset Codes Error:", e);
            toast.error(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`, { id: toastId });
        }
    };

    const handleSaveSettings = async () => {
        const toastId = toast.loading("Saving settings...");
        try {
            await setDoc(doc(db, 'system', 'settings'), {
                privacy,
                privacyEn,
                termsService,
                termsServiceEn,
                termsAdInfo,
                termsAdInfoEn,
                termsMarketing,
                termsMarketingEn,
                termsPrivacy,
                termsPrivacyEn,
                thirdParty,
                thirdPartyEn,
                updatedAt: new Date()
            }, { merge: true });
            toast.success("Settings saved.", { id: toastId });
        } catch (e) {
            console.error("Save Settings Error:", e);
            toast.error(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`, { id: toastId });
        }
    };

    return (
        <div className="min-h-screen bg-[#1a1a1a] text-gray-200 p-6">
            <header className="mb-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-3xl font-bold text-[#fbbf24] tracking-wider">ROOT CONTROL</h1>
                        <Button variant="outline" className="border-[#333] text-gray-400 hover:bg-[#333] hover:text-white" onClick={() => auth.signOut()}>
                            <LogOut className="w-5 h-5" />
                        </Button>
                    </div>
                    <nav className="bg-[#2a2a2a] rounded-xl p-2 flex gap-2">
                        {[
                            { id: 'SOCIETY', label: 'Societies', icon: <Building2 className="w-4 h-4" /> },
                            { id: 'CONFERENCE', label: 'Conferences', icon: <Calendar className="w-4 h-4" /> },
                            { id: 'MEMBERS', label: 'Members', icon: <Users className="w-4 h-4" /> },
                            { id: 'CODES', label: 'Codes', icon: <Key className="w-4 h-4" /> },
                            { id: 'SETTINGS', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
                            { id: 'MONITORING', label: '모니터링', icon: <Activity className="w-4 h-4" /> }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as 'SOCIETY' | 'CONFERENCE' | 'MEMBERS' | 'CODES' | 'SETTINGS' | 'MONITORING')}
                                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === tab.id ? 'bg-[#fbbf24] text-black' : 'bg-[#1e1e1e] text-gray-400 hover:bg-[#333] hover:text-white'}`}
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
                    <div className="space-y-6">
                        <Card className="shadow-lg border-t-4 border-t-[#fbbf24]">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <Building2 className="w-5 h-5 text-[#fbbf24]" /> Create Society
                                </CardTitle>
                                <CardDescription>Add new professional societies to the platform</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <form onSubmit={handleCreateSociety} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-400 uppercase">사회명 (한글)</Label>
                                            <Input value={socNameKo} onChange={e => setSocNameKo(e.target.value)} className="bg-[#2a2a2a] border-[#333] focus:border-[#fbbf24]" placeholder="예: 한국기계정보학회" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-400 uppercase">사회명 (영어)</Label>
                                            <Input value={socNameEn} onChange={e => setSocNameEn(e.target.value)} className="bg-[#2a2a2a] border-[#333] focus:border-[#fbbf24]" placeholder="Optional: Korea Association..." />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-400 uppercase">관리자 이메일</Label>
                                            <Input type="email" value={socAdmin} onChange={e => setSocAdmin(e.target.value)} className="bg-[#2a2a2a] border-[#333] focus:border-[#fbbf24]" placeholder="admin@society.org" />
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full bg-[#fbbf24] hover:bg-[#e0a520] text-black font-bold">
                                        <Plus className="w-4 h-4 mr-2" /> Create Society
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        <Card className="shadow-lg">
                            <CardHeader>
                                <CardTitle>Existing Societies</CardTitle>
                                <CardDescription>Manage professional societies</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {societies.map(s => (
                                        <div key={s.id} className="flex items-center justify-between p-4 bg-[#2a2a2a] rounded-lg border border-[#333]">
                                            <div className="flex-1">
                                                <div className="font-semibold text-gray-200">{s.name.ko}</div>
                                                <div className="text-xs text-gray-400">{s.adminEmails.join(', ')}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" onClick={() => {
                                                    setEditingSoc({ id: s.id, name: s.name, description: s.description, homepageUrl: s.homepageUrl, adminEmails: s.adminEmails });
                                                    setEditDescKo(s.name.ko);
                                                    setEditHomepage(s.homepageUrl || '');
                                                }}>
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    {societies.length === 0 && (
                                        <div className="text-center py-12 text-gray-400">
                                            <Building2 className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                            <p>No societies yet. Create one above.</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {editingSoc && (
                            <Card className="shadow-lg border-t-4 border-t-blue-600">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Edit className="w-5 h-5 text-blue-600" /> Edit Society
                                    </CardTitle>
                                    <CardDescription>Update society details</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-400 uppercase">사회명</Label>
                                            <Input value={editDescKo} onChange={e => setEditDescKo(e.target.value)} className="bg-white" placeholder="사회명 입력" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-400 uppercase">홈페이지 URL</Label>
                                            <Input value={editHomepage} onChange={e => setEditHomepage(e.target.value)} className="bg-white" placeholder="https://..." />
                                        </div>
                                        <div className="flex gap-2">
                                            <Button onClick={() => handleUpdateSociety(editingSoc.id)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex-1">
                                                <Save className="w-4 h-4 mr-2" /> Save Changes
                                            </Button>
                                            <Button onClick={() => setEditingSoc(null)} variant="outline">
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}

                {activeTab === 'CONFERENCE' && (
                    <div className="space-y-6">
                        <Card className="shadow-lg border-t-4 border-t-green-600">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-green-600" /> Create Conference
                                </CardTitle>
                                <CardDescription>Create new conference events for societies</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <form onSubmit={handleCreateConference} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-gray-400 uppercase">Select Society</Label>
                                        <select
                                            className="w-full p-3 bg-[#2a2a2a] border border-[#333] rounded-lg text-gray-200 focus:border-green-600"
                                            value={selectedSocId}
                                            onChange={e => setSelectedSocId(e.target.value)}
                                        >
                                            <option value="">Select Society...</option>
                                            {societies.map(s => <option key={s.id} value={s.id}>{s.name.ko}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-400 uppercase">Conference Slug</Label>
                                            <Input value={slug} onChange={e => setSlug(e.target.value)} className="bg-[#2a2a2a] border-[#333] focus:border-green-600" placeholder="e.g., 2026spring" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-400 uppercase">Start Date</Label>
                                            <Input type="date" value={start} onChange={e => setStart(e.target.value)} className="bg-[#2a2a2a] border-[#333] focus:border-green-600" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-400 uppercase">Title (한국어)</Label>
                                            <Input value={titleKo} onChange={e => setTitleKo(e.target.value)} className="bg-[#2a2a2a] border-[#333] focus:border-green-600" placeholder="예: 2026년 춘계학술대회" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-400 uppercase">Title (English)</Label>
                                            <Input value={titleEn} onChange={e => setTitleEn(e.target.value)} className="bg-[#2a2a2a] border-[#333] focus:border-green-600" placeholder="Optional: Spring Conference 2026" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-400 uppercase">End Date</Label>
                                            <Input type="date" value={end} onChange={e => setEnd(e.target.value)} className="bg-[#2a2a2a] border-[#333] focus:border-green-600" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-400 uppercase">Location</Label>
                                            <Input value={location} onChange={e => setLocation(e.target.value)} className="bg-[#2a2a2a] border-[#333] focus:border-green-600" placeholder="예: 서울 코엑스" />
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold">
                                        <Plus className="w-4 h-4 mr-2" /> Create Conference
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === 'MEMBERS' && (
                    <div className="max-w-7xl mx-auto space-y-6">
                        <Card className="shadow-lg border-t-4 border-t-blue-600">
                            <CardHeader className="pb-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-xl flex items-center gap-2">
                                            <Users className="w-5 h-5 text-blue-600" /> Member Management
                                        </CardTitle>
                                        <CardDescription>View and manage registered members</CardDescription>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="relative">
                                            <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                            <select
                                                className="pl-9 pr-4 py-2 border rounded-lg text-sm bg-white hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all w-full md:w-48 appearance-none"
                                                value={currentSocietyId}
                                                onChange={e => setCurrentSocietyId(e.target.value)}
                                            >
                                                {societies.map(s => <option key={s.id} value={s.id}>{s.name.ko}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {loadingMembers ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                                        <LoadingSpinner />
                                        <p className="text-sm text-slate-400">Loading members...</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold tracking-wide">
                                                <tr>
                                                    <th className="p-4 pl-6">Member Identity</th>
                                                    <th className="p-4">Contact</th>
                                                    <th className="p-4">Affiliation</th>
                                                    <th className="p-4">Verification</th>
                                                    <th className="p-4 text-center">Agreements</th>
                                                    <th className="p-4">Joined Date</th>
                                                    <th className="p-4 text-right pr-6">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {members.map(m => (
                                                    <tr key={m.id} className="hover:bg-blue-50/30 transition-colors group">
                                                        <td className="p-4 pl-6">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold border border-slate-200">
                                                                    {(m.name || '?').charAt(0)}
                                                                </div>
                                                                <div>
                                                                    <div className="font-semibold text-slate-900">
                                                                        {m.name || <span className="text-red-400 italic">No Name</span>}
                                                                    </div>
                                                                    <div className="text-xs text-slate-500 truncate max-w-[150px]">{m.email || '-'}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-slate-600 font-mono text-xs">
                                                            {m.phone || <span className="text-slate-300">-</span>}
                                                        </td>
                                                        <td className="p-4 text-slate-600">
                                                            {m.organization || m.affiliation || <span className="text-slate-300">-</span>}
                                                        </td>
                                                        <td className="p-4">
                                                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-0 px-1.5 py-0 h-5 text-[10px]">VERIFIED</Badge>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex justify-center gap-2">
                                                                <div className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${m.marketingAgreed ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-50 text-slate-300 border-slate-200'}`}>MKT</div>
                                                                <div className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${m.infoAgreed ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-50 text-slate-300 border-slate-200'}`}>INFO</div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-xs text-slate-500">
                                                            {m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000).toLocaleDateString() : '-'}
                                                        </td>
                                                        <td className="p-4 text-right pr-6">
                                                            <button
                                                                onClick={() => handleDeleteUser(m.id)}
                                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                                                title="Permanently Delete User"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {members.length === 0 && (
                                                    <tr>
                                                        <td colSpan={8} className="py-12 text-center">
                                                            <div className="text-slate-400 flex flex-col items-center">
                                                                <Search className="w-10 h-10 mb-2 opacity-20" />
                                                                <p>No members found for this society.</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === 'CODES' && (
                    <div className="max-w-5xl mx-auto space-y-6">
                        <Card className="shadow-lg border-t-4 border-t-indigo-500">
                            <CardHeader className="pb-4">
                                <CardTitle className="flex items-center gap-2 text-xl">
                                    <Key className="w-5 h-5 text-indigo-600" /> Verification Code Management
                                </CardTitle>
                                <CardDescription>Issue and monitor 1-time verification codes for society member registration</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col md:flex-row gap-4 items-end">
                                    <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-slate-500 uppercase">Target Society</Label>
                                            <select
                                                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                value={newCodeSocId}
                                                onChange={e => setNewCodeSocId(e.target.value)}
                                            >
                                                <option value="">Select Society...</option>
                                                {societies.map((s) => <option key={s.id} value={s.id}>{s.name.ko}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-slate-500 uppercase">Member Name</Label>
                                            <Input
                                                placeholder="e.g. Gil-dong Hong"
                                                value={newCodeName}
                                                onChange={e => setNewCodeName(e.target.value)}
                                                className="h-10 bg-white"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-slate-500 uppercase">Code String</Label>
                                            <div className="relative">
                                                <Key className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                                <Input
                                                    placeholder="e.g. 20260101"
                                                    value={newCodeValue}
                                                    onChange={e => setNewCodeValue(e.target.value)}
                                                    className="h-10 pl-9 font-mono bg-white"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-slate-500 uppercase">Expiry (Opt)</Label>
                                            <Input
                                                type="date"
                                                value={newCodeExpiry}
                                                onChange={e => setNewCodeExpiry(e.target.value)}
                                                className="h-10 bg-white text-slate-600"
                                            />
                                        </div>
                                    </div>
                                    <Button onClick={handleCreateCode} className="h-10 bg-indigo-600 hover:bg-indigo-700 min-w-[120px]">
                                        <Plus className="w-4 h-4 mr-2" /> Add Code
                                    </Button>
                                    <div className="ml-auto">
                                        <Button variant="ghost" size="sm" onClick={handleResetCodes} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                            <Trash2 className="w-4 h-4 mr-1" /> Reset All
                                        </Button>
                                    </div>
                                </div>

                                <div className="rounded-xl border shadow-sm overflow-hidden">
                                    {loadingCodes ? (
                                        <div className="p-12 flex justify-center"><LoadingSpinner /></div>
                                    ) : (
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                                                <tr>
                                                    <th className="p-4">Society</th>
                                                    <th className="p-4">Assigned To</th>
                                                    <th className="p-4">Code</th>
                                                    <th className="p-4">Expiry Date</th>
                                                    <th className="p-4">Status</th>
                                                    <th className="p-4">Usage Info</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {codes.map(c => (
                                                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="p-4 font-mono text-xs text-slate-500">{c.societyId}</td>
                                                        <td className="p-4 font-medium text-slate-900">{c.name}</td>
                                                        <td className="p-4 font-mono font-bold tracking-wider">{c.code}</td>
                                                        <td className="p-4 text-xs text-slate-500">
                                                            {c.expiryDate ? (('seconds' in c.expiryDate) ? new Date(c.expiryDate.seconds * 1000).toLocaleDateString() : new Date(c.expiryDate).toLocaleDateString()) : <span className="text-slate-300">No Expiry</span>}
                                                        </td>
                                                        <td className="p-4">
                                                            {c.used ? (
                                                                <Badge variant="secondary" className="bg-slate-100 text-slate-500 hover:bg-slate-200">USED</Badge>
                                                            ) : (
                                                                <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none">AVAILABLE</Badge>
                                                            )}
                                                        </td>
                                                        <td className="p-4 text-xs text-slate-500">
                                                            {c.used ? (
                                                                <div className="flex flex-col">
                                                                    <span>By: {c.usedBy}</span>
                                                                    <span className="text-[10px] text-slate-400">
                                                                        {c.usedAt && 'seconds' in c.usedAt ? new Date(c.usedAt.seconds * 1000).toLocaleString() : c.usedAt instanceof Date ? c.usedAt.toLocaleString() : '-'}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-300">-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {codes.length === 0 && (
                                                    <tr>
                                                        <td colSpan={6} className="py-12 text-center text-slate-400">
                                                            No verification codes found. Create one above.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === 'SETTINGS' && (
                    <div className="max-w-4xl mx-auto">
                        <Card className="shadow-lg border-t-4 border-t-slate-800">
                            <CardHeader className="pb-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-2xl font-bold flex items-center gap-2">
                                            <Settings className="w-6 h-6 text-slate-800" /> Platform Legal Documents
                                        </CardTitle>
                                        <CardDescription>
                                            Manage global Terms of Service, Privacy Policy, and Consent forms.<br />
                                            These texts apply to <span className="font-semibold text-slate-700">ALL societies and conferences</span> unless overridden.
                                        </CardDescription>
                                    </div>

                                    <div className="bg-slate-100 p-1.5 rounded-xl flex gap-1">
                                        <button
                                            onClick={() => setSettingsLang('KO')}
                                            className={`
                                                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all
                                                ${settingsLang === 'KO' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}
                                            `}
                                        >
                                            <span className="text-lg">🇰🇷</span> KOREAN
                                        </button>
                                        <button
                                            onClick={() => setSettingsLang('EN')}
                                            className={`
                                                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all
                                                ${settingsLang === 'EN' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}
                                            `}
                                        >
                                            <span className="text-lg">🇺🇸</span> ENGLISH
                                        </button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-8">
                                {loadingSettings ? (
                                    <div className="py-20 flex justify-center"><LoadingSpinner /></div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                                <Label className="flex items-center gap-2 text-base">
                                                    <ShieldCheck className="w-4 h-4 text-blue-600" /> Terms of Service
                                                </Label>
                                                <div className="relative">
                                                    <div className="absolute top-3 right-3 text-xs font-bold text-slate-300">{settingsLang}</div>
                                                    <Textarea
                                                        value={settingsLang === 'KO' ? termsService : termsServiceEn}
                                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => settingsLang === 'KO' ? setTermsService(e.target.value) : setTermsServiceEn(e.target.value)}
                                                        className="min-h-[250px] font-mono text-sm leading-relaxed resize-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder={settingsLang === 'KO' ? "서비스 이용약관 내용을 입력하세요..." : "Enter Terms of Service content..."}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="flex items-center gap-2 text-base">
                                                    <Key className="w-4 h-4 text-green-600" /> Privacy Policy
                                                </Label>
                                                <div className="relative">
                                                    <div className="absolute top-3 right-3 text-xs font-bold text-slate-300">{settingsLang}</div>
                                                    <Textarea
                                                        value={settingsLang === 'KO' ? privacy : privacyEn}
                                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => settingsLang === 'KO' ? setPrivacy(e.target.value) : setPrivacyEn(e.target.value)}
                                                        className="min-h-[250px] font-mono text-sm leading-relaxed resize-none focus:ring-2 focus:ring-green-500"
                                                        placeholder={settingsLang === 'KO' ? "개인정보 처리방침 내용을 입력하세요..." : "Enter Privacy Policy content..."}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="h-px bg-slate-100" />

                                        <div className="space-y-6">
                                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">User Consent Forms</h3>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-semibold text-slate-600">Third Party Provision</Label>
                                                    <Textarea
                                                        value={settingsLang === 'KO' ? thirdParty : thirdPartyEn}
                                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => settingsLang === 'KO' ? setThirdParty(e.target.value) : setThirdPartyEn(e.target.value)}
                                                        className="min-h-[120px] text-xs font-mono"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-semibold text-blue-600">Marketing Consent (Opt)</Label>
                                                    <Textarea
                                                        value={settingsLang === 'KO' ? termsMarketing : termsMarketingEn}
                                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => settingsLang === 'KO' ? setTermsMarketing(e.target.value) : setTermsMarketingEn(e.target.value)}
                                                        className="min-h-[120px] text-xs font-mono bg-blue-50/30 border-blue-100 focus:border-blue-300"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-semibold text-blue-600">Ad Info Transmission (Opt)</Label>
                                                    <Textarea
                                                        value={settingsLang === 'KO' ? termsAdInfo : termsAdInfoEn}
                                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => settingsLang === 'KO' ? setTermsAdInfo(e.target.value) : setTermsAdInfoEn(e.target.value)}
                                                        className="min-h-[120px] text-xs font-mono bg-blue-50/30 border-blue-100 focus:border-blue-300"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-4">
                                            <Button onClick={handleSaveSettings} className="w-full h-12 text-lg font-bold bg-slate-900 hover:bg-slate-800">
                                                <Save className="w-5 h-5 mr-2" /> Save All Settings
                                            </Button>
                                            <p className="text-center text-xs text-slate-400 mt-3">
                                                Last Updated: {new Date().toLocaleDateString()} • Updates apply immediately to all registration forms.
                                            </p>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === 'MONITORING' && (
                    <div className="max-w-7xl mx-auto space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-[#fbbf24] mb-2">시스템 모니터링</h2>
                                <p className="text-gray-400 text-sm">실시간 오류, 성능, 데이터 무결성 추적</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <input
                                    type="date"
                                    value={monitoringDate}
                                    onChange={(e) => setMonitoringDate(e.target.value)}
                                    className="bg-[#2a2a2a] border border-[#333] text-gray-200 px-4 py-2 rounded-lg focus:border-[#fbbf24] focus:outline-none"
                                />
                                <button
                                    onClick={refetchMonitoring}
                                    className="bg-[#fbbf24] hover:bg-[#e0a520] text-black px-4 py-2 rounded-lg font-semibold flex items-center gap-2"
                                >
                                    새로고침
                                </button>
                            </div>
                        </div>

                        {monitoringLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <LoadingSpinner />
                                <p className="text-sm text-gray-400">모니터링 데이터 로딩 중...</p>
                            </div>
                        ) : (
                            <>
                                {/* Error Logs Section */}
                                <Card className="shadow-lg border-t-4 border-t-red-500 bg-[#1e1e1e] border-[#333]">
                                    <CardHeader className="pb-4">
                                        <CardTitle className="text-xl flex items-center gap-2 text-red-400">
                                            ⚠️ 오류 로그 ({errorLogs.length})
                                        </CardTitle>
                                        <CardDescription className="text-gray-400">
                                            시스템 오류 및 예외 사항 추적
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        {errorLogs.length === 0 ? (
                                            <div className="text-center py-12 text-gray-400">
                                                <div className="text-4xl mb-2">✅</div>
                                                <p>오류 없음</p>
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="bg-[#2a2a2a] text-gray-400 uppercase text-xs font-semibold">
                                                        <tr>
                                                            <th className="p-4 pl-6">시간</th>
                                                            <th className="p-4">심각도</th>
                                                            <th className="p-4">카테고리</th>
                                                            <th className="p-4">메시지</th>
                                                            <th className="p-4">발생 횟수</th>
                                                            <th className="p-4">URL</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-[#333]">
                                                        {errorLogs.map((log) => (
                                                            <tr key={log.id} className="hover:bg-[#2a2a2a] transition-colors">
                                                                <td className="p-4 pl-6 text-gray-300">
                                                                    {log.timestamp?.toDate ?
                                                                        new Date(log.timestamp.toDate()).toLocaleTimeString('ko-KR') :
                                                                        '-'}
                                                                </td>
                                                                <td className="p-4">
                                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                                        log.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                                                                        log.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                                                                        log.severity === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                                                                        'bg-gray-500/20 text-gray-400'
                                                                    }`}>
                                                                        {log.severity}
                                                                    </span>
                                                                </td>
                                                                <td className="p-4 text-gray-300">{log.category}</td>
                                                                <td className="p-4 text-gray-200 max-w-md truncate">{log.message}</td>
                                                                <td className="p-4 text-center font-bold text-gray-300">{log.occurrenceCount || 1}</td>
                                                                <td className="p-4 text-gray-400 text-xs max-w-xs truncate">{log.url || '-'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Performance Metrics Section */}
                                <Card className="shadow-lg border-t-4 border-t-blue-500 bg-[#1e1e1e] border-[#333]">
                                    <CardHeader className="pb-4">
                                        <CardTitle className="text-xl flex items-center gap-2 text-blue-400">
                                            📊 성능 지표 ({performanceMetrics.length})
                                        </CardTitle>
                                        <CardDescription className="text-gray-400">
                                            웹 바이탈 및 API 성능 측정
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        {performanceMetrics.length === 0 ? (
                                            <div className="text-center py-12 text-gray-400">
                                                <div className="text-4xl mb-2">📈</div>
                                                <p>성능 데이터 없음</p>
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="bg-[#2a2a2a] text-gray-400 uppercase text-xs font-semibold">
                                                        <tr>
                                                            <th className="p-4 pl-6">시간</th>
                                                            <th className="p-4">지표</th>
                                                            <th className="p-4">값</th>
                                                            <th className="p-4">경로</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-[#333]">
                                                        {performanceMetrics.slice(0, 20).map((metric) => (
                                                            <tr key={metric.id} className="hover:bg-[#2a2a2a] transition-colors">
                                                                <td className="p-4 pl-6 text-gray-300">
                                                                    {metric.timestamp?.toDate ?
                                                                        new Date(metric.timestamp.toDate()).toLocaleTimeString('ko-KR') :
                                                                        '-'}
                                                                </td>
                                                                <td className="p-4 text-gray-300 font-mono">{metric.metricName}</td>
                                                                <td className="p-4">
                                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                                        metric.value > 3000 ? 'bg-red-500/20 text-red-400' :
                                                                        metric.value > 1000 ? 'bg-yellow-500/20 text-yellow-400' :
                                                                        'bg-green-500/20 text-green-400'
                                                                    }`}>
                                                                        {metric.value.toFixed(0)} {metric.unit}
                                                                    </span>
                                                                </td>
                                                                <td className="p-4 text-gray-400 text-xs max-w-xs truncate">{metric.url || metric.route || '-'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Data Integrity Alerts Section */}
                                <Card className="shadow-lg border-t-4 border-t-orange-500 bg-[#1e1e1e] border-[#333]">
                                    <CardHeader className="pb-4">
                                        <CardTitle className="text-xl flex items-center gap-2 text-orange-400">
                                            🛡️ 데이터 무결성 알림 ({dataIntegrityAlerts.length})
                                        </CardTitle>
                                        <CardDescription className="text-gray-400">
                                            데이터 무결성 위반 사항 감지
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        {dataIntegrityAlerts.length === 0 ? (
                                            <div className="text-center py-12 text-gray-400">
                                                <div className="text-4xl mb-2">✅</div>
                                                <p>무결성 이슈 없음</p>
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="bg-[#2a2a2a] text-gray-400 uppercase text-xs font-semibold">
                                                        <tr>
                                                            <th className="p-4 pl-6">시간</th>
                                                            <th className="p-4">심각도</th>
                                                            <th className="p-4">컬렉션</th>
                                                            <th className="p-4">문서 ID</th>
                                                            <th className="p-4">위반 규칙</th>
                                                            <th className="p-4">해결 여부</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-[#333]">
                                                        {dataIntegrityAlerts.map((alert) => (
                                                            <tr key={alert.id} className="hover:bg-[#2a2a2a] transition-colors">
                                                                <td className="p-4 pl-6 text-gray-300">
                                                                    {alert.timestamp?.toDate ?
                                                                        new Date(alert.timestamp.toDate()).toLocaleTimeString('ko-KR') :
                                                                        '-'}
                                                                </td>
                                                                <td className="p-4">
                                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                                        alert.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                                                                        alert.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                                                                        'bg-yellow-500/20 text-yellow-400'
                                                                    }`}>
                                                                        {alert.severity}
                                                                    </span>
                                                                </td>
                                                                <td className="p-4 text-gray-300 text-xs font-mono">{alert.collection}</td>
                                                                <td className="p-4 text-gray-300 text-xs font-mono max-w-xs truncate">{alert.documentId}</td>
                                                                <td className="p-4 text-gray-200 text-sm">{alert.rule}</td>
                                                                <td className="p-4">
                                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                                        alert.resolved ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                                                    }`}>
                                                                        {alert.resolved ? '해결됨' : '미해결'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default SuperAdminPage;
