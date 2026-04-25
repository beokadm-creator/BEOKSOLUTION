import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, Timestamp, query, where, orderBy, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import toast from 'react-hot-toast';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../ui/card';
import { Store, Plus, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import LoadingSpinner from '../../common/LoadingSpinner';

export interface VendorData {
    id: string;
    name: string;
    slug?: string;
    description?: string;
    adminEmail?: string;
    logoUrl?: string;
    homeUrl?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export interface VendorRequest {
    id: string;
    vendorId: string;
    vendorName: string;
    conferenceId: string;
    status: 'pending' | 'approved' | 'rejected';
    requestedAt?: Timestamp;
    approvedAt?: Timestamp;
    rejectedAt?: Timestamp;
    approvedBy?: string;
    rejectedBy?: string;
}

export const VendorsTab: React.FC = () => {
    const [vendors, setVendors] = useState<VendorData[]>([]);
    const [loadingVendors, setLoadingVendors] = useState(false);
    const [vendorRequests, setVendorRequests] = useState<VendorRequest[]>([]);
    const [loadingVendorRequests, setLoadingVendorRequests] = useState(false);

    const [newVendorName, setNewVendorName] = useState('');
    const [newVendorDesc, setNewVendorDesc] = useState('');
    const [newVendorEmail, setNewVendorEmail] = useState('');
    const [newVendorSlug, setNewVendorSlug] = useState('');

    const [editingVendor, setEditingVendor] = useState<VendorData | null>(null);
    const [editVendorName, setEditVendorName] = useState('');
    const [editVendorDesc, setEditVendorDesc] = useState('');
    const [editVendorEmail, setEditVendorEmail] = useState('');
    const [editVendorSlug, setEditVendorSlug] = useState('');

    const vendorSlugify = (value: string) => {
        return value
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9가-힣]+/g, '-')
            .replace(/^-+|-+$/g, '');
    };

    const fetchVendors = useCallback(async () => {
        setLoadingVendors(true);
        try {
            const snap = await getDocs(collection(db, 'vendors'));
            setVendors(snap.docs.map(d => ({ id: d.id, ...d.data() } as VendorData)));
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingVendors(false);
        }
    }, []);

    const fetchVendorRequests = useCallback(async () => {
        setLoadingVendorRequests(true);
        try {
            const q = query(collection(db, 'vendor_requests'), where('status', '==', 'pending'), orderBy('requestedAt', 'desc'));
            const snap = await getDocs(q);
            setVendorRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as VendorRequest)));
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingVendorRequests(false);
        }
    }, []);

    useEffect(() => {
        fetchVendors();
        fetchVendorRequests();
    }, [fetchVendors, fetchVendorRequests]);

    const handleCreateVendor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newVendorName.trim()) return;
        const computedSlug = newVendorSlug.trim() || vendorSlugify(newVendorName);
        try {
            const existing = await getDocs(query(collection(db, 'vendors'), where('slug', '==', computedSlug)));
            if (!existing.empty) {
                toast.error('이미 사용 중인 슬러그입니다. 다른 슬러그를 입력해주세요.');
                return;
            }
            await addDoc(collection(db, 'vendors'), {
                name: newVendorName.trim(),
                slug: computedSlug,
                description: newVendorDesc.trim(),
                adminEmail: newVendorEmail.trim(),
                createdAt: new Date()
            });
            toast.success('Vendor created successfully');
            setNewVendorName('');
            setNewVendorDesc('');
            setNewVendorEmail('');
            setNewVendorSlug('');
            fetchVendors();
        } catch (error) {
            console.error(error);
            toast.error('Failed to create vendor');
        }
    };

    const handleUpdateVendor = async (id: string) => {
        if (!editVendorName.trim()) return;
        try {
            const computedSlug = editVendorSlug.trim() || vendorSlugify(editVendorName);
            const existing = await getDocs(query(collection(db, 'vendors'), where('slug', '==', computedSlug)));
            const conflict = existing.docs.find(d => d.id !== id);
            if (conflict) {
                toast.error('이미 사용 중인 슬러그입니다. 다른 슬러그를 입력해주세요.');
                return;
            }
            const updates: Record<string, unknown> = {
                name: editVendorName.trim(),
                slug: computedSlug,
                description: editVendorDesc.trim(),
                adminEmail: editVendorEmail.trim(),
                updatedAt: new Date()
            };
            await updateDoc(doc(db, 'vendors', id), updates);
            toast.success('Vendor updated');
            setEditingVendor(null);
            fetchVendors();
        } catch (error) {
            console.error(error);
            toast.error('Failed to update vendor');
        }
    };

    const handleDeleteVendor = async (id: string, name: string) => {
        if (!window.confirm(`Delete vendor "${name}"? This action cannot be undone.`)) return;
        try {
            await deleteDoc(doc(db, 'vendors', id));
            toast.success('Vendor deleted');
            fetchVendors();
        } catch (error) {
            console.error(error);
            toast.error('Failed to delete vendor');
        }
    };

    const handleApproveVendorRequest = async (request: VendorRequest) => {
        try {
            const vendorSnap = await getDoc(doc(db, 'vendors', request.vendorId));
            if (!vendorSnap.exists()) {
                toast.error('Vendor not found.');
                return;
            }
            const vendorData = vendorSnap.data() as VendorData;

            await setDoc(doc(db, `conferences/${request.conferenceId}/sponsors/${request.vendorId}`), {
                name: vendorData.name || request.vendorId,
                logoUrl: vendorData.logoUrl || '',
                description: vendorData.description || '',
                websiteUrl: vendorData.homeUrl || '',
                isActive: true,
                vendorId: request.vendorId,
                isStampTourParticipant: false,
                createdAt: Timestamp.now(),
            });

            await updateDoc(doc(db, 'vendor_requests', request.id), {
                status: 'approved',
                approvedAt: Timestamp.now(),
                approvedBy: 'super_admin'
            });

            toast.success('Vendor participation approved');
            fetchVendorRequests();
        } catch (e) {
            console.error(e);
            toast.error('Failed to approve vendor');
        }
    };

    const handleRejectVendorRequest = async (request: VendorRequest) => {
        if (!window.confirm('Reject this participation request?')) return;
        try {
            await updateDoc(doc(db, 'vendor_requests', request.id), {
                status: 'rejected',
                rejectedAt: Timestamp.now(),
                rejectedBy: 'super_admin'
            });
            toast.success('Vendor participation rejected');
            fetchVendorRequests();
        } catch (e) {
            console.error(e);
            toast.error('Failed to reject vendor');
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Vendor Requests Section */}
            <Card className="shadow-lg border-t-4 border-t-orange-500">
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2 text-orange-600">
                        <Store className="w-5 h-5" /> Pending Participation Requests
                    </CardTitle>
                    <CardDescription>Vendors requesting to join specific conferences</CardDescription>
                </CardHeader>
                <CardContent>
                    {loadingVendorRequests ? (
                        <div className="flex justify-center p-8"><LoadingSpinner /></div>
                    ) : vendorRequests.length > 0 ? (
                        <div className="space-y-3">
                            {vendorRequests.map(req => (
                                <div key={req.id} className="flex flex-col md:flex-row items-center justify-between p-4 bg-orange-50/50 border border-orange-100 rounded-lg gap-4">
                                    <div>
                                        <div className="font-bold text-slate-800">{req.vendorName}</div>
                                        <div className="text-sm text-slate-500">Requesting to join: <span className="font-mono text-orange-600">{req.conferenceId}</span></div>
                                        <div className="text-xs text-slate-400 mt-1">Requested: {req.requestedAt?.toDate().toLocaleString()}</div>
                                    </div>
                                    <div className="flex gap-2 w-full md:w-auto">
                                        <Button onClick={() => handleApproveVendorRequest(req)} className="flex-1 md:flex-none bg-green-600 hover:bg-green-700">
                                            <CheckCircle className="w-4 h-4 mr-2" /> Approve
                                        </Button>
                                        <Button onClick={() => handleRejectVendorRequest(req)} variant="destructive" className="flex-1 md:flex-none">
                                            <XCircle className="w-4 h-4 mr-2" /> Reject
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-500">
                            No pending requests.
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <Card className="shadow-lg border-t-4 border-t-blue-600">
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Plus className="w-5 h-5 text-blue-600" /> Register Vendor
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreateVendor} className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label>Vendor Name</Label>
                                    <Input value={newVendorName} onChange={e => setNewVendorName(e.target.value)} required placeholder="Company Name" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Slug (Opt)</Label>
                                    <Input value={newVendorSlug} onChange={e => setNewVendorSlug(e.target.value)} placeholder="Auto-generated if empty" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Admin Email</Label>
                                    <Input type="email" value={newVendorEmail} onChange={e => setNewVendorEmail(e.target.value)} placeholder="admin@vendor.com" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Description</Label>
                                    <Textarea value={newVendorDesc} onChange={e => setNewVendorDesc(e.target.value)} placeholder="Brief description" className="resize-none" />
                                </div>
                                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Register Vendor</Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-2">
                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle>Registered Vendors</CardTitle>
                            <CardDescription>Global list of registered vendors</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loadingVendors ? (
                                <div className="flex justify-center p-12"><LoadingSpinner /></div>
                            ) : (
                                <div className="space-y-3">
                                    {vendors.map(v => (
                                        <div key={v.id} className="p-4 border rounded-lg bg-white shadow-sm flex flex-col md:flex-row gap-4 justify-between items-start md:items-center hover:border-blue-200 transition-colors">
                                            {editingVendor?.id === v.id ? (
                                                <div className="w-full space-y-3">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <Input value={editVendorName} onChange={e => setEditVendorName(e.target.value)} placeholder="Name" />
                                                        <Input value={editVendorSlug} onChange={e => setEditVendorSlug(e.target.value)} placeholder="Slug" />
                                                    </div>
                                                    <Input value={editVendorEmail} onChange={e => setEditVendorEmail(e.target.value)} placeholder="Email" />
                                                    <Textarea value={editVendorDesc} onChange={e => setEditVendorDesc(e.target.value)} placeholder="Description" />
                                                    <div className="flex gap-2">
                                                        <Button onClick={() => handleUpdateVendor(v.id)} className="flex-1 bg-green-600 hover:bg-green-700">Save</Button>
                                                        <Button onClick={() => setEditingVendor(null)} variant="outline" className="flex-1">Cancel</Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex-1">
                                                        <div className="font-bold text-lg text-slate-800">{v.name}</div>
                                                        <div className="text-xs font-mono text-slate-500 mb-1">slug: {v.slug}</div>
                                                        <div className="text-sm text-slate-600 mb-2">{v.description || 'No description'}</div>
                                                        <div className="text-xs text-blue-600 bg-blue-50 inline-block px-2 py-1 rounded">{v.adminEmail || 'No email'}</div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button variant="ghost" size="sm" onClick={() => {
                                                            setEditingVendor(v);
                                                            setEditVendorName(v.name);
                                                            setEditVendorSlug(v.slug || '');
                                                            setEditVendorDesc(v.description || '');
                                                            setEditVendorEmail(v.adminEmail || '');
                                                        }}>
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => handleDeleteVendor(v.id, v.name)}>
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                    {vendors.length === 0 && (
                                        <div className="text-center py-12 text-slate-400">
                                            <Store className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p>No vendors registered yet.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
