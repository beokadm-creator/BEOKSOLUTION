import { useState, useCallback } from 'react';
import { collection, getDocs, getDoc, setDoc, deleteDoc, addDoc, updateDoc, doc, query, where, collectionGroup, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/firebase';
import toast from 'react-hot-toast';

export const useSuperAdminVendors = () => {
    const [vendors, setVendors] = useState<Array<{ id: string; name: string; slug?: string; description?: string; logoUrl?: string; adminEmail?: string }>>([]);
    const [loadingVendors, setLoadingVendors] = useState(false);
    
    const [vendorRequests, setVendorRequests] = useState<Array<{
        id: string;
        vendorId: string;
        vendorName?: string;
        conferenceId: string;
        status: 'PENDING' | 'APPROVED' | 'REJECTED';
        requesterEmail?: string;
        requestedAt?: Timestamp;
    }>>([]);
    const [loadingVendorRequests, setLoadingVendorRequests] = useState(false);

    const fetchVendors = useCallback(async () => {
        setLoadingVendors(true);
        try {
            const snap = await getDocs(collection(db, 'vendors'));
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as { id: string; name: string; slug?: string; description?: string; logoUrl?: string; adminEmail?: string }[];
            setVendors(data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load vendors');
        } finally {
            setLoadingVendors(false);
        }
    }, []);

    const fetchVendorRequests = useCallback(async () => {
        setLoadingVendorRequests(true);
        try {
            const snap = await getDocs(collectionGroup(db, 'vendor_requests'));
            const data = snap.docs.map(d => {
                const parentConf = d.ref.parent.parent;
                return {
                    id: d.id,
                    conferenceId: (d.data().conferenceId as string) || parentConf?.id || '',
                    ...d.data()
                };
            }) as any[];
            setVendorRequests(data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load vendor requests');
        } finally {
            setLoadingVendorRequests(false);
        }
    }, []);

    const vendorSlugify = (value: string) => {
        return value
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9가-힣]+/g, '-')
            .replace(/^-+|-+$/g, '');
    };

    const handleCreateVendor = async (newVendorName: string, newVendorSlug: string, newVendorDesc: string, newVendorEmail: string, onSuccess: () => void) => {
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
            onSuccess();
            fetchVendors();
        } catch (error) {
            console.error(error);
            toast.error('Failed to create vendor');
        }
    };

    const handleUpdateVendor = async (id: string, editVendorName: string, editVendorSlug: string, editVendorDesc: string, editVendorEmail: string, onSuccess: () => void) => {
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
            onSuccess();
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

    const handleApproveVendorRequest = async (request: { vendorId: string; conferenceId: string }) => {
        try {
            const vendorSnap = await getDoc(doc(db, 'vendors', request.vendorId));
            if (!vendorSnap.exists()) {
                toast.error('Vendor not found.');
                return;
            }
            const vendorData = vendorSnap.data() as { name?: string; description?: string; logoUrl?: string; homeUrl?: string };

            await setDoc(doc(db, `conferences/${request.conferenceId}/sponsors/${request.vendorId}`), {
                name: vendorData.name || request.vendorId,
                logoUrl: vendorData.logoUrl || '',
                description: vendorData.description || '',
                websiteUrl: vendorData.homeUrl || '',
                isActive: true,
                vendorId: request.vendorId,
                isStampTourParticipant: false,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            }, { merge: true });

            await updateDoc(doc(db, `conferences/${request.conferenceId}/vendor_requests/${request.vendorId}`), {
                status: 'APPROVED',
                reviewedAt: Timestamp.now(),
                reviewedBy: auth.currentUser?.email || 'super_admin'
            });

            toast.success('Request approved and sponsor linked.');
            fetchVendorRequests();
        } catch (error) {
            console.error(error);
            toast.error('Failed to approve request');
        }
    };

    const handleRejectVendorRequest = async (request: { vendorId: string; conferenceId: string }) => {
        try {
            await updateDoc(doc(db, `conferences/${request.conferenceId}/vendor_requests/${request.vendorId}`), {
                status: 'REJECTED',
                reviewedAt: Timestamp.now(),
                reviewedBy: auth.currentUser?.email || 'super_admin'
            });
            toast.success('Request rejected.');
            fetchVendorRequests();
        } catch (error) {
            console.error(error);
            toast.error('Failed to reject request');
        }
    };

    return {
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
    };
};
