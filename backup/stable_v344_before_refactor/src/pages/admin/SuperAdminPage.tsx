import React, { useState, useEffect } from 'react';
import { useSuperAdmin } from '../../hooks/useSuperAdmin';
import { useSuperAdminGuard } from '../../hooks/useSuperAdminGuard';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../components/ui/card';
import { LogOut, Plus, Building2, Calendar, Edit, UserPlus, Save, Users, Settings, Trash2 } from 'lucide-react';
import { auth, functions } from '../../firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, updateDoc, getDocs, collection, getDoc, setDoc, deleteDoc, addDoc, serverTimestamp, query, limit, collectionGroup, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';

import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';

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
    [key: string]: any;
}

const SuperAdminPage: React.FC = () => {
    const { authorized, checking } = useSuperAdminGuard();
    const { loading, error, societies, createSociety, createConference } = useSuperAdmin();

    const [activeTab, setActiveTab] = useState<'SOCIETY' | 'CONFERENCE' | 'MEMBERS' | 'SETTINGS' | 'CODES'>('SOCIETY');

    // Society Form
    const [socId, setSocId] = useState('');
    const [socNameKo, setSocNameKo] = useState('');
    const [socNameEn, setSocNameEn] = useState('');
    const [socAdmin, setSocAdmin] = useState('');

    // Conference Form
    const [selectedSocId, setSelectedSocId] = useState('');
    const [slug, setSlug] = useState('');
    const [titleKo, setTitleKo] = useState('');
    const [titleEn, setTitleEn] = useState('');
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [location, setLocation] = useState('');
    const [adminEmail, setAdminEmail] = useState('');

    // Member List State
    const [currentSocietyId, setCurrentSocietyId] = useState<string>('');
    const [members, setMembers] = useState<UserData[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    
    // [Fix-Step 336] Guest List State
    const [guests, setGuests] = useState<UserData[]>([]);
    const [loadingGuests, setLoadingGuests] = useState(false);
    const [memberTab, setMemberTab] = useState<'REGULAR' | 'GUEST'>('REGULAR');

    // Verification Codes State
    const [codes, setCodes] = useState<any[]>([]);
    const [loadingCodes, setLoadingCodes] = useState(false);
    const [newCodeName, setNewCodeName] = useState('');
    const [newCodeValue, setNewCodeValue] = useState('');
    const [newCodeSocId, setNewCodeSocId] = useState('');
    const [newCodeExpiry, setNewCodeExpiry] = useState(''); // [Step 399-D] Expiry Date

    // Platform Settings State
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

    // [Fix-Step 266] Nuclear Scan State - REMOVED
    
    // Edit Society State
    const [editingSoc, setEditingSoc] = useState<any>(null);
    const [editDescKo, setEditDescKo] = useState('');
    const [editHomepage, setEditHomepage] = useState('');
    
    // Create Admin User State
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [newAdminPass, setNewAdminPass] = useState('');
    const [newAdminName, setNewAdminName] = useState('');
    const [creatingAdmin, setCreatingAdmin] = useState(false);
    
    // [Fix-Step 337] Nuclear Delete
    const handleDeleteUser = async (uid: string, isGuest: boolean = false) => {
        if (!confirm("🚨 WARNING: This will PERMANENTLY DELETE the user account (Auth + DB). This cannot be undone.\n\nAre you sure?")) return;
        
        const toastId = toast.loading("Deleting user...");
        try {
            const deleteFn = httpsCallable(functions, 'deleteUserAccount');
            const res: any = await deleteFn({ uid });
            
            if (res.data.success) {
                toast.success("User terminated.", { id: toastId });
                
                // Update Local State
                if (isGuest) {
                    setGuests(prev => prev.filter(g => g.id !== uid));
                    // Also try to remove from members list if present (sometimes guests are in both?)
                    setMembers(prev => prev.filter(m => m.id !== uid));
                } else {
                    setMembers(prev => prev.filter(m => m.id !== uid));
                }
            } else {
                toast.error("Deletion failed.", { id: toastId });
            }
        } catch (e: any) {
            console.error("Delete Error:", e);
            toast.error(`Error: ${e.message}`, { id: toastId });
        }
    };

    // Helper Function
    const getProviderLabel = (u: any) => {
        const p = u.provider || u.providerId;
        if (p === 'google' || p === 'google.com' || (u.photoURL && u.photoURL.includes('google'))) {
            return <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold">Google</span>;
        }
        return <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-bold">Email</span>;
    };

    // Fetch Members
    const fetchMembers = async () => {
        setLoadingMembers(true);
        setLoadingGuests(true);
        try {
            // 1. 전체 사용자 로드 
            const snap = await getDocs(collection(db, 'users')); 
            const allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() })) as UserData[]; 
        
            // 2. 정회원 필터 (Strict): 이메일 계정이며 && 해당 학회 인증 완료 
            const regulars = allUsers.filter(u => 
                !u.isAnonymous && currentSocietyId && u.affiliations?.[currentSocietyId]?.verified === true 
            ); 
        
            // 3. 비회원 필터 (Inclusive): 익명이거나 || 이메일은 있지만 미인증 
            const guestList = allUsers.filter(u => 
                u.isAnonymous === true || !currentSocietyId || !u.affiliations?.[currentSocietyId]?.verified 
            ); 
        
            // 4. 상태 저장 
            setMembers(regulars); 
            setGuests(guestList); 
        } catch (e) {
            console.error(e);
            toast.error("Failed to fetch members");
        } finally {
            setLoadingMembers(false);
            setLoadingGuests(false);
        }
    };

    // Auto-select society if not selected
    useEffect(() => {
        if (!currentSocietyId && societies.length > 0) {
            setCurrentSocietyId(societies[0].id);
        }
    }, [societies, currentSocietyId]);

    // Refetch when society changes if on members tab
    useEffect(() => {
        if (activeTab === 'MEMBERS' && currentSocietyId) {
            fetchMembers();
        }
    }, [currentSocietyId, activeTab]);

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
                    // Ensure these fields are read even if undefined
                    used: data.used || false,
                    usedBy: data.usedBy || '-',
                    usedAt: data.usedAt || null
                };
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
            // Check duplicate
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
            setNewCodeName(''); setNewCodeValue('');
            fetchCodes();
        } catch (e: any) {
            toast.error(e.message);
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
        } catch (e: any) {
            toast.error(e.message);
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
                setPlatformTerms(data.terms || data.termsService || '');
                setPlatformTermsEn(data.termsEn || '');
                setPlatformPrivacy(data.privacy || data.termsPrivacy || '');
                setPlatformPrivacyEn(data.privacyEn || '');
                setPlatformThirdParty(data.thirdParty || '');
                setPlatformThirdPartyEn(data.thirdPartyEn || '');
                setTermsMarketing(data.termsMarketing || '');
                setTermsMarketingEn(data.termsMarketingEn || '');
                setTermsAdInfo(data.termsAdInfo || '');
                setTermsAdInfoEn(data.termsAdInfoEn || '');
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

    // if (checking) return <div className="flex items-center justify-center h-screen"><LoadingSpinner /></div>;
    // if (!authorized) return null;

    // ... (Existing handlers: handleCreateSociety, handleCreateConference)
    const handleCreateSociety = async (e: React.FormEvent) => {
        e.preventDefault();
        const success = await createSociety(socId, socNameKo, socNameEn, socAdmin);
        if (success) {
            toast.success('Society Created!');
            setSocId(''); setSocNameKo(''); setSocNameEn(''); setSocAdmin('');
        } else {
            toast.error('Failed to create society');
        }
    };

    const handleCreateConference = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSocId) return toast.error('Please select a society');
        const success = await createConference(selectedSocId, slug.toLowerCase().trim(), titleKo, titleEn, start, end, location, adminEmail);
        if (success) {
            toast.success('Conference Created Successfully!');
            const url = `https://${selectedSocId}.eregi.co.kr/${slug}`;
            toast((t) => (
                <span>Created! <a href={url} target="_blank" className="underline text-blue-500">View Conference</a></span>
            ), { duration: 5000 });
            setSlug(''); setTitleKo(''); setTitleEn(''); setStart(''); setEnd(''); setLocation(''); setAdminEmail('');
        } else {
            toast.error('Failed to create conference.');
        }
    };

    // New Handlers
    const startEditing = (soc: any) => {
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
            // Ideally refresh list here
        } catch (e: any) {
            toast.error('Update failed: ' + e.message);
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
            setNewAdminEmail(''); setNewAdminPass(''); setNewAdminName('');
        } catch (e: any) {
            console.error("FULL ERROR OBJECT:", e);
            console.error("Error Code:", e.code);
            console.error("Error Message:", e.message);
            console.error("Error Details:", e.details);
            
            toast.error(`Create Failed: ${e.message} (${e.code})`);
        } finally {
            setCreatingAdmin(false);
        }
    };

    const handleMigrateKadd = async () => {
        toast.error("Migration tool disabled.");
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Super Admin Dashboard (v338)</h1>
                        <p className="text-slate-500">Manage Societies and Conferences</p>
                    </div>
                    <Button variant="outline" onClick={() => auth.signOut()}>
                        <LogOut className="w-4 h-4 mr-2" /> Sign Out
                    </Button>
                </div>
                
                {/* Tabs */}
                <div className="flex gap-4 mb-8">
                    <Button 
                        variant={activeTab === 'SOCIETY' ? 'default' : 'outline'}
                        onClick={() => setActiveTab('SOCIETY')}
                        className="w-48"
                    >
                        <Building2 className="w-4 h-4 mr-2" /> Manage Societies
                    </Button>
                    <Button 
                        variant={activeTab === 'CONFERENCE' ? 'default' : 'outline'}
                        onClick={() => setActiveTab('CONFERENCE')}
                        className="w-48"
                    >
                        <Calendar className="w-4 h-4 mr-2" /> Manage Conferences
                    </Button>
                    <Button 
                        variant={activeTab === 'MEMBERS' ? 'default' : 'outline'}
                        onClick={() => { setActiveTab('MEMBERS'); fetchMembers(); }}
                        className="w-48"
                    >
                        <Users className="w-4 h-4 mr-2" /> Member Management
                    </Button>
                    <Button 
                        variant={activeTab === 'CODES' ? 'default' : 'outline'}
                        onClick={() => { setActiveTab('CODES'); fetchCodes(); }}
                        className="w-48"
                    >
                        <Users className="w-4 h-4 mr-2" /> Verification Codes
                    </Button>
                    <Button 
                        variant={activeTab === 'SETTINGS' ? 'default' : 'outline'}
                        onClick={() => { setActiveTab('SETTINGS'); fetchPlatformSettings(); }}
                        className="w-48"
                    >
                        <Settings className="w-4 h-4 mr-2" /> Platform Settings
                    </Button>
                </div>

                {/* Society Tab */}
                {activeTab === 'SOCIETY' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Left: List & Create */}
                        <div className="space-y-8">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Create New Society</CardTitle>
                                    <CardDescription>Register a new organization (e.g. KAP)</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleCreateSociety} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Society ID (Subdomain)</Label>
                                            <Input value={socId} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSocId(e.target.value)} placeholder="e.g. kap" required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Name (Korean)</Label>
                                            <Input value={socNameKo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSocNameKo(e.target.value)} placeholder="대한치과보철학회" required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Name (English)</Label>
                                            <Input value={socNameEn} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSocNameEn(e.target.value)} placeholder="The Korean Academy of Prosthodontics" required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Initial Admin Email</Label>
                                            <Input value={socAdmin} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSocAdmin(e.target.value)} placeholder="manager@kap.or.kr" required type="email" />
                                        </div>
                                        <Button type="submit" disabled={loading} className="w-full">
                                            {loading ? <LoadingSpinner /> : <><Plus className="w-4 h-4 mr-2" /> Create Society</>}
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Existing Societies</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                        {societies.length === 0 && <p className="text-muted-foreground text-sm">No societies found.</p>}
                                        {societies.map((s: any) => (
                                            <div key={s.id} className="p-3 border rounded-md flex justify-between items-center bg-white hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => startEditing(s)}>
                                                <div>
                                                    <p className="font-medium">{s.name.ko}</p>
                                                    <p className="text-xs text-muted-foreground">{s.name.en}</p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 font-mono">{s.id}</span>
                                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 ml-2"><Edit className="w-3 h-3" /></Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right: Detail Editor */}
                        {editingSoc ? (
                            <div className="space-y-8">
                                <Card className="border-blue-200 bg-blue-50/30">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Edit className="w-5 h-5" /> Edit Info: {editingSoc.name.ko}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Description (Korean)</Label>
                                            <Input value={editDescKo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditDescKo(e.target.value)} placeholder="학회 소개글..." />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Homepage URL</Label>
                                            <Input value={editHomepage} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditHomepage(e.target.value)} placeholder="https://kap.or.kr" />
                                        </div>
                                        <Button onClick={handleUpdateSociety} className="w-full">
                                            <Save className="w-4 h-4 mr-2" /> Save Changes
                                        </Button>
                                        <Button variant="ghost" onClick={() => setEditingSoc(null)} className="w-full text-muted-foreground">Cancel</Button>
                                    </CardContent>
                                </Card>

                                <Card className="border-green-200 bg-green-50/30">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <UserPlus className="w-5 h-5" /> Create Admin Account
                                        </CardTitle>
                                        <CardDescription>Issue a new login for {editingSoc.id} manager</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <form onSubmit={handleCreateAdminUser} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Admin Name</Label>
                                                <Input value={newAdminName} onChange={e => setNewAdminName(e.target.value)} placeholder="Manager Kim" required />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Email (Login ID)</Label>
                                                <Input value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="admin@kap.or.kr" type="email" required />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Password</Label>
                                                <Input value={newAdminPass} onChange={e => setNewAdminPass(e.target.value)} type="password" placeholder="Min 6 chars" required minLength={6} />
                                            </div>
                                            <Button type="submit" disabled={creatingAdmin} className="w-full" variant="secondary">
                                                {creatingAdmin ? <LoadingSpinner /> : 'Create Account'}
                                            </Button>
                                        </form>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader><CardTitle>Admin List</CardTitle></CardHeader>
                                    <CardContent>
                                        <ul className="list-disc pl-5 text-sm text-slate-600">
                                            {editingSoc.adminEmails?.map((email: string) => (
                                                <li key={email}>{email}</li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground bg-slate-100 rounded-lg border-2 border-dashed border-slate-200 min-h-[400px]">
                                Select a society to edit details
                            </div>
                        )}
                    </div>
                )}

                {/* Conference Tab (Unchanged mostly) */}
                {activeTab === 'CONFERENCE' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Create New Conference</CardTitle>
                            <CardDescription>Launch a new event under an existing society</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreateConference} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Select Society</Label>
                                    <select 
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Conference Slug</Label>
                                        <Input value={slug} onChange={e => setSlug(e.target.value)} placeholder="e.g. 2026spring" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Location</Label>
                                        <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Seoul Coex" required />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Title (Korean)</Label>
                                        <Input value={titleKo} onChange={e => setTitleKo(e.target.value)} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Title (English)</Label>
                                        <Input value={titleEn} onChange={e => setTitleEn(e.target.value)} required />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Start Date</Label>
                                        <Input type="date" value={start} onChange={e => setStart(e.target.value)} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>End Date</Label>
                                        <Input type="date" value={end} onChange={e => setEnd(e.target.value)} required />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Admin Email</Label>
                                    <Input value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="manager@example.com" required type="email" />
                                </div>
                                <Button type="submit" disabled={loading} className="w-full">
                                    {loading ? <LoadingSpinner /> : 'Create Conference'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {/* Member Tab */}
                {activeTab === 'MEMBERS' && (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <CardTitle>Member Management</CardTitle>
                                            <CardDescription>View Regular Members and Guest Users</CardDescription>
                                        </div>
                                        <select 
                                            className="border p-2 rounded w-48 text-sm"
                                            value={currentSocietyId}
                                            onChange={e => setCurrentSocietyId(e.target.value)}
                                        >
                                            {societies.map(s => <option key={s.id} value={s.id}>{s.name.ko}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
                                        <button 
                                            onClick={() => setMemberTab('REGULAR')}
                                            className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${memberTab === 'REGULAR' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                                        >
                                            Regular Members ({members.length})
                                        </button>
                                        <button 
                                            onClick={() => setMemberTab('GUEST')}
                                            className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${memberTab === 'GUEST' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                                        >
                                            Guests ({guests.length})
                                        </button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {memberTab === 'REGULAR' ? (
                                    loadingMembers ? (
                                        <div className="flex justify-center p-10"><LoadingSpinner /></div>
                                    ) : (
                                        <div className="rounded-md border">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b bg-slate-50">
                                                        <th className="p-4 text-left font-medium text-slate-500">Name</th>
                                                        <th className="p-4 text-left font-medium text-slate-500">Email</th>
                                                        <th className="p-4 text-left font-medium text-slate-500">Provider</th>
                                                        <th className="p-4 text-left font-medium text-slate-500">Phone</th>
                                                        <th className="p-4 text-left font-medium text-slate-500">Affiliation</th>
                                                        <th className="p-4 text-center font-medium text-slate-500">Mkt</th>
                                                        <th className="p-4 text-center font-medium text-slate-500">Info</th>
                                                        <th className="p-4 text-left font-medium text-slate-500">Joined</th>
                                                        <th className="p-4 text-right font-medium text-slate-500">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {members.map(m => (
                                                        <tr key={m.id} className="border-b last:border-0 hover:bg-slate-50">
                                                            <td className="p-4 font-medium">
                                                                <div className="flex items-center gap-2">
                                                                    {(m.name && m.name.trim().length > 0) ? m.name : (m.userName || m.displayName || <span className="text-red-400 italic">Incomplete (No Name)</span>)}
                                                                    <Badge className="bg-blue-600 hover:bg-blue-700">Verified</Badge>
                                                                </div>
                                                            </td>
                                                            <td className="p-4">{m.email}</td>
                                                            <td className="p-4">{getProviderLabel(m)}</td>
                                                            <td className="p-4">{m.phone || m.phoneNumber}</td>
                                                            <td className="p-4">{m.organization || m.affiliation || '-'}</td>
                                                            <td className="p-4 text-center">
                                                                {m.marketingAgreed ? <span className="text-green-600 font-bold">O</span> : <span className="text-gray-300">X</span>}
                                                            </td>
                                                            <td className="p-4 text-center">
                                                                {m.infoAgreed ? <span className="text-green-600 font-bold">O</span> : <span className="text-gray-300">X</span>}
                                                            </td>
                                                            <td className="p-4 text-xs text-gray-500">
                                                                {m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000).toLocaleDateString() : '-'}
                                                            </td>
                                                            <td className="p-4 text-right">
                                                                <button 
                                                                    onClick={() => handleDeleteUser(m.id, false)} 
                                                                    className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition-colors"
                                                                    style={{ border: '2px solid red', cursor: 'pointer' }}
                                                                >
                                                                    DELETE
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {members.length === 0 && (
                                                        <tr>
                                                            <td colSpan={9} className="p-8 text-center text-slate-500">No verified members found for {currentSocietyId}.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )
                                ) : (
                                    loadingGuests ? (
                                        <div className="flex justify-center p-10"><LoadingSpinner /></div>
                                    ) : (
                                        <div className="rounded-md border">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b bg-slate-50">
                                                        <th className="p-4 text-left font-medium text-slate-500">Name</th>
                                                        <th className="p-4 text-left font-medium text-slate-500">Email</th>
                                                        <th className="p-4 text-left font-medium text-slate-500">Phone</th>
                                                        <th className="p-4 text-left font-medium text-slate-500">Society</th>
                                                        <th className="p-4 text-center font-medium text-slate-500">Mkt</th>
                                                        <th className="p-4 text-center font-medium text-slate-500">Info</th>
                                                        <th className="p-4 text-left font-medium text-slate-500">Created At</th>
                                                        <th className="p-4 text-right font-medium text-slate-500">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {guests.map(g => (
                                                        <tr key={g.id} className="border-b last:border-0 hover:bg-slate-50">
                                                            <td className="p-4 font-medium">
                                                                <div className="flex items-center gap-2">
                                                                    {g.name || <span className="text-red-400 italic">Incomplete Guest</span>}
                                                                    {g.isAnonymous ? (
                                                                        <Badge variant="secondary">Guest</Badge>
                                                                    ) : (
                                                                        <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">Email Only</Badge>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="p-4">{g.email}</td>
                                                            <td className="p-4">{g.phone || '-'}</td>
                                                            <td className="p-4 uppercase font-bold text-xs">{g.societyId}</td>
                                                            <td className="p-4 text-center">
                                                                {g.marketingAgreed ? <span className="text-green-600 font-bold">O</span> : <span className="text-gray-300">X</span>}
                                                            </td>
                                                            <td className="p-4 text-center">
                                                                {g.infoAgreed ? <span className="text-green-600 font-bold">O</span> : <span className="text-gray-300">X</span>}
                                                            </td>
                                                            <td className="p-4 text-xs text-gray-500">
                                                                {g.createdAt?.seconds ? new Date(g.createdAt.seconds * 1000).toLocaleString() : '-'}
                                                            </td>
                                                            <td className="p-4 text-right">
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="sm" 
                                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                    // Guests might not have UID if they are just in society_guests collection? 
                                                                    // Wait, society_guests are subcollections of USERS.
                                                                    // So g.id is the doc ID in society_guests, but the parent ID is the User ID.
                                                                    // We need the User ID to delete the Auth.
                                                                    // But wait, the query was collectionGroup.
                                                                    // collectionGroup results have a `ref` property that has `parent` (collection) and `parent.parent` (doc).
                                                                    // However, we just mapped `d.data()`. We need the parent ID.
                                                                    // Let's assume for now we can't easily get the parent ID from just the data if we didn't store it.
                                                                    // Ah, for guests, they might be Anonymous users.
                                                                    // If we used collectionGroup, we need the parent ID.
                                                                    // Let's disable delete for Guests here OR fix the fetch logic to include parent ID.
                                                                    disabled={true} 
                                                                    title="Deleting from guest list requires parent ID - Pending Fix"
                                                                >
                                                                    <Trash2 className="w-4 h-4 opacity-50" />
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {guests.length === 0 && (
                                                        <tr>
                                                            <td colSpan={8} className="p-8 text-center text-slate-500">No guest records found.</td>
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

                {/* Codes Tab */}
                {activeTab === 'CODES' && (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Verification Code Management</CardTitle>
                                <CardDescription>Manage 1:1 verification codes for society members</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
                                    <select 
                                        className="border p-2 rounded w-48"
                                        value={newCodeSocId}
                                        onChange={e => setNewCodeSocId(e.target.value)}
                                    >
                                        <option value="">Select Society</option>
                                        {societies.map((s: any) => <option key={s.id} value={s.id}>{s.name.ko}</option>)}
                                    </select>
                                    <Input 
                                        placeholder="Member Name" 
                                        value={newCodeName} 
                                        onChange={e => setNewCodeName(e.target.value)}
                                        className="w-48"
                                    />
                                    <Input 
                                        placeholder="Code (e.g. 1234)" 
                                        value={newCodeValue} 
                                        onChange={e => setNewCodeValue(e.target.value)}
                                        className="w-32"
                                    />
                                    {/* [Step 399-D] Expiry Date Picker */}
                                    <Input 
                                        type="date"
                                        value={newCodeExpiry}
                                        onChange={e => setNewCodeExpiry(e.target.value)}
                                        className="w-40"
                                        title="Expiry Date (Optional)"
                                    />
                                    <Button onClick={handleCreateCode}>Add Code</Button>
                                    <div className="flex-1 text-right">
                                        <Button variant="destructive" onClick={handleResetCodes}>Reset All Codes</Button>
                                    </div>
                                </div>

                                {loadingCodes ? <LoadingSpinner /> : (
                                    <div className="rounded-md border max-h-[600px] overflow-y-auto">
                                        <table className="w-full text-sm">
                                            <thead className="sticky top-0 z-10">
                                                <tr className="bg-slate-50 border-b shadow-sm">
                                                    <th className="p-3 text-left">Society</th>
                                                    <th className="p-3 text-left">Name</th>
                                                    <th className="p-3 text-left">Code</th>
                                                    <th className="p-3 text-left">Expiry</th>
                                                    <th className="p-3 text-left">Status</th>
                                                    <th className="p-3 text-left">Used By</th>
                                                    <th className="p-3 text-left">Used At</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {codes.map(c => (
                                                    <tr key={c.id} className="border-b">
                                                        <td className="p-3">{c.societyId}</td>
                                                        <td className="p-3 font-medium">{c.name}</td>
                                                        <td className="p-3 font-mono">{c.code}</td>
                                                        <td className="p-3 text-xs text-slate-500">
                                                            {c.expiryDate ? (c.expiryDate.seconds ? new Date(c.expiryDate.seconds * 1000).toLocaleDateString() : new Date(c.expiryDate).toLocaleDateString()) : '-'}
                                                        </td>
                                                        <td className="p-3">
                                                            {c.used ? (
                                                                <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded">USED</span>
                                                            ) : (
                                                                <span className="text-green-600 font-bold bg-green-50 px-2 py-1 rounded">AVAILABLE</span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-xs text-slate-500">{c.usedBy || '-'}</td>
                                                        <td className="p-3 text-xs text-slate-500">
                                                            {c.usedAt?.seconds ? new Date(c.usedAt.seconds * 1000).toLocaleString() : '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {codes.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">No codes found.</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Settings Tab */}
                {activeTab === 'SETTINGS' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Platform Legal Settings</CardTitle>
                            <CardDescription>Manage Terms of Service and Privacy Policy for the entire platform.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex justify-end mb-4">
                                <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
                                    <button 
                                        onClick={() => setSettingsLang('KO')}
                                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${settingsLang === 'KO' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                                    >
                                        KOREAN
                                    </button>
                                    <button 
                                        onClick={() => setSettingsLang('EN')}
                                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${settingsLang === 'EN' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                                    >
                                        ENGLISH
                                    </button>
                                </div>
                            </div>

                            {loadingSettings ? (
                                <div className="flex justify-center p-10"><LoadingSpinner /></div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <Label>Terms of Service ({settingsLang})</Label>
                                        {settingsLang === 'KO' ? (
                                            <Textarea value={platformTerms} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPlatformTerms(e.target.value)} className="min-h-[200px] font-mono text-sm" placeholder="서비스 이용약관 (국문)" />
                                        ) : (
                                            <Textarea value={platformTermsEn} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPlatformTermsEn(e.target.value)} className="min-h-[200px] font-mono text-sm" placeholder="Terms of Service (English)" />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Privacy Policy ({settingsLang})</Label>
                                        {settingsLang === 'KO' ? (
                                            <Textarea value={platformPrivacy} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPlatformPrivacy(e.target.value)} className="min-h-[200px] font-mono text-sm" placeholder="개인정보 처리방침 (국문)" />
                                        ) : (
                                            <Textarea value={platformPrivacyEn} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPlatformPrivacyEn(e.target.value)} className="min-h-[200px] font-mono text-sm" placeholder="Privacy Policy (English)" />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Third Party Consent ({settingsLang})</Label>
                                        {settingsLang === 'KO' ? (
                                            <Textarea value={platformThirdParty} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPlatformThirdParty(e.target.value)} className="min-h-[150px] font-mono text-sm" placeholder="제3자 정보 제공 동의 (국문)" />
                                        ) : (
                                            <Textarea value={platformThirdPartyEn} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPlatformThirdPartyEn(e.target.value)} className="min-h-[150px] font-mono text-sm" placeholder="Third Party Consent (English)" />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-blue-700">Marketing Consent ({settingsLang} - Optional)</Label>
                                        {settingsLang === 'KO' ? (
                                            <Textarea value={termsMarketing} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTermsMarketing(e.target.value)} className="min-h-[150px] font-mono text-sm bg-blue-50/50" placeholder="마케팅 정보 수신 동의 (국문)" />
                                        ) : (
                                            <Textarea value={termsMarketingEn} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTermsMarketingEn(e.target.value)} className="min-h-[150px] font-mono text-sm bg-blue-50/50" placeholder="Marketing Consent (English)" />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-blue-700">Ad Info Consent ({settingsLang} - Optional)</Label>
                                        {settingsLang === 'KO' ? (
                                            <Textarea value={termsAdInfo} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTermsAdInfo(e.target.value)} className="min-h-[150px] font-mono text-sm bg-blue-50/50" placeholder="광고성 정보 전송 동의 (국문)" />
                                        ) : (
                                            <Textarea value={termsAdInfoEn} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTermsAdInfoEn(e.target.value)} className="min-h-[150px] font-mono text-sm bg-blue-50/50" placeholder="Ad Info Consent (English)" />
                                        )}
                                    </div>
                                    <Button onClick={handleSaveSettings} className="w-full">
                                        <Save className="w-4 h-4 mr-2" /> Save Settings (All Languages)
                                    </Button>
                                </>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default SuperAdminPage;
