import React, { useState, useCallback, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../../firebase';
import toast from 'react-hot-toast';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../ui/card';
import { Users, Filter, Trash2, Search } from 'lucide-react';
import { Badge } from '../../ui/badge';
import LoadingSpinner from '../../common/LoadingSpinner';
import { useSuperAdmin } from '../../../hooks/useSuperAdmin';

export const MembersTab: React.FC = () => {
    const { societies } = useSuperAdmin();
    const [currentSocietyId, setCurrentSocietyId] = useState<string>('');
    const [members, setMembers] = useState<Array<{ id: string; name?: string; email?: string; phone?: string; organization?: string; affiliation?: string; marketingAgreed?: boolean; infoAgreed?: boolean; createdAt?: { seconds: number } }>>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);

    useEffect(() => {
        if (!currentSocietyId && societies.length > 0) {
            setCurrentSocietyId(societies[0].id);
        }
    }, [societies, currentSocietyId]);

    const fetchMembers = useCallback(async () => {
        if (!currentSocietyId) return;
        setLoadingMembers(true);
        try {
            const usersRef = collection(db, 'users');
            const userSnap = await getDocs(usersRef);

            const membersList: typeof members = [];
            userSnap.docs.forEach(userDoc => {
                const userData = userDoc.data() as typeof members[0];
                membersList.push({
                    id: userDoc.id,
                    ...userData
                });
            });
            setMembers(membersList);
        } catch (e) {
            console.error('[MembersTab] fetchMembers error:', e);
            toast.error("Failed to fetch members");
        } finally {
            setLoadingMembers(false);
        }
    }, [currentSocietyId]);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

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

    return (
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
                                            <td colSpan={7} className="py-12 text-center">
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
    );
};
