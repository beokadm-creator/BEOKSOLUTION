import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Store, Plus, Edit, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useSuperAdminVendors } from '../hooks/useSuperAdminVendors';

export const VendorsTab: React.FC = () => {
    const {
        vendors,
        loadingVendors,
        vendorRequests,
        loadingVendorRequests,
        fetchVendors,
        fetchVendorRequests,
        handleCreateVendor,
        handleUpdateVendor,
        handleDeleteVendor,
        handleApproveVendorRequest,
        handleRejectVendorRequest,
        vendorSlugify
    } = useSuperAdminVendors();

    const [newVendorName, setNewVendorName] = useState('');
    const [newVendorDesc, setNewVendorDesc] = useState('');
    const [newVendorEmail, setNewVendorEmail] = useState('');
    const [newVendorSlug, setNewVendorSlug] = useState('');
    
    const [editingVendor, setEditingVendor] = useState<{ id: string; name: string; slug?: string; description?: string; logoUrl?: string; adminEmail?: string } | null>(null);
    const [editVendorName, setEditVendorName] = useState('');
    const [editVendorDesc, setEditVendorDesc] = useState('');
    const [editVendorEmail, setEditVendorEmail] = useState('');
    const [editVendorSlug, setEditVendorSlug] = useState('');

    useEffect(() => {
        fetchVendors();
        fetchVendorRequests();
    }, [fetchVendors, fetchVendorRequests]);

    const onCreate = (e: React.FormEvent) => {
        e.preventDefault();
        handleCreateVendor(newVendorName, newVendorSlug, newVendorDesc, newVendorEmail, () => {
            setNewVendorName('');
            setNewVendorDesc('');
            setNewVendorEmail('');
            setNewVendorSlug('');
        });
    };

    const onUpdate = (id: string) => {
        handleUpdateVendor(id, editVendorName, editVendorSlug, editVendorDesc, editVendorEmail, () => {
            setEditingVendor(null);
        });
    };

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-t-4 border-t-indigo-500">
                <CardHeader className="pb-4">
                    <CardTitle className="text-xl flex items-center gap-2">
                        <Store className="w-5 h-5 text-indigo-500" /> Register Global Vendor
                    </CardTitle>
                    <CardDescription>Add new independent vendors to the platform</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <form onSubmit={onCreate} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-gray-400 uppercase">Vendor Name</Label>
                                <Input required value={newVendorName} onChange={e => setNewVendorName(e.target.value)} className="bg-[#2a2a2a] border-[#333] focus:border-indigo-500 text-gray-200" placeholder="e.g. ABC IT Solutions" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-gray-400 uppercase">Slug (Optional)</Label>
                                <Input value={newVendorSlug} onChange={e => setNewVendorSlug(e.target.value)} className="bg-[#2a2a2a] border-[#333] focus:border-indigo-500 text-gray-200" placeholder="e.g. shinhung" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-gray-400 uppercase">Admin Email (Optional)</Label>
                                <Input type="email" value={newVendorEmail} onChange={e => setNewVendorEmail(e.target.value)} className="bg-[#2a2a2a] border-[#333] focus:border-indigo-500 text-gray-200" placeholder="admin@vendor.com" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-gray-400 uppercase">Description (Optional)</Label>
                                <Input value={newVendorDesc} onChange={e => setNewVendorDesc(e.target.value)} className="bg-[#2a2a2a] border-[#333] focus:border-indigo-500 text-gray-200" placeholder="Brief description..." />
                            </div>
                        </div>
                        <Button type="submit" disabled={!newVendorName.trim()} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                            <Plus className="w-4 h-4 mr-2" /> Register Vendor
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>Existing Global Vendors</CardTitle>
                    <CardDescription>Manage platform-wide vendors</CardDescription>
                </CardHeader>
                <CardContent>
                    {loadingVendors ? (
                        <div className="py-12 flex justify-center"><LoadingSpinner /></div>
                    ) : (
                        <div className="space-y-2">
                            {vendors.map(v => (
                                <div key={v.id} className="flex items-center justify-between p-4 bg-[#2a2a2a] rounded-lg border border-[#333]">
                                    <div className="flex-1">
                                        <div className="font-semibold text-gray-200">{v.name}</div>
                                        <div className="text-xs text-gray-400">
                                            {v.description || 'No description'}
                                            {v.adminEmail ? ` • Admin: ${v.adminEmail}` : ' • No Admin Email'}
                                            • Slug: <span className="font-mono">{v.slug || vendorSlugify(v.name)}</span>
                                            • ID: <span className="font-mono">{v.id}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" onClick={() => {
                                            setEditingVendor(v);
                                            setEditVendorName(v.name);
                                            setEditVendorDesc(v.description || '');
                                            setEditVendorEmail(v.adminEmail || '');
                                            setEditVendorSlug(v.slug || vendorSlugify(v.name));
                                        }}>
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-500" onClick={() => handleDeleteVendor(v.id, v.name)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            {vendors.length === 0 && (
                                <div className="text-center py-12 text-gray-400">
                                    <Store className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                    <p>No vendors registered yet.</p>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {editingVendor && (
                <Card className="shadow-lg border-t-4 border-t-blue-600">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Edit className="w-5 h-5 text-blue-600" /> Edit Vendor Info
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-gray-400 uppercase">Vendor Name</Label>
                                <Input value={editVendorName} onChange={e => setEditVendorName(e.target.value)} className="bg-white" placeholder="Name" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-gray-400 uppercase">Admin Email</Label>
                                <Input type="email" value={editVendorEmail} onChange={e => setEditVendorEmail(e.target.value)} className="bg-white" placeholder="admin@vendor.com" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-gray-400 uppercase">Slug</Label>
                                <Input value={editVendorSlug} onChange={e => setEditVendorSlug(e.target.value)} className="bg-white" placeholder="vendor-slug" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-gray-400 uppercase">Description</Label>
                                <Input value={editVendorDesc} onChange={e => setEditVendorDesc(e.target.value)} className="bg-white" placeholder="Description" />
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={() => onUpdate(editingVendor.id)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex-1">
                                    <Save className="w-4 h-4 mr-2" /> Save Changes
                                </Button>
                                <Button onClick={() => setEditingVendor(null)} variant="outline">
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className="shadow-lg border-t-4 border-t-emerald-600">
                <CardHeader>
                    <CardTitle>Vendor Sponsorship Requests</CardTitle>
                    <CardDescription>Review and approve vendor requests to join conferences</CardDescription>
                </CardHeader>
                <CardContent>
                    {loadingVendorRequests ? (
                        <div className="py-12 flex justify-center"><LoadingSpinner /></div>
                    ) : (
                        <div className="space-y-2">
                            {vendorRequests.length === 0 && (
                                <div className="text-center py-8 text-gray-400">
                                    <p>No pending requests.</p>
                                </div>
                            )}
                            {vendorRequests.filter(req => req.status === 'PENDING').map(req => (
                                <div key={`${req.conferenceId}_${req.vendorId}`} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 bg-[#2a2a2a] rounded-lg border border-[#333]">
                                    <div className="flex-1 text-sm text-gray-300">
                                        <div className="font-semibold text-gray-100">{req.vendorName || req.vendorId}</div>
                                        <div className="text-xs text-gray-400">
                                            Conf: <span className="font-mono">{req.conferenceId}</span>
                                            {req.requesterEmail ? ` · ${req.requesterEmail}` : ''}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                            onClick={() => handleApproveVendorRequest({ vendorId: req.vendorId, conferenceId: req.conferenceId })}
                                        >
                                            Approve
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleRejectVendorRequest({ vendorId: req.vendorId, conferenceId: req.conferenceId })}
                                        >
                                            Reject
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
