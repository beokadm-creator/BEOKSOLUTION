import React, { useState, useEffect, useCallback } from 'react';
import { useSuperAdmin } from '../../hooks/useSuperAdmin';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../components/ui/card';
import { LogOut, Plus, Building2, Calendar, Edit, UserPlus, Save, Users, Settings, Trash2, Key, Globe, ShieldCheck, Search, Filter, RefreshCw, ChevronRight } from 'lucide-react';
import { auth, functions } from '../../firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, updateDoc, getDocs, collection, getDoc, setDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';

interface UserData {
    id: string;
    isAnonymous?: boolean;
    email?: string;
    name?: string;
    affiliations?: {
        [key: string]: {
            verified: boolean;
        }
    };
    userName?: string;
    displayName?: string;
    phone?: string;
    phoneNumber?: string;
    organization?: string;
    affiliation?: string;
    marketingAgreed?: boolean;
    infoAgreed?: boolean;
    createdAt?: { seconds: number };
    [key: string]: unknown;
}

const SuperAdminPage: React.FC = () => {
    // 🔧 [FIX] Removed useSuperAdminGuard - AdminGuard already handles authentication
    const { societies, createSociety, createConference, loading } = useSuperAdmin();
    const [activeTab, setActiveTab] = useState<'SOCIETY' | 'CONFERENCE' | 'MEMBERS' | 'CODES' | 'SETTINGS'>('SOCIETY');

    const [socId, setSocId] = useState('');
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
    const [adminEmail, setAdminEmail] = useState('');

    const [currentSocietyId, setCurrentSocietyId] = useState<string>('');
    const [members, setMembers] = useState<UserData[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);

    const [guests, setGuests] = useState<UserData[]>([]);
    const [loadingGuests, setLoadingGuests] = useState(false);
    const [memberTab, setMemberTab] = useState<'REGULAR' | 'GUEST'>('REGULAR');

    const [codes, setCodes] = useState<Array<{ id: string; societyId: string; name: string; code: string; used: boolean; usedBy?: string; usedAt?: { seconds: number } | Date; expiryDate?: { seconds: number } | Date }>>([]);
    const [loadingCodes, setLoadingCodes] = useState(false);
    const [newCodeName, setNewCodeName] = useState('');
    const [newCodeValue, setNewCodeValue] = useState('');
    const [newCodeSocId, setNewCodeSocId] = useState('');
    const [newCodeExpiry, setNewCodeExpiry] = useState('');

    const [settingsLang, setSettingsLang] = useState<'KO' | 'EN'>('KO');
    const [platformTerms, setPlatformTerms] = useState('');
    const [platformTermsEn, setPlatformTermsEn] = useState('');
    const [platformPrivacy, setPlatformPrivacy] = useState('');
    const [platformPrivacyEn, setPlatformPrivacyEn] = useState('');
    const [platformThirdParty, setPlatformThirdParty] = useState('');
    const [platformThirdPartyEn, setPlatformThirdPartyEn] = useState('');
    const [termsMarketing, setTermsMarketing] = useState('');
    const [termsMarketingEn, setTermsMarketingEn] = useState('');
    const [termsAdInfo, setTermsAdInfo] = useState('');
    const [termsAdInfoEn, setTermsAdInfoEn] = useState('');
    const [loadingSettings, setLoadingSettings] = useState(false);

    const [editingSoc, setEditingSoc] = useState<{ id: string; name: { ko: string; en?: string }; description?: { ko?: string }; homepageUrl?: string; adminEmails?: string[] } | null>(null);
    const [editDescKo, setEditDescKo] = useState('');
    const [editHomepage, setEditHomepage] = useState('');

    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [newAdminPass, setNewAdminPass] = useState('');
    const [newAdminName, setNewAdminName] = useState('');
    const [creatingAdmin, setCreatingAdmin] = useState(false);

    // Fetch Members
    const fetchMembers = useCallback(async () => {
        setLoadingMembers(true);
        setLoadingGuests(true);
        try {
            const snap = await getDocs(collection(db, 'users'));
            const allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() } as UserData));

            const regulars = allUsers.filter(u =>
                !u.isAnonymous && currentSocietyId && ((u.affiliations as Record<string, { verified: boolean }> | undefined)?.[currentSocietyId]?.verified === true)
            );

            const guestList = allUsers.filter(u =>
                u.isAnonymous === true || !currentSocietyId || !((u.affiliations as Record<string, { verified: boolean }> | undefined)?.[currentSocietyId]?.verified)
            );

            setMembers(regulars);
            setGuests(guestList);
        } catch (e) {
            console.error(e);
            toast.error("Failed to fetch members");
        } finally {
            setLoadingMembers(false);
            setLoadingGuests(false);
        }
    }, [currentSocietyId]);

    // Auto-select society if not selected
    useEffect(() => {
        if (!currentSocietyId && societies.length > 0) {
            setCurrentSocietyId(societies[0].id);
        }
    }, [societies]);

    // Refetch when society changes if on members tab
    useEffect(() => {
        if (activeTab === 'MEMBERS' && currentSocietyId) {
            fetchMembers();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, currentSocietyId]);

    // 🔧 [FIX] Removed checking guard - AdminGuard handles loading state
    if (loading) {
        return <LoadingSpinner />;
    }

    // Nuclear Delete
    const handleDeleteUser = async (uid: string, isGuest: boolean = false) => {
        if (!confirm("WARNING: This will PERMANENTLY DELETE the user account (Auth + DB). This cannot be undone.\n\nAre you sure?")) return;

        const toastId = toast.loading("Deleting user...");
        try {
            const deleteFn = httpsCallable(functions, 'deleteUserAccount');
            const res = await deleteFn({ uid }) as { data: { success: boolean } };

            if (res.data.success) {
                toast.success("User terminated.", { id: toastId });

                // Update Local State
                if (isGuest) {
                    setGuests(prev => prev.filter(g => g.id !== uid));
                    setMembers(prev => prev.filter(m => m.id !== uid));
                } else {
                    setMembers(prev => prev.filter(m => m.id !== uid));
                }
            } else {
                toast.error("Deletion failed.", { id: toastId });
            }
        } catch (e) {
            console.error("Delete Error:", e);
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            toast.error(`Error: ${errorMessage}`, { id: toastId });
        }
    };

    // Helper Function
    const getProviderLabel = (u: UserData) => {
        const p = (u as { provider?: string; providerId?: string }).provider || (u as { providerId?: string }).providerId;
        if (p === 'google' || p === 'google.com' || ((u as any).photoURL && (u as any).photoURL.includes('google'))) {
            return <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold">Google</span>;
        }
        return <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-bold">Email</span>;
    };

    // Fetch Codes
    const fetchCodes = async () => {
        setLoadingCodes(true);
        try {
            const snap = await getDocs(collection(db, 'members'));
            const list = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    used: data.used || false,
                    usedBy: data.usedBy || '-',
                    usedAt: data.usedAt || null
                } as { id: string; societyId: string; name: string; code: string; used: boolean; usedBy?: string; usedAt?: { seconds: number } | Date; expiryDate?: { seconds: number } | Date };
            });
            setCodes(list);
        } catch (e) {
            console.error(e);
            toast.error("Failed to fetch codes");
        } finally {
            setLoadingCodes(false);
        }
    };

    // Create Code
    const handleCreateCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCodeSocId) return toast.error("Select a society");

        try {
            const exists = codes.find(c => c.societyId === newCodeSocId && c.code === newCodeValue);
            if (exists) return toast.error("Code already exists for this society");

            await addDoc(collection(db, 'members'), {
                societyId: newCodeSocId,
                name: newCodeName,
                code: newCodeValue,
                used: false,
                createdAt: serverTimestamp()
            });
            toast.success("Verification Code Added");
            setNewCodeName('');
            setNewCodeValue('');
            fetchCodes();
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            toast.error(errorMessage);
        }
    };

    // Reset All Codes
    const handleResetCodes = async () => {
        if (!confirm("WARNING: This will delete ALL verification codes. Continue?")) return;
        setLoadingCodes(true);
        try {
            const snap = await getDocs(collection(db, 'members'));
            const promises = snap.docs.map(d => deleteDoc(doc(db, 'members', d.id)));
            await Promise.all(promises);
            toast.success("All codes deleted.");
            setCodes([]);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            toast.error(errorMessage);
        } finally {
            setLoadingCodes(false);
        }
    };

    // Fetch Platform Settings
    const fetchPlatformSettings = async () => {
        setLoadingSettings(true);
        try {
            const docRef = doc(db, 'system', 'settings');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setPlatformTerms((data.terms || data.termsService || '') as string);
                setPlatformTermsEn((data.termsEn || '') as string);
                setPlatformPrivacy((data.privacy || data.termsPrivacy || '') as string);
                setPlatformPrivacyEn((data.privacyEn || '') as string);
                setPlatformThirdParty((data.thirdParty || '') as string);
                setPlatformThirdPartyEn((data.thirdPartyEn || '') as string);
                setTermsMarketing((data.termsMarketing || '') as string);
                setTermsMarketingEn((data.termsMarketingEn || '') as string);
                setTermsAdInfo((data.termsAdInfo || '') as string);
                setTermsAdInfoEn((data.termsAdInfoEn || '') as string);
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to fetch settings");
        } finally {
            setLoadingSettings(false);
        }
    };

    // Save Platform Settings
    const handleSaveSettings = async () => {
        setLoadingSettings(true);
        try {
            await setDoc(doc(db, 'system', 'settings'), {
                terms: platformTerms,
                termsEn: platformTermsEn,
                termsService: platformTerms,
                privacy: platformPrivacy,
                privacyEn: platformPrivacyEn,
                termsPrivacy: platformPrivacy,
                thirdParty: platformThirdParty,
                thirdPartyEn: platformThirdPartyEn,
                termsMarketing,
                termsMarketingEn,
                termsAdInfo,
                termsAdInfoEn,
                updatedAt: new Date()
            }, { merge: true });
            toast.success("Platform settings saved!");
        } catch (e) {
            console.error(e);
            toast.error("Failed to save settings");
        } finally {
            setLoadingSettings(false);
        }
    };

    // Create Society
    const handleCreateSociety = async (e: React.FormEvent) => {
        e.preventDefault();
        const success = await createSociety(socId, socNameKo, socNameEn, socAdmin);
        if (success) {
            toast.success('Society Created!');
            setSocId('');
            setSocNameKo('');
            setSocNameEn('');
            setSocAdmin('');
        } else {
            toast.error('Failed to create society');
        }
    };

    // Create Conference
    const handleCreateConference = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSocId) return toast.error('Please select a society');
        const success = await createConference(selectedSocId, slug.toLowerCase().trim(), titleKo, titleEn, start, end, location, adminEmail);
        if (success) {
            toast.success('Conference Created Successfully!');
            const url = `https://${selectedSocId}.eregi.co.kr/${slug}`;
            toast.success(<span>Created! <a href={url} target="_blank" className="underline text-blue-500">View Conference</a></span>, { duration: 5000 });
            setSlug('');
            setTitleKo('');
            setTitleEn('');
            setStart('');
            setEnd('');
            setLocation('');
            setAdminEmail('');
        } else {
            toast.error('Failed to create conference.');
        }
    };

    // Edit Handlers
    const startEditing = (soc: { id: string; name: { ko: string; en?: string }; description?: { ko?: string }; homepageUrl?: string; adminEmails?: string[] }) => {
        setEditingSoc(soc);
        setEditDescKo(soc.description?.ko || '');
        setEditHomepage(soc.homepageUrl || '');
    };

    const handleUpdateSociety = async () => {
        if (!editingSoc) return;
        try {
            const socRef = doc(db, 'societies', editingSoc.id);
            await updateDoc(socRef, {
                'description.ko': editDescKo,
                'homepageUrl': editHomepage
            });
            toast.success('Society Info Updated!');
            setEditingSoc(null);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            toast.error('Update failed: ' + errorMessage);
        }
    };

    const handleCreateAdminUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSoc) return;
        setCreatingAdmin(true);

        try {
            const createFn = httpsCallable(functions, 'createSocietyAdminUser');
            await createFn({
                email: newAdminEmail,
                password: newAdminPass,
                name: newAdminName,
                societyId: editingSoc.id
            });
            toast.success(`Admin user ${newAdminEmail} created for ${editingSoc.id}`);
            setNewAdminEmail('');
            setNewAdminPass('');
            setNewAdminName('');
        } catch (e) {
            console.error("FULL ERROR OBJECT:", e);
            const errorCode = (e as { code?: string }).code || 'Unknown';
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            toast.error(`Create Failed: ${errorMessage} (${errorCode})`);
        } finally {
            setCreatingAdmin(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/50">
            {/* Top Navigation Bar */}
            <div className="bg-white border-b sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-600/20">
                            S
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Super Admin</h1>
                            <p className="text-[11px] text-slate-500 font-medium tracking-wide">SYSTEM CONTROLLER</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="px-3 py-1 bg-slate-100 rounded-full text-xs font-semibold text-slate-600 flex items-center gap-2">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Secure Environment
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => auth.signOut()} className="text-slate-500 hover:text-red-600 hover:bg-red-50">
                            <LogOut className="w-4 h-4 mr-2" /> Sign Out
                        </Button>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="max-w-7xl mx-auto px-6 flex gap-8 -mb-px">
                    {[
                        { id: 'SOCIETY', label: 'Organization', icon: Building2 },
                        { id: 'CONFERENCE', label: 'Conferences', icon: Calendar },
                        { id: 'MEMBERS', label: 'Members', icon: Users },
                        { id: 'CODES', label: 'Auth Codes', icon: Key },
                        { id: 'SETTINGS', label: 'Platform Settings', icon: Settings },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id as any);
                                if (tab.id === 'MEMBERS') fetchMembers();
                                if (tab.id === 'CODES') fetchCodes();
                                if (tab.id === 'SETTINGS') fetchPlatformSettings();
                            }}
                            className={`
                                flex items-center gap-2 pb-4 text-sm font-medium border-b-2 transition-all
                                ${activeTab === tab.id
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}
                            `}
                        >
                            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'stroke-[2.5px]' : ''}`} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <main className="max-w-7xl mx-auto p-6 space-y-8">
                {activeTab === 'SOCIETY' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* LEFT COLUMN: Create & List */}
                        <div className="lg:col-span-5 space-y-8">
                            {/* Create New Society */}
                            <Card className="border-t-4 border-t-blue-600 shadow-lg">
                                <CardHeader className="pb-4">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <Plus className="w-5 h-5 text-blue-600" />
                                        New Organization
                                    </CardTitle>
                                    <CardDescription>Register a new society to the platform</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleCreateSociety} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Society ID (Subdomain)</Label>
                                            <div className="relative">
                                                <Globe className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                                <Input className="pl-9 font-mono" value={socId} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSocId(e.target.value)} placeholder="e.g. kap" required />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <Label>Name (Korean)</Label>
                                                <Input value={socNameKo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSocNameKo(e.target.value)} placeholder="대한OO학회" required />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Name (English)</Label>
                                                <Input value={socNameEn} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSocNameEn(e.target.value)} placeholder="The Korean..." required />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Super Admin Email</Label>
                                            <div className="relative">
                                                <ShieldCheck className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                                <Input className="pl-9" value={socAdmin} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSocAdmin(e.target.value)} placeholder="master@society.org" required type="email" />
                                            </div>
                                        </div>
                                        <Button type="submit" disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800">
                                            {loading ? <LoadingSpinner /> : 'Create Organization'}
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>

                            {/* Existing Societies List */}
                            <Card className="shadow-md">
                                <CardHeader className="pb-3 border-b bg-slate-50/50">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-base font-semibold text-slate-700">Registered Societies</CardTitle>
                                        <Badge variant="secondary">{societies.length} Active</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="max-h-[500px] overflow-y-auto p-4 space-y-3">
                                        {societies.length === 0 && (
                                            <div className="text-center py-8 text-slate-400 text-sm">No societies found.</div>
                                        )}
                                        {societies.map((s) => (
                                            <div
                                                key={s.id}
                                                onClick={() => startEditing(s)}
                                                className={`
                                                    group p-4 rounded-xl border transition-all cursor-pointer flex justify-between items-center relative overflow-hidden
                                                    ${editingSoc?.id === s.id
                                                        ? 'bg-blue-50 border-blue-300 shadow-inner'
                                                        : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'}
                                                `}
                                            >
                                                {editingSoc?.id === s.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />}
                                                <div className="flex items-center gap-3">
                                                    <div className={`
                                                        w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg
                                                        ${editingSoc?.id === s.id ? 'bg-blue-200 text-blue-700' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600'}
                                                    `}>
                                                        {s.id.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-800 leading-tight">{s.name.ko}</p>
                                                        <p className="text-xs text-slate-500">{s.name.en}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="font-mono bg-white text-slate-500 border-slate-200">{s.id}</Badge>
                                                    <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${editingSoc?.id === s.id ? 'text-blue-500 rotate-90' : ''}`} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* RIGHT COLUMN: Edit Panel */}
                        <div className="lg:col-span-7">
                            {editingSoc ? (
                                <div className="space-y-6 sticky top-24">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-8 bg-blue-500 rounded-full" />
                                        <h2 className="text-2xl font-bold text-slate-800">Editing: <span className="text-blue-600">{editingSoc.name.ko}</span></h2>
                                    </div>

                                    <Card className="border-slate-200 shadow-md">
                                        <CardHeader className="bg-slate-50 border-b">
                                            <CardTitle className="text-base flex items-center gap-2 text-slate-700">
                                                <Edit className="w-4 h-4" />
                                                General Information
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-5 pt-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <Label>Description (Korean)</Label>
                                                    <Input value={editDescKo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditDescKo(e.target.value)} placeholder="학회 소개글..." />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Homepage URL</Label>
                                                    <Input value={editHomepage} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditHomepage(e.target.value)} placeholder="https://kap.or.kr" />
                                                </div>
                                            </div>
                                            <div className="flex gap-3 justify-end pt-2">
                                                <Button variant="ghost" onClick={() => setEditingSoc(null)}>Cancel</Button>
                                                <Button onClick={handleUpdateSociety}>
                                                    <Save className="w-4 h-4 mr-2" /> Save Info
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <Card className="border-green-100 shadow-md">
                                            <CardHeader className="bg-green-50/50 border-b border-green-100">
                                                <CardTitle className="text-base flex items-center gap-2 text-green-800">
                                                    <UserPlus className="w-4 h-4" />
                                                    Issue Admin Account
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-6">
                                                <form onSubmit={handleCreateAdminUser} className="space-y-4">
                                                    <div className="space-y-2">
                                                        <Label>Manager Name</Label>
                                                        <Input value={newAdminName} onChange={e => setNewAdminName(e.target.value)} placeholder="Manager Kim" required />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Login Email</Label>
                                                        <Input value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="admin@kap.or.kr" type="email" required />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Password</Label>
                                                        <Input value={newAdminPass} onChange={e => setNewAdminPass(e.target.value)} type="password" placeholder="Min 6 chars" required minLength={6} />
                                                    </div>
                                                    <Button type="submit" disabled={creatingAdmin} className="w-full bg-green-600 hover:bg-green-700 text-white">
                                                        {creatingAdmin ? <LoadingSpinner /> : 'Create Account'}
                                                    </Button>
                                                </form>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-slate-200 shadow-md h-full">
                                            <CardHeader className="bg-slate-50 border-b">
                                                <CardTitle className="text-base flex items-center gap-2 text-slate-700">
                                                    <ShieldCheck className="w-4 h-4" />
                                                    Active Admins
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-6">
                                                {(!editingSoc.adminEmails || editingSoc.adminEmails.length === 0) && (
                                                    <p className="text-sm text-slate-400 italic">No admin accounts found</p>
                                                )}
                                                <ul className="space-y-2">
                                                    {editingSoc.adminEmails?.map((email: string) => (
                                                        <li key={email} className="flex items-center gap-2 text-sm p-2 bg-slate-50 rounded border border-slate-100">
                                                            <div className="w-2 h-2 rounded-full bg-green-500" />
                                                            {email}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 p-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                    <Building2 className="w-16 h-16 mb-4 opacity-50" />
                                    <p className="text-lg font-medium">Select a society to manage</p>
                                    <p className="text-sm">Click on a card from the list on the left</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'CONFERENCE' && (
                    <div className="max-w-4xl mx-auto">
                        <Card className="shadow-xl border-t-4 border-t-purple-600">
                            <CardHeader className="text-center pb-8 pt-8">
                                <div className="mx-auto w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                                    <Calendar className="w-6 h-6 text-purple-600" />
                                </div>
                                <CardTitle className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600">
                                    Launch New Conference
                                </CardTitle>
                                <CardDescription className="text-lg mt-2">Create a new event instance under an existing society organization</CardDescription>
                            </CardHeader>
                            <CardContent className="px-8 pb-8">
                                <form onSubmit={handleCreateConference} className="space-y-8">
                                    {/* Section 1: Organization & Identity */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                            <Building2 className="w-4 h-4" /> Organization & Identity
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label>Hosting Society</Label>
                                                <select
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                                                    value={selectedSocId}
                                                    onChange={e => setSelectedSocId(e.target.value)}
                                                    required
                                                >
                                                    <option value="">Select Society...</option>
                                                    {societies.map(s => (
                                                        <option key={s.id} value={s.id}>{s.name.ko} ({s.id})</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>URL Slug</Label>
                                                <div className="relative">
                                                    <Input
                                                        value={slug}
                                                        onChange={e => setSlug(e.target.value)}
                                                        placeholder="e.g. 2026spring"
                                                        className="font-mono pl-9"
                                                        required
                                                    />
                                                    <Globe className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                                </div>
                                                <p className="text-[11px] text-slate-400">
                                                    Full URL: https://{selectedSocId || 'society'}.eregi.co.kr/{slug || 'slug'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-px bg-slate-100" />

                                    {/* Section 2: Branding */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                            <Edit className="w-4 h-4" /> Event Branding
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label>Title (Korean)</Label>
                                                <Input value={titleKo} onChange={e => setTitleKo(e.target.value)} placeholder="제00회 춘계학술대회" required />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Title (English)</Label>
                                                <Input value={titleEn} onChange={e => setTitleEn(e.target.value)} placeholder="The 00th Annual Meeting..." required />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-px bg-slate-100" />

                                    {/* Section 3: Logistics */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                            <Calendar className="w-4 h-4" /> Logistics
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="space-y-2">
                                                <Label>Start Date</Label>
                                                <Input type="date" value={start} onChange={e => setStart(e.target.value)} required />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>End Date</Label>
                                                <Input type="date" value={end} onChange={e => setEnd(e.target.value)} required />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Venue Location</Label>
                                                <div className="relative">
                                                    <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Coex Grand Ballroom" required className="pl-9" />
                                                    <Globe className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-px bg-slate-100" />

                                    {/* Section 4: Administration */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4" /> Administration
                                        </h3>
                                        <div className="space-y-2">
                                            <Label>Events Manager Email</Label>
                                            <div className="relative">
                                                <Input value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="manager@example.com" required type="email" className="pl-9" />
                                                <UserPlus className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                            </div>
                                            <p className="text-[11px] text-slate-400">This user will be granted Conference Admin permissions.</p>
                                        </div>
                                    </div>

                                    <Button type="submit" disabled={loading} className="w-full h-12 text-lg font-bold bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-200">
                                        {loading ? <LoadingSpinner /> : '🚀 Launch Conference'}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === 'MEMBERS' && (
                    <div className="space-y-6">
                        <Card className="shadow-md">
                            <CardHeader className="border-b bg-slate-50/50 pb-4">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <CardTitle className="text-xl flex items-center gap-2">
                                            <Users className="w-5 h-5 text-blue-600" /> Member Management
                                        </CardTitle>
                                        <CardDescription>View and manage registered members and guest accounts</CardDescription>
                                    </div>
                                    <div className="flex items-center gap-3 w-full md:w-auto">
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
                                        <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
                                            <button
                                                onClick={() => setMemberTab('REGULAR')}
                                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${memberTab === 'REGULAR' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                REGULARS
                                            </button>
                                            <button
                                                onClick={() => setMemberTab('GUEST')}
                                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${memberTab === 'GUEST' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                GUESTS
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {memberTab === 'REGULAR' ? (
                                    loadingMembers ? (
                                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                                            <LoadingSpinner />
                                            <p className="text-sm text-slate-400">Loading verified members...</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold tracking-wide">
                                                    <tr>
                                                        <th className="p-4 pl-6">Member Identity</th>
                                                        <th className="p-4">Contact</th>
                                                        <th className="p-4">Provider</th>
                                                        <th className="p-4">Affiliation</th>
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
                                                                        {(m.name || m.displayName || '?').charAt(0)}
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-semibold text-slate-900 flex items-center gap-2">
                                                                            {(m.name && m.name.trim().length > 0) ? m.name : (m.userName || m.displayName || <span className="text-red-400 italic">No Name</span>)}
                                                                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-0 px-1.5 py-0 h-5 text-[10px]">VERIFIED</Badge>
                                                                        </div>
                                                                        <div className="text-xs text-slate-500 truncate max-w-[150px]">{m.email}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 text-slate-600 font-mono text-xs">
                                                                {m.phone || m.phoneNumber || <span className="text-slate-300">-</span>}
                                                            </td>
                                                            <td className="p-4">
                                                                {getProviderLabel(m)}
                                                            </td>
                                                            <td className="p-4 text-slate-600">
                                                                {m.organization || m.affiliation || <span className="text-slate-300">-</span>}
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="flex justify-center gap-2">
                                                                    <div className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${m.marketingAgreed ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-50 text-slate-300 border-slate-200'}`}>MKT</div>
                                                                    <div className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${m.infoAgreed ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-50 text-slate-300 border-slate-200'}`}>INFO</div>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 text-xs text-slate-500">
                                                                {(m.createdAt?.seconds) ? new Date(m.createdAt.seconds * 1000).toLocaleDateString() : '-'}
                                                            </td>
                                                            <td className="p-4 text-right pr-6">
                                                                <button
                                                                    onClick={() => handleDeleteUser(m.id, false)}
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
                                                            <td colSpan={7} className="py-12 text-center">
                                                                <div className="text-slate-400 flex flex-col items-center">
                                                                    <Search className="w-10 h-10 mb-2 opacity-20" />
                                                                    <p>No verified members found for this society.</p>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )
                                ) : (
                                    loadingGuests ? (
                                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                                            <LoadingSpinner />
                                            <p className="text-sm text-slate-400">Loading guest records...</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold tracking-wide">
                                                    <tr>
                                                        <th className="p-4 pl-6">Guest Identity</th>
                                                        <th className="p-4">Account Type</th>
                                                        <th className="p-4">Contact</th>
                                                        <th className="p-4">Target Society</th>
                                                        <th className="p-4 text-center">Agreements</th>
                                                        <th className="p-4">Created</th>
                                                        <th className="p-4 text-right pr-6">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {guests.map(g => (
                                                        <tr key={g.id} className="hover:bg-orange-50/30 transition-colors group">
                                                            <td className="p-4 pl-6">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold border border-orange-200">
                                                                        <UserPlus className="w-4 h-4" />
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-semibold text-slate-900">
                                                                            {g.name || <span className="text-slate-400 italic">Unknown</span>}
                                                                        </div>
                                                                        <div className="text-xs text-slate-500 truncate max-w-[150px]">{g.email}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="p-4">
                                                                {g.isAnonymous ? (
                                                                    <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">Anonymous</Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">Email Only</Badge>
                                                                )}
                                                            </td>
                                                            <td className="p-4 text-slate-600 font-mono text-xs">
                                                                {g.phone || <span className="text-slate-300">-</span>}
                                                            </td>
                                                            <td className="p-4 uppercase font-bold text-xs text-slate-600">
                                                                {(g as { societyId?: string }).societyId || '-'}
                                                            </td>
                                                            <td className="p-4 text-center">
                                                                <div className="flex justify-center gap-2">
                                                                    <div className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${g.marketingAgreed ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-50 text-slate-300 border-slate-200'}`}>MKT</div>
                                                                    <div className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${g.infoAgreed ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-50 text-slate-300 border-slate-200'}`}>INFO</div>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 text-xs text-slate-500">
                                                                {(g.createdAt?.seconds) ? new Date(g.createdAt.seconds * 1000).toLocaleDateString() : '-'}
                                                            </td>
                                                            <td className="p-4 text-right pr-6">
                                                                <button
                                                                    className="opacity-50 cursor-not-allowed group-hover:opacity-100 transition-opacity p-2 text-slate-300 hover:text-red-500 rounded-lg"
                                                                    disabled
                                                                    title="Guest deletion restricted via UI"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {guests.length === 0 && (
                                                        <tr>
                                                            <td colSpan={7} className="py-12 text-center text-slate-400">No guest records found.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )
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
                                {/* Action Bar */}
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

                                {/* Code Table */}
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

                                    {/* Language Switcher */}
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
                                        {/* Core Documents */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                                <Label className="flex items-center gap-2 text-base">
                                                    <ShieldCheck className="w-4 h-4 text-blue-600" /> Terms of Service
                                                </Label>
                                                <div className="relative">
                                                    <div className="absolute top-3 right-3 text-xs font-bold text-slate-300">{settingsLang}</div>
                                                    <Textarea
                                                        value={settingsLang === 'KO' ? platformTerms : platformTermsEn}
                                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => settingsLang === 'KO' ? setPlatformTerms(e.target.value) : setPlatformTermsEn(e.target.value)}
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
                                                        value={settingsLang === 'KO' ? platformPrivacy : platformPrivacyEn}
                                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => settingsLang === 'KO' ? setPlatformPrivacy(e.target.value) : setPlatformPrivacyEn(e.target.value)}
                                                        className="min-h-[250px] font-mono text-sm leading-relaxed resize-none focus:ring-2 focus:ring-green-500"
                                                        placeholder={settingsLang === 'KO' ? "개인정보 처리방침 내용을 입력하세요..." : "Enter Privacy Policy content..."}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="h-px bg-slate-100" />

                                        {/* Consent Forms */}
                                        <div className="space-y-6">
                                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">User Consent Forms</h3>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-semibold text-slate-600">Third Party Provision</Label>
                                                    <Textarea
                                                        value={settingsLang === 'KO' ? platformThirdParty : platformThirdPartyEn}
                                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => settingsLang === 'KO' ? setPlatformThirdParty(e.target.value) : setPlatformThirdPartyEn(e.target.value)}
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
            </main>
        </div>
    );
};

export default SuperAdminPage;
