import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where, doc, setDoc, Timestamp, getDoc, updateDoc } from 'firebase/firestore';
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
    Layout,
    Globe
} from 'lucide-react';
import toast from 'react-hot-toast';
import { safeText } from '../../utils/safeText';
import { safeFormatDate } from '../../utils/dateUtils';

interface Conference {
    id: string;
    societyId: string;
    slug: string;
    title: { ko: string; en: string };
    dates: { start: unknown; end: unknown };
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
        // ✅ 0순위: adminStore에서 선택된 societyId
        if (selectedSocietyId) return selectedSocietyId;

        // ✅ 1순위: URL 파라미터 ?society=kadd (DEV 환경)
        const params = new URLSearchParams(window.location.search);
        const societyParam = params.get('society');
        if (societyParam) return societyParam;

        // ✅ 2순위: sessionStorage (로그인 후 리다이렉트 시)
        const sessionSocietyId = sessionStorage.getItem('societyId');
        if (sessionSocietyId) return sessionSocietyId;

        // ✅ 3순위: 서브도메인 (kadd.eregi.co.kr)
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') return parts[0];

        return null;
    };

    const targetId = getSocietyId();

    const fetchConferences = useCallback(async () => {
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
                const dateA = a.dates.start && typeof a.dates.start === 'object' && 'toDate' in a.dates.start ? (a.dates.start as { toDate: () => Date }).toDate() : new Date(0);
                const dateB = b.dates.start && typeof b.dates.start === 'object' && 'toDate' in b.dates.start ? (b.dates.start as { toDate: () => Date }).toDate() : new Date(0);
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
    }, [targetId]);

    useEffect(() => {
        fetchConferences();
    }, [fetchConferences]);

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
        } catch (error) {
            console.error("Creation Failed:", error);
            toast.error(`Failed to create conference: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        navigate(`/admin/conf/${conf.id}`);
    };

    const formatDate = (ts: any) => {
        if (!ts) return 'TBD';
        return safeFormatDate(ts, 'ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const getStatusBadge = (status: string) => {
        switch (status.toUpperCase()) {
            case 'OPEN': return <Badge className="bg-emerald-500 hover:bg-emerald-600 shadow text-white border-0">OPEN</Badge>;
            case 'PLANNING': return <Badge className="bg-blue-500 hover:bg-blue-600 shadow text-white border-0">PLANNING</Badge>;
            case 'CLOSED': return <Badge variant="secondary" className="bg-slate-200 text-slate-500 hover:bg-slate-300">CLOSED</Badge>;
            case 'SETUP': return <Badge className="bg-amber-400 hover:bg-amber-500 shadow text-white border-0">SETUP</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (!targetId) return <div className="h-screen flex items-center justify-center font-semibold text-slate-400">Access Restricted: Invalid Society Domain</div>;

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Top Navigation */}
            <div className="bg-white border-b sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-md">
                            <Layout size={18} />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900 leading-tight">Society Dashboard</h1>
                            <p className="text-[11px] text-slate-500 font-medium">Overview for <span className="text-blue-600 uppercase">{targetId}</span></p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6 space-y-8">
                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard label="Total Members" value={stats.totalMembers} icon={<Users className="text-blue-600" />} subtext="Registered Users" />
                    <StatCard label="Active Events" value={stats.activeConfs} icon={<Activity className="text-emerald-600" />} subtext="Currently Live" />
                    <StatCard label="Total Events" value={stats.totalConfs} icon={<BarChart3 className="text-purple-600" />} subtext="Historical Data" />
                </div>

                {/* Conferences Section */}
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">Events Management</h2>
                            <p className="text-sm text-slate-500">Manage your conferences and academic meetings.</p>
                        </div>

                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg rounded-xl h-11 px-6">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create New Event
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[600px] rounded-2xl p-0 overflow-hidden gap-0">
                                <DialogHeader className="p-6 bg-slate-50 border-b">
                                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-blue-600" />
                                        Launch New Conference
                                    </DialogTitle>
                                    <DialogDescription>
                                        Create a new event space. This will generate a dedicated URL and admin panel.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="p-6 space-y-6">
                                    {/* Titles */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-semibold uppercase text-slate-500">Event Title (Korean)</Label>
                                            <Input
                                                placeholder="제00회 춘계학술대회"
                                                value={newTitleKo}
                                                onChange={e => setNewTitleKo(e.target.value)}
                                                className="bg-slate-50 focus:bg-white transition-colors"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-semibold uppercase text-slate-500">Event Title (English)</Label>
                                            <Input
                                                placeholder="The 00th Annual Meeting..."
                                                value={newTitleEn}
                                                onChange={e => setNewTitleEn(e.target.value)}
                                                className="bg-slate-50 focus:bg-white transition-colors"
                                            />
                                        </div>
                                    </div>

                                    {/* URL Slug */}
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold uppercase text-slate-500">URL Identifier (Slug)</Label>
                                        <div className="relative flex items-center">
                                            <div className="absolute left-3 text-slate-400 text-sm font-mono flex items-center gap-1">
                                                <Globe size={14} /> /{targetId}/
                                            </div>
                                            <Input
                                                placeholder="2026spring"
                                                value={newSlug}
                                                onChange={e => setNewSlug(e.target.value)}
                                                className="pl-24 font-mono text-blue-600 font-bold bg-blue-50/30 border-blue-200 focus:border-blue-500"
                                            />
                                        </div>
                                        <p className="text-[11px] text-slate-400">
                                            Full URL: https://{targetId}.eregi.co.kr/{newSlug || 'slug'}
                                        </p>
                                    </div>

                                    {/* Dates */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-semibold uppercase text-slate-500">Start Date</Label>
                                            <Input
                                                type="date"
                                                value={newStart}
                                                onChange={e => setNewStart(e.target.value)}
                                                className="bg-slate-50"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-semibold uppercase text-slate-500">End Date</Label>
                                            <Input
                                                type="date"
                                                value={newEnd}
                                                onChange={e => setNewEnd(e.target.value)}
                                                className="bg-slate-50"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter className="p-4 bg-slate-50 border-t gap-2 md:gap-0">
                                    <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                                    <Button onClick={handleCreate} disabled={isCreating} className="bg-blue-600 hover:bg-blue-700 min-w-[120px]">
                                        {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Event'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                            <p className="text-slate-500 font-medium">Loading events...</p>
                        </div>
                    ) : conferences.length === 0 ? (
                        <Card className="border-dashed border-2 shadow-none bg-slate-50/50">
                            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                                    <Calendar className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900">No events found</h3>
                                <p className="text-slate-500 max-w-sm mt-2 mb-6">
                                    Get started by creating your first conference or academic meeting event.
                                </p>
                                <Button onClick={() => setIsCreateOpen(true)} className="bg-slate-900">
                                    Create First Event
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {conferences.map((conf) => (
                                <Card key={conf.id} className="group overflow-hidden rounded-2xl hover:shadow-xl transition-all duration-300 border-slate-200">
                                    <CardHeader className="relative p-5 pb-0">
                                        <div className="flex justify-between items-start mb-3">
                                            {getStatusBadge(conf.status)}
                                            <Badge variant="outline" className="font-mono text-xs bg-slate-50 text-slate-500 border-slate-200">
                                                /{conf.slug}
                                            </Badge>
                                        </div>
                                        <CardTitle className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 h-14">
                                            {safeText(conf.title)}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 space-y-4">
                                        <div className="space-y-2.5">
                                            <div className="flex items-center gap-3 text-sm text-slate-600">
                                                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                                                <span className="truncate">{formatDate(conf.dates.start)} - {formatDate(conf.dates.end)}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-slate-600">
                                                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                                                <span className="truncate">{safeText(conf.venue?.name) || 'Venue TBD'}</span>
                                            </div>
                                        </div>

                                        <div className="pt-2">
                                            <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block">Current Status</Label>
                                            <div className="relative">
                                                <select
                                                    className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer hover:bg-white"
                                                    value={conf.status}
                                                    onChange={(e) => handleStatusChange(conf.id, e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <option value="SETUP">Setup Mode (Hidden)</option>
                                                    <option value="PLANNING">Planning (Coming Soon)</option>
                                                    <option value="OPEN">Open (Registration Active)</option>
                                                    <option value="CLOSED">Closed (Ended)</option>
                                                </select>
                                                <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="p-4 bg-slate-50 border-t grid grid-cols-2 gap-3">
                                        <Button
                                            variant="ghost"
                                            className="w-full text-slate-500 hover:text-blue-600 hover:bg-blue-50 h-10 text-xs font-semibold"
                                            onClick={() => {
                                                const url = window.location.origin.includes('localhost')
                                                    ? `/${conf.slug}`
                                                    : `https://${targetId}.eregi.co.kr/${conf.slug}`;
                                                window.open(url, '_blank');
                                            }}
                                        >
                                            <ExternalLink className="w-3.5 h-3.5 mr-2" />
                                            Visit Live
                                        </Button>
                                        <Button
                                            className="w-full bg-white border border-slate-200 text-slate-900 hover:bg-blue-600 hover:text-white hover:border-blue-600 hover:shadow-md transition-all h-10 text-xs font-bold shadow-sm"
                                            onClick={() => handleManage(conf)}
                                        >
                                            Manage
                                            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                                        </Button>
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

function StatCard({ label, value, icon, subtext }: { label: string; value: string | number; icon: React.ReactNode; subtext: string }) {
    return (
        <Card className="border shadow-sm hover:shadow-md transition-all rounded-xl overflow-hidden">
            <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-slate-50 rounded-xl">
                        {icon}
                    </div>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-500 font-normal">
                        {subtext}
                    </Badge>
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-500">{label}</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}
