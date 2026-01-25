import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, setDoc, Timestamp, orderBy, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAdminStore } from '../../store/adminStore';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import {
    Calendar,
    MapPin,
    Plus,
    ArrowRight,
    Loader2,
    ExternalLink,
    Users,
    Activity,
    BarChart3,
    ChevronDown,
    Layout
} from 'lucide-react';
import toast from 'react-hot-toast';
import { safeText } from '../../utils/safeText';

interface Conference {
    id: string;
    societyId: string;
    slug: string;
    title: { ko: string; en: string };
    dates: { start: any; end: any };
    venue?: { name: string };
    status: 'SETUP' | 'PLANNING' | 'OPEN' | 'CLOSED';
}

export default function SocietyDashboardPage() {
    const navigate = useNavigate();
    const { selectedSocietyId, enterConferenceMode } = useAdminStore();
    const [conferences, setConferences] = useState<Conference[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ totalMembers: 0, activeConfs: 0, totalConfs: 0 });

    // Create Dialog State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Create Form
    const [newTitleKo, setNewTitleKo] = useState('');
    const [newTitleEn, setNewTitleEn] = useState('');
    const [newSlug, setNewSlug] = useState('');
    const [newStart, setNewStart] = useState('');
    const [newEnd, setNewEnd] = useState('');

    const getSocietyId = () => {
        if (selectedSocietyId) return selectedSocietyId;
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') return parts[0];
        if (hostname === 'localhost' || hostname === '127.0.0.1') return 'kap';
        return null;
    };

    const targetId = getSocietyId();

    const fetchConferences = async () => {
        if (!targetId) return;
        setLoading(true);
        try {
            const q = query(
                collection(db, 'conferences'),
                where('societyId', '==', targetId)
            );
            const snapshot = await getDocs(q);
            const list = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    societyId: data.societyId,
                    slug: data.slug,
                    status: (data.status || 'SETUP').toUpperCase(),
                    dates: data.dates || { start: null, end: null },
                    venue: data.venue,
                    title: data.title || { ko: 'Untitled', en: 'Untitled' }
                } as Conference;
            });

            list.sort((a, b) => {
                const dateA = a.dates.start?.toDate ? a.dates.start.toDate() : new Date(0);
                const dateB = b.dates.start?.toDate ? b.dates.start.toDate() : new Date(0);
                return dateB.getTime() - dateA.getTime();
            });
            setConferences(list);

            // Fetch Additional Stats
            const memQ = query(collection(db, 'members'), where('societyId', '==', targetId));
            const memSnap = await getDocs(memQ);

            setStats({
                totalMembers: memSnap.size,
                activeConfs: list.filter(c => c.status === 'OPEN').length,
                totalConfs: list.length
            });

        } catch (error) {
            console.error("Error fetching conferences:", error);
            toast.error("Failed to load conferences.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConferences();
    }, [targetId]);

    const handleCreate = async () => {
        if (!newTitleKo || !newSlug || !newStart || !newEnd) {
            toast.error("Please fill in all required fields.");
            return;
        }

        if (!targetId) {
            toast.error("Critical Error: Society ID is missing.");
            return;
        }

        const safeSlug = newSlug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        if (!safeSlug) {
            toast.error("Invalid Slug. Please use English letters and numbers.");
            return;
        }

        setIsCreating(true);
        try {
            const docId = `${targetId}_${safeSlug}`;
            const docRef = doc(db, 'conferences', docId);

            const checkSnap = await getDoc(docRef);
            if (checkSnap.exists()) {
                toast.error(`A conference with slug '${safeSlug}' already exists.`);
                setIsCreating(false);
                return;
            }

            const newConfData = {
                societyId: targetId,
                slug: safeSlug,
                title: { ko: newTitleKo, en: newTitleEn },
                dates: {
                    start: Timestamp.fromDate(new Date(newStart)),
                    end: Timestamp.fromDate(new Date(newEnd))
                },
                status: 'setup',
                createdAt: Timestamp.now(),
                venue: { name: 'TBD', address: '', mapUrl: '' },
                bannerUrl: '',
                posterUrl: '',
                welcomeMessage: ''
            };

            await setDoc(docRef, newConfData);

            toast.success("Conference created successfully! 🎉");
            setIsCreateOpen(false);

            setNewTitleKo('');
            setNewTitleEn('');
            setNewSlug('');
            setNewStart('');
            setNewEnd('');

            fetchConferences();
        } catch (error: any) {
            console.error("Creation Failed:", error);
            toast.error(`Failed to create conference: ${error.message}`);
        } finally {
            setIsCreating(false);
        }
    };

    const handleStatusChange = async (id: string, newStatus: string) => {
        try {
            await updateDoc(doc(db, 'conferences', id), { status: newStatus });
            toast.success("Status updated");
            fetchConferences(); // Refresh
        } catch (e) {
            console.error("Status update failed", e);
            toast.error("Failed to update status");
        }
    };

    const handleManage = (conf: Conference) => {
        enterConferenceMode(conf.id, conf.slug, conf.societyId, conf.title);
        navigate('/admin/dashboard'); 
    };

    const formatDate = (ts: any) => {
        if (!ts || !ts.toDate) return 'TBD';
        return ts.toDate().toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const getStatusBadge = (status: string) => {
        switch (status.toUpperCase()) {
            case 'OPEN': return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none font-black px-3 py-1 text-[10px] uppercase shadow-sm">OPEN</Badge>;
            case 'PLANNING': return <Badge className="bg-sky-500 hover:bg-sky-600 text-white border-none font-black px-3 py-1 text-[10px] uppercase shadow-sm">PLANNING</Badge>;
            case 'CLOSED': return <Badge className="bg-slate-400 hover:bg-slate-500 text-white border-none font-black px-3 py-1 text-[10px] uppercase shadow-sm">CLOSED</Badge>;
            case 'SETUP': return <Badge className="bg-amber-400 hover:bg-amber-500 text-white border-none font-black px-3 py-1 text-[10px] uppercase shadow-sm">SETUP</Badge>;
            default: return <Badge variant="secondary" className="font-black px-3 py-1 text-[10px] uppercase">{status}</Badge>;
        }
    };

    if (!targetId) return <div className="p-10 text-center font-bold text-slate-400">Please access via a valid society domain.</div>;

    return (
        <div className="bg-slate-50 min-h-screen p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-2">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                                <Layout size={20} />
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Society Dashboard</h1>
                        </div>
                        <p className="text-slate-500 font-medium pl-1">Monitoring all academic events and member activity.</p>
                    </div>

                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-500/20 rounded-2xl h-14 px-8 font-black text-sm active:scale-95 transition-all">
                                <Plus className="w-5 h-5 mr-2" />
                                Create New Conference
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px] rounded-3xl overflow-hidden border-none shadow-2xl">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-black">Register Event</DialogTitle>
                                <DialogDescription className="font-medium text-slate-400">
                                    Initialize your conference metadata for the eRegi network.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-5 py-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase text-slate-400 ml-1">Title (Korean)</Label>
                                        <Input
                                            placeholder="제00회 학술대회"
                                            className="h-12 rounded-xl border-slate-200 focus:ring-4 focus:ring-blue-500/10 transition-all"
                                            value={newTitleKo}
                                            onChange={e => setNewTitleKo(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase text-slate-400 ml-1">Title (English)</Label>
                                        <Input
                                            placeholder="Annual Scientific Meeting..."
                                            className="h-12 rounded-xl border-slate-200 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                                            value={newTitleEn}
                                            onChange={e => setNewTitleEn(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase text-slate-400 ml-1">URL Identifier (Slug)</Label>
                                        <div className="flex items-center group">
                                            <div className="bg-slate-50 border border-slate-200 border-r-0 rounded-l-xl px-4 h-12 flex items-center text-xs font-black text-slate-400">
                                                /{targetId}/
                                            </div>
                                            <Input
                                                className="rounded-l-none h-12 rounded-r-xl border-slate-200 focus:ring-4 focus:ring-blue-500/10 transition-all font-black text-blue-600 placeholder:font-normal"
                                                placeholder="2026spring"
                                                value={newSlug}
                                                onChange={e => setNewSlug(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black uppercase text-slate-400 ml-1">Start Date</Label>
                                            <Input
                                                type="date"
                                                className="h-12 rounded-xl border-slate-200 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                                                value={newStart}
                                                onChange={e => setNewStart(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black uppercase text-slate-400 ml-1">End Date</Label>
                                            <Input
                                                type="date"
                                                className="h-12 rounded-xl border-slate-200 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                                                value={newEnd}
                                                onChange={e => setNewEnd(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter className="bg-slate-50/50 p-6 -m-6 mt-2 border-t border-slate-100">
                                <Button variant="ghost" className="font-bold text-slate-500" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                                <Button className="bg-blue-600 hover:bg-blue-700 px-8 rounded-xl font-black text-sm shadow-lg shadow-blue-500/20" onClick={handleCreate} disabled={isCreating}>
                                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Event'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Statistics Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <StatCard label="Total Members" value={stats.totalMembers} icon={<Users className="text-blue-500" />} trend="Active" />
                     <StatCard label="Active Events" value={stats.activeConfs} icon={<Activity className="text-emerald-500" />} trend="Live" />
                     <StatCard label="Total Events" value={stats.totalConfs} icon={<BarChart3 className="text-purple-500" />} trend="All Time" />
                </div>

                {/* Conference Grid */}
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-black text-slate-900">Events Management</h2>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-32 space-y-4">
                            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                            <p className="text-slate-400 font-bold animate-pulse uppercase tracking-widest text-xs">Syncing with Firestore...</p>
                        </div>
                    ) : conferences.length === 0 ? (
                        <div className="text-center py-32 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm border-dashed">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Calendar className="w-10 h-10 text-slate-300" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900">등록된 학술대회가 없습니다.</h3>
                            <p className="text-slate-500 mt-2 mb-8 font-medium">새로운 학술대회를 생성하거나 시스템 관리자에게 문의하세요.</p>
                            <Button onClick={() => setIsCreateOpen(true)} className="bg-slate-900 hover:bg-black rounded-xl font-bold px-8">
                                <Plus size={18} className="mr-2" />
                                첫 행사 등록하기
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-10">
                            {conferences.map((conf) => (
                                <Card key={conf.id} className="group border-none shadow-sm hover:shadow-2xl hover:shadow-slate-200 transition-all duration-300 rounded-[2.5rem] overflow-hidden bg-white">
                                    <CardHeader className="p-8 pb-4 bg-slate-50/50 border-b border-slate-100 relative">
                                        <div className="flex justify-between items-start mb-4">
                                            {getStatusBadge(conf.status)}
                                            <span className="text-[10px] font-black font-mono text-slate-400 bg-white px-2 py-1 rounded-md border border-slate-100 uppercase italic">/{conf.slug}</span>
                                        </div>
                                        <CardTitle className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors leading-[1.3] min-h-[3rem]">
                                            {safeText(conf.title)}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-8 space-y-5">
                                        <div className="flex items-center text-sm font-bold text-slate-500">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center mr-3 text-slate-400">
                                                <Calendar size={16} />
                                            </div>
                                            <span>{formatDate(conf.dates.start)} - {formatDate(conf.dates.end)}</span>
                                        </div>
                                        <div className="flex items-center text-sm font-bold text-slate-500">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center mr-3 text-slate-400">
                                                <MapPin size={16} />
                                            </div>
                                            <span className="truncate">{safeText(conf.venue?.name)}</span>
                                        </div>

                                        <div className="pt-2 flex items-center justify-between">
                                            <Label className="text-[10px] font-black uppercase text-slate-300 tracking-widest ml-1">Manage Status</Label>
                                            <div className="relative group/select">
                                                <select
                                                    className="appearance-none bg-white border border-slate-200 text-slate-600 text-[11px] font-black py-2 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 cursor-pointer shadow-sm hover:border-blue-500/30 transition-all uppercase tracking-tight"
                                                    value={conf.status}
                                                    onChange={(e) => handleStatusChange(conf.id, e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <option value="SETUP">SETUP</option>
                                                    <option value="PLANNING">PLANNING</option>
                                                    <option value="OPEN">OPEN</option>
                                                    <option value="CLOSED">CLOSED</option>
                                                </select>
                                                <ChevronDown size={14} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none group-hover/select:text-blue-500 transition-colors" />
                                            </div>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="p-8 pt-0 flex flex-col gap-3">
                                        <Button
                                            className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm shadow-xl shadow-blue-500/10 active:scale-95 transition-all"
                                            onClick={() => handleManage(conf)}
                                        >
                                            Enter Management Console
                                            <ArrowRight className="w-4 h-4 ml-2" />
                                        </Button>
                                        <button
                                            onClick={() => {
                                                const url = window.location.origin.includes('localhost')
                                                    ? `/${conf.slug}`
                                                    : `https://${targetId}.eregi.co.kr/${conf.slug}`;
                                                window.open(url, '_blank');
                                            }}
                                            className="w-full flex items-center justify-center gap-2 text-[10px] font-black text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-widest py-2"
                                        >
                                            <ExternalLink size={12} />
                                            Live Landing Page
                                        </button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon, trend }: { label: string; value: string | number; icon: React.ReactNode; trend: string }) {
    return (
        <Card className="border-none shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-[2rem] bg-white p-6 overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full translate-x-12 -translate-y-12 transition-transform group-hover:scale-150 group-hover:bg-slate-100/50 duration-500" />
            <div className="relative z-10 flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                    {icon}
                </div>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{trend}</span>
            </div>
            <div className="relative z-10">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-3xl font-black text-slate-900 tracking-tighter">{value}</p>
            </div>
        </Card>
    );
}
