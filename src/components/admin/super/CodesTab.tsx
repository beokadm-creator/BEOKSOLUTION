import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import toast from 'react-hot-toast';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../ui/card';
import { Key, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import LoadingSpinner from '../../common/LoadingSpinner';
import { useSuperAdmin } from '../../../hooks/useSuperAdmin';

export interface VerificationCode {
    id: string;
    societyId: string;
    name: string;
    code: string;
    used: boolean;
    usedBy?: string;
    usedAt?: Timestamp;
    expiryDate?: Timestamp;
    createdAt?: Timestamp;
}

export const CodesTab: React.FC = () => {
    const { societies } = useSuperAdmin();
    const [currentSocietyId, setCurrentSocietyId] = useState<string>('');
    const [codes, setCodes] = useState<VerificationCode[]>([]);
    const [loadingCodes, setLoadingCodes] = useState(false);

    const [newCodeName, setNewCodeName] = useState('');
    const [newCodeValue, setNewCodeValue] = useState('');
    const [newCodeSocId, setNewCodeSocId] = useState('');
    const [newCodeExpiry, setNewCodeExpiry] = useState('');

    useEffect(() => {
        if (!currentSocietyId && societies.length > 0) {
            setCurrentSocietyId(societies[0].id);
        }
    }, [societies, currentSocietyId]);

    useEffect(() => {
        const fetchCodes = async () => {
            if (!currentSocietyId) return;
            setLoadingCodes(true);
            try {
                const codeRef = collection(db, 'societies', currentSocietyId, 'verification_codes');
                const snap = await getDocs(codeRef);
                setCodes(snap.docs.map(d => ({ id: d.id, ...d.data() } as VerificationCode)));
            } catch (e) {
                console.error("Fetch Codes Error:", e);
            } finally {
                setLoadingCodes(false);
            }
        };
        fetchCodes();
    }, [currentSocietyId]);

    const handleCreateCode = async () => {
        if (!newCodeSocId || !newCodeName || !newCodeValue) return toast.error("필수 항목 누락");

        const toastId = toast.loading("Creating code...");
        try {
            const codeRef = collection(db, 'societies', newCodeSocId, 'verification_codes');
            await addDoc(codeRef, {
                name: newCodeName,
                code: newCodeValue,
                used: false,
                expiryDate: newCodeExpiry ? Timestamp.fromDate(new Date(newCodeExpiry)) : null,
                createdAt: Timestamp.now()
            });
            toast.success("Code added.", { id: toastId });
            setNewCodeName('');
            setNewCodeValue('');
            setNewCodeExpiry('');
            if (currentSocietyId === newCodeSocId) {
                // Trigger refresh by updating state slightly or rely on parent logic?
                // Just fetch codes again:
                const snap = await getDocs(collection(db, 'societies', currentSocietyId, 'verification_codes'));
                setCodes(snap.docs.map(d => ({ id: d.id, ...d.data() } as VerificationCode)));
            }
        } catch (e) {
            console.error("Create Code Error:", e);
            toast.error(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`, { id: toastId });
        }
    };

    const handleResetCodes = async () => {
        if (!currentSocietyId) return;
        if (!confirm("Delete all codes for this society?")) return;

        const toastId = toast.loading("Deleting codes...");
        try {
            const codeRef = collection(db, 'societies', currentSocietyId, 'verification_codes');
            const snap = await getDocs(codeRef);
            await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
            toast.success("All codes deleted.", { id: toastId });
            setCodes([]);
        } catch (e) {
            console.error("Reset Codes Error:", e);
            toast.error(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`, { id: toastId });
        }
    };

    return (
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

                    <div className="mb-4">
                        <Label className="text-xs font-semibold text-slate-500 uppercase mr-2">View Codes For:</Label>
                        <select
                            className="p-2 bg-white border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500"
                            value={currentSocietyId}
                            onChange={e => setCurrentSocietyId(e.target.value)}
                        >
                            <option value="">Select Society...</option>
                            {societies.map((s) => <option key={s.id} value={s.id}>{s.name.ko}</option>)}
                        </select>
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
                                                {c.expiryDate ? (('seconds' in c.expiryDate) ? new Date(c.expiryDate.seconds * 1000).toLocaleDateString() : new Date(c.expiryDate as unknown as string).toLocaleDateString()) : <span className="text-slate-300">No Expiry</span>}
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
                                                ) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                    {codes.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-slate-400">
                                                <Key className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                                <p>No verification codes found.</p>
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
    );
};
