import { useState, useCallback, useEffect } from 'react';
import { useSuperAdmin } from '../../hooks/useSuperAdmin';
import { useMonitoringData } from '../../hooks/useMonitoringData';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../components/ui/card';
import { LogOut, Plus, Building2, Calendar, Edit, Save, Users, Settings, Trash2, Key, ShieldCheck, Search, Filter, Activity, CheckCircle2, Store } from 'lucide-react';
import { auth, functions } from '../../firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, updateDoc, getDocs, collection, getDoc, setDoc, deleteDoc, addDoc, query, where, limit, collectionGroup, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';

import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';

const SuperAdminPage: React.FC = () => {
    const { societies, createSociety, createConference, refreshSocieties, loading } = useSuperAdmin();
    const [activeTab, setActiveTab] = useState<'SOCIETY' | 'CONFERENCE' | 'MEMBERS' | 'CODES' | 'SETTINGS' | 'MONITORING' | 'VENDORS'>('SOCIETY');

    const [socNameKo, setSocNameKo] = useState('');
    const [socNameEn, setSocNameEn] = useState('');
    const [socAdmin, setSocAdmin] = useState('');
    const [socDomainCode, setSocDomainCode] = useState('');

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

    const [editingSoc, setEditingSoc] = useState<{ id: string; name: { ko: string; en?: string }; description?: { ko?: string }; homepageUrl?: string; adminEmails?: string[]; domainCode?: string; aliases?: string[] } | null>(null);
    const [editDescKo, setEditDescKo] = useState('');
    const [editHomepage, setEditHomepage] = useState('');
    const [editDomainCode, setEditDomainCode] = useState('');
    const [editAliases, setEditAliases] = useState('');
    const [deletingSocietyId, setDeletingSocietyId] = useState<string | null>(null);

    // Vendors State
    const [vendors, setVendors] = useState<Array<{ id: string; name: string; slug?: string; description?: string; logoUrl?: string; adminEmail?: string }>>([]);
    const [loadingVendors, setLoadingVendors] = useState(false);
    const [newVendorName, setNewVendorName] = useState('');
    const [newVendorDesc, setNewVendorDesc] = useState('');
    const [newVendorEmail, setNewVendorEmail] = useState('');
    const [newVendorSlug, setNewVendorSlug] = useState('');
    const [editingVendor, setEditingVendor] = useState<{ id: string; name: string; slug?: string; description?: string; logoUrl?: string; adminEmail?: string } | null>(null);
    const [editVendorName, setEditVendorName] = useState('');
    const [editVendorDesc, setEditVendorDesc] = useState('');
    const [editVendorEmail, setEditVendorEmail] = useState('');
    const [editVendorSlug, setEditVendorSlug] = useState('');
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

    // Monitoring state
    const today = new Date().toISOString().split('T')[0];
    const [monitoringDate, setMonitoringDate] = useState(today);
    const { errorLogs, performanceMetrics, dataIntegrityAlerts, loading: monitoringLoading, refetch: refetchMonitoring } = useMonitoringData(monitoringDate);
    const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);

    // Health Check state
    const [healthCheckData, setHealthCheckData] = useState<unknown>(null);
    const [healthCheckLoading, setHealthCheckLoading] = useState(false);

    // AlimTalk Config Check state
    const [alimTalkConfigData, setAlimTalkConfigData] = useState<unknown>(null);
    const [alimTalkConfigLoading, setAlimTalkConfigLoading] = useState(false);
    const [selectedSocietyForAlimTalk, setSelectedSocietyForAlimTalk] = useState<string>('');


    // Resolve data integrity alert
    const resolveAlert = async (alertId: string, alertPath: string) => {
        setResolvingAlertId(alertId);
        try {
            const resolveAlertFunction = httpsCallable(functions, 'resolveDataIntegrityAlert');

            await resolveAlertFunction({ alertPath });
            toast.success('알림이 해결되었습니다');
            refetchMonitoring(); // Refresh monitoring data
        } catch (error: unknown) {
            console.error('[resolveAlert] Failed:', error);
            toast.error('알림 해결 실패: ' + error.message);
        } finally {
            setResolvingAlertId(null);
        }
    };

    // Health Check
    const fetchHealthCheck = async () => {
        setHealthCheckLoading(true);
        try {
            const response = await fetch('https://us-central1-eregi-8fc1e.cloudfunctions.net/healthCheck');
            const data = await response.json();
            setHealthCheckData(data);
            if (data.status === 'healthy') {
                toast.success('시스템 정상');
            } else if (data.status === 'degraded') {
                toast('시스템 경고', { icon: '⚠️' });
            } else {
                toast.error('시스템 오류');
            }
        } catch (error: unknown) {
            console.error('[fetchHealthCheck] Failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            toast.error('헬스체크 실패: ' + errorMessage);
            setHealthCheckData({ status: 'unhealthy', error: errorMessage });
            console.error('[fetchHealthCheck] Failed:', error);
            toast.error('헬스체크 실패: ' + error.message);
            setHealthCheckData({ status: 'unhealthy', error: error.message });
        } finally {
            setHealthCheckLoading(false);
        }
    };

    // AlimTalk Config Check
    const fetchAlimTalkConfig = async (societyId: string) => {
        if (!societyId) {
            toast.error('학회를 선택하세요');
            return;
        }

        setAlimTalkConfigLoading(true);
        try {
            const response = await fetch(`https://us-central1-eregi-8fc1e.cloudfunctions.net/checkAlimTalkConfigHttp?societyId=${societyId}`);
            const data = await response.json();
            setAlimTalkConfigData(data);

            if (data.success) {
                toast.success('알림톡 설정 정상');
            } else {
                toast.error(`알림톡 설정 오류: ${data.errors?.join(', ')}`);
            }
        } catch (error: unknown) {
            console.error('[fetchAlimTalkConfig] Failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            toast.error('알림톡 설정 확인 실패: ' + errorMessage);
            setAlimTalkConfigData({ success: false, error: errorMessage });
        } finally {
            setAlimTalkConfigLoading(false);
        }
    };

    const fetchVendors = useCallback(async () => {
        setLoadingVendors(true);
        try {
            const snap = await getDocs(collection(db, 'vendors'));
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
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

    useEffect(() => {
        if (activeTab === 'VENDORS') {
            fetchVendors();
            fetchVendorRequests();
        }
    }, [activeTab, fetchVendors, fetchVendorRequests]);

    const vendorSlugify = (value: string) => {
        return value
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9가-힣]+/g, '-')
            .replace(/^-+|-+$/g, '');
    };

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
        if (!socNameEn) return toast.error("사회명 (영어) 필수");

        const toastId = toast.loading("Creating society...");
        const computedId = socNameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const societyId = (socDomainCode || computedId).toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
        if (!societyId) {
            toast.error("유효한 학회 도메인 코드(sid)를 입력하세요.", { id: toastId });
            return;
        }
        try {
            await createSociety(societyId, socNameKo, socNameEn, socAdmin);
            toast.success("Society created.", { id: toastId });
            setSocNameKo('');
            setSocNameEn('');
            setSocAdmin('');
            setSocDomainCode('');
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
                homepageUrl: editHomepage,
                domainCode: (editDomainCode || societyId).toLowerCase().trim(),
                aliases: Array.from(
                    new Set(
                        editAliases
                            .split(',')
                            .map((a) => a.trim().toLowerCase())
                            .filter(Boolean)
                    )
                )
            });
            toast.success("Updated.", { id: toastId });
            setEditingSoc(null);
            setEditDescKo('');
            setEditHomepage('');
            setEditDomainCode('');
            setEditAliases('');
            await refreshSocieties();
        } catch (e) {
            console.error("Update Society Error:", e);
            toast.error(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`, { id: toastId });
        }
    };

    const handleDeleteSociety = async (societyId: string, societyName: string) => {
        const safetyCode = `DELETE ${societyId}`;
        const confirmed = window.confirm(
            `"${societyName}" 학회를 삭제하시겠습니까?\n\n주의: 삭제 후 복구할 수 없습니다.\n연결 데이터가 없는 경우에만 삭제됩니다.`
        );
        if (!confirmed) return;
        const typed = window.prompt(`2차 확인: 아래 문구를 정확히 입력하세요.\n${safetyCode}`);
        if (typed !== safetyCode) {
            toast.error('2차 확인 문구가 일치하지 않아 삭제를 취소했습니다.');
            return;
        }

        setDeletingSocietyId(societyId);
        const toastId = toast.loading("학회 삭제 준비 중...");
        try {
            const societySnap = await getDoc(doc(db, 'societies', societyId));
            const societyData = societySnap.exists() ? societySnap.data() as { domainCode?: string } : {};
            const domainCode = (societyData.domainCode || societyId).toLowerCase();
            const societyKeys = Array.from(new Set([societyId, domainCode].filter(Boolean)));
            const confSnap = await getDocs(
                societyKeys.length === 1
                    ? query(collection(db, 'conferences'), where('societyId', '==', societyKeys[0]), limit(1))
                    : query(collection(db, 'conferences'), where('societyId', 'in', societyKeys.slice(0, 10)), limit(1))
            );
            if (!confSnap.empty) {
                toast.error('연결된 학술대회가 있어 삭제할 수 없습니다. 먼저 학술대회 정리 후 다시 시도하세요.', { id: toastId });
                return;
            }

            const codeSnap = await getDocs(collection(db, 'societies', societyId, 'verification_codes'));
            if (!codeSnap.empty) {
                await Promise.all(codeSnap.docs.map((d) => deleteDoc(d.ref)));
            }

            await deleteDoc(doc(db, 'societies', societyId));
            if (editingSoc?.id === societyId) {
                setEditingSoc(null);
            }
            await refreshSocieties();
            toast.success('학회가 삭제되었습니다.', { id: toastId });
        } catch (e) {
            console.error("Delete Society Error:", e);
            toast.error(`삭제 실패: ${e instanceof Error ? e.message : 'Unknown error'}`, { id: toastId });
        } finally {
            setDeletingSocietyId(null);
        }
    };

    const handleCreateConference = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSocId || !slug || !titleKo || !start || !end) return toast.error("필수 항목 누락");

        const toastId = toast.loading("Creating conference...");
        try {
            const selectedSoc = societies.find((s) => s.id === selectedSocId) as (typeof societies[number] & { domainCode?: string }) | undefined;
            const conferenceSocietyId = (selectedSoc?.domainCode || selectedSocId).toLowerCase();
            await createConference({
                societyId: conferenceSocietyId,
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
        <div className="min-h-screen bg-slate-100 text-slate-900 p-4 sm:p-6">
            <header className="mb-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-3xl font-bold text-[#fbbf24] tracking-wider">ROOT CONTROL</h1>
                        <Button variant="outline" className="border-slate-300 text-slate-600 hover:bg-slate-200 hover:text-slate-900" onClick={() => auth.signOut()}>
                            <LogOut className="w-5 h-5" />
                        </Button>
                    </div>
                    <nav className="bg-white rounded-xl p-2 flex gap-2 border border-slate-200 shadow-sm">
                        {[
                            { id: 'SOCIETY', label: 'Societies', icon: <Building2 className="w-4 h-4" /> },
                            { id: 'CONFERENCE', label: 'Conferences', icon: <Calendar className="w-4 h-4" /> },
                            { id: 'MEMBERS', label: 'Members', icon: <Users className="w-4 h-4" /> },
                            { id: 'CODES', label: 'Codes', icon: <Key className="w-4 h-4" /> },
                            { id: 'SETTINGS', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
                            { id: 'MONITORING', label: '모니터링', icon: <Activity className="w-4 h-4" /> },
                            { id: 'VENDORS', label: 'Vendors', icon: <Store className="w-4 h-4" /> }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as 'SOCIETY' | 'CONFERENCE' | 'MEMBERS' | 'CODES' | 'SETTINGS' | 'MONITORING' | 'VENDORS')}
                                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === tab.id ? 'bg-[#fbbf24] text-black' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'}`}
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
                                            <Label className="text-xs font-semibold text-slate-500 uppercase">사회명 (한글)</Label>
                                            <Input value={socNameKo} onChange={e => setSocNameKo(e.target.value)} className="bg-white border-slate-300 focus:border-[#fbbf24]" placeholder="예: 한국기계정보학회" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-slate-500 uppercase">사회명 (영어)</Label>
                                            <Input value={socNameEn} onChange={e => setSocNameEn(e.target.value)} className="bg-white border-slate-300 focus:border-[#fbbf24]" placeholder="Optional: Korea Association..." />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-slate-500 uppercase">관리자 이메일</Label>
                                            <Input type="email" value={socAdmin} onChange={e => setSocAdmin(e.target.value)} className="bg-white border-slate-300 focus:border-[#fbbf24]" placeholder="admin@society.org" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-slate-500 uppercase">학회 도메인 코드 (sid)</Label>
                                            <Input
                                                value={socDomainCode}
                                                onChange={e => setSocDomainCode(e.target.value.toLowerCase())}
                                                className="bg-white border-slate-300 focus:border-[#fbbf24]"
                                                placeholder="예: kaid"
                                            />
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
                                        <div key={s.id} className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
                                            <div className="flex-1">
                                                <div className="font-semibold text-slate-900">{s.name.ko}</div>
                                                <div className="text-xs text-slate-500">ID: {s.id} / Domain: {(s as { domainCode?: string }).domainCode || '-'}</div>
                                                <div className="text-xs text-slate-500">{s.adminEmails.join(', ')}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900" onClick={() => {
                                                    setEditingSoc({ id: s.id, name: s.name, description: s.description, homepageUrl: s.homepageUrl, adminEmails: s.adminEmails, domainCode: (s as { domainCode?: string }).domainCode, aliases: (s as { aliases?: string[] }).aliases });
                                                    setEditDescKo(s.name.ko);
                                                    setEditHomepage(s.homepageUrl || '');
                                                    setEditDomainCode(((s as { domainCode?: string }).domainCode || s.id).toLowerCase());
                                                    setEditAliases(((s as { aliases?: string[] }).aliases || []).join(', '));
                                                }}>
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-400 hover:text-red-300"
                                                    disabled={deletingSocietyId === s.id}
                                                    onClick={() => handleDeleteSociety(s.id, s.name.ko)}
                                                    title="Delete Society"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    {societies.length === 0 && (
                                        <div className="text-center py-12 text-slate-500">
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
                                            <Label className="text-xs font-semibold text-slate-500 uppercase">사회명</Label>
                                            <Input value={editDescKo} onChange={e => setEditDescKo(e.target.value)} className="bg-white" placeholder="사회명 입력" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-slate-500 uppercase">홈페이지 URL</Label>
                                            <Input value={editHomepage} onChange={e => setEditHomepage(e.target.value)} className="bg-white" placeholder="https://..." />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-slate-500 uppercase">Domain Code (sid)</Label>
                                            <Input value={editDomainCode} onChange={e => setEditDomainCode(e.target.value.toLowerCase())} className="bg-white" placeholder="예: kaid" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-slate-500 uppercase">Aliases (comma separated)</Label>
                                            <Input value={editAliases} onChange={e => setEditAliases(e.target.value)} className="bg-white" placeholder="예: kaid, k-a-i-d" />
                                        </div>
                                        <div className="flex gap-2">
                                            <Button onClick={() => handleUpdateSociety(editingSoc.id)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex-1">
                                                <Save className="w-4 h-4 mr-2" /> Save Changes
                                            </Button>
                                            <Button onClick={() => { setEditingSoc(null); setEditDomainCode(''); setEditAliases(''); }} variant="outline">
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
                                        <Label className="text-xs font-semibold text-slate-500 uppercase">Select Society</Label>
                                        <select
                                            className="w-full p-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:border-green-600"
                                            value={selectedSocId}
                                            onChange={e => setSelectedSocId(e.target.value)}
                                        >
                                            <option value="">Select Society...</option>
                                            {societies.map(s => <option key={s.id} value={s.id}>{s.name.ko}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-slate-500 uppercase">Conference Slug</Label>
                                            <Input value={slug} onChange={e => setSlug(e.target.value)} className="bg-white border-slate-300 focus:border-green-600" placeholder="e.g., 2026spring" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-slate-500 uppercase">Start Date</Label>
                                            <Input type="date" value={start} onChange={e => setStart(e.target.value)} className="bg-white border-slate-300 focus:border-green-600" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-slate-500 uppercase">Title (한국어)</Label>
                                            <Input value={titleKo} onChange={e => setTitleKo(e.target.value)} className="bg-white border-slate-300 focus:border-green-600" placeholder="예: 2026년 춘계학술대회" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-slate-500 uppercase">Title (English)</Label>
                                            <Input value={titleEn} onChange={e => setTitleEn(e.target.value)} className="bg-white border-slate-300 focus:border-green-600" placeholder="Optional: Spring Conference 2026" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-slate-500 uppercase">End Date</Label>
                                            <Input type="date" value={end} onChange={e => setEnd(e.target.value)} className="bg-white border-slate-300 focus:border-green-600" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-slate-500 uppercase">Location</Label>
                                            <Input value={location} onChange={e => setLocation(e.target.value)} className="bg-white border-slate-300 focus:border-green-600" placeholder="예: 서울 코엑스" />
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
                                {/* Health Check & AlimTalk Config Section */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Health Check Card */}
                                    <Card className="shadow-lg border-t-4 border-t-green-500 bg-[#1e1e1e] border-[#333]">
                                        <CardHeader className="pb-4">
                                            <CardTitle className="text-xl flex items-center gap-2 text-green-400">
                                                <Activity className="w-5 h-5" /> 시스템 헬스체크
                                            </CardTitle>
                                            <CardDescription className="text-gray-400">
                                                Firestore, 환경변수, Functions 상태 확인
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <Button
                                                onClick={fetchHealthCheck}
                                                disabled={healthCheckLoading}
                                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold"
                                            >
                                                {healthCheckLoading ? '확인 중...' : '헬스체크 실행'}
                                            </Button>

                                            {healthCheckData && (
                                                <div className="space-y-3">
                                                    <div className={`p-4 rounded-lg border-2 ${healthCheckData.status === 'healthy' ? 'bg-green-500/10 border-green-500' :
                                                        healthCheckData.status === 'degraded' ? 'bg-yellow-500/10 border-yellow-500' :
                                                            'bg-red-500/10 border-red-500'
                                                        }`}>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            {healthCheckData.status === 'healthy' ? <CheckCircle2 className="w-5 h-5 text-green-400" /> :
                                                                healthCheckData.status === 'degraded' ? <Activity className="w-5 h-5 text-yellow-400" /> :
                                                                    <XCircle className="w-5 h-5 text-red-400" />}
                                                            <span className="font-bold text-lg">
                                                                {healthCheckData.status === 'healthy' ? '정상' :
                                                                    healthCheckData.status === 'degraded' ? '경고' : '오류'}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-gray-400">
                                                            {healthCheckData.timestamp && new Date(healthCheckData.timestamp).toLocaleString('ko-KR')}
                                                        </div>
                                                    </div>

                                                    {healthCheckData.checks && (
                                                        <div className="space-y-2">
                                                            {Object.entries((healthCheckData as Record<string, unknown>).checks as Record<string, unknown>).map(([key, check]: [string, unknown]) => (
                                                                <div key={key} className="flex items-center justify-between p-3 bg-[#2a2a2a] rounded-lg">
                                                                    <div className="flex items-center gap-2">
                                                                        {check.status === 'pass' ? <CheckCircle2 className="w-4 h-4 text-green-400" /> :
                                                                            check.status === 'warn' ? <Activity className="w-4 h-4 text-yellow-400" /> :
                                                                                <XCircle className="w-4 h-4 text-red-400" />}
                                                                        <span className="text-sm font-medium text-gray-200">{key}</span>
                                                                    </div>
                                                                    <span className="text-xs text-gray-400">{check.message}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* AlimTalk Config Check Card */}
                                    <Card className="shadow-lg border-t-4 border-t-purple-500 bg-[#1e1e1e] border-[#333]">
                                        <CardHeader className="pb-4">
                                            <CardTitle className="text-xl flex items-center gap-2 text-purple-400">
                                                💬 알림톡 설정 확인
                                            </CardTitle>
                                            <CardDescription className="text-gray-400">
                                                템플릿, Aligo 설정, Infrastructure 확인
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="flex gap-2">
                                                <select
                                                    className="flex-1 p-3 bg-[#2a2a2a] border border-[#333] rounded-lg text-gray-200 focus:border-purple-600"
                                                    value={selectedSocietyForAlimTalk}
                                                    onChange={(e) => setSelectedSocietyForAlimTalk(e.target.value)}
                                                >
                                                    <option value="">학회 선택...</option>
                                                    {societies.map(s => <option key={s.id} value={s.id}>{s.name.ko}</option>)}
                                                </select>
                                                <Button
                                                    onClick={() => fetchAlimTalkConfig(selectedSocietyForAlimTalk)}
                                                    disabled={alimTalkConfigLoading || !selectedSocietyForAlimTalk}
                                                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
                                                >
                                                    {alimTalkConfigLoading ? '확인 중...' : '확인'}
                                                </Button>
                                            </div>

                                            {alimTalkConfigData && (
                                                <div className="space-y-3">
                                                    <div className={`p-4 rounded-lg border-2 ${alimTalkConfigData.success ? 'bg-green-500/10 border-green-500' : 'bg-red-500/10 border-red-500'
                                                        }`}>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            {alimTalkConfigData.success ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
                                                            <span className="font-bold text-lg">
                                                                {alimTalkConfigData.success ? '설정 정상' : '설정 오류'}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-gray-400">
                                                            {alimTalkConfigData.timestamp && new Date(alimTalkConfigData.timestamp).toLocaleString('ko-KR')}
                                                        </div>
                                                    </div>

                                                    {alimTalkConfigData.summary && (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="p-3 bg-[#2a2a2a] rounded-lg">
                                                                <div className="text-xs text-gray-400">총 템플릿</div>
                                                                <div className="text-2xl font-bold text-gray-200">{alimTalkConfigData.summary.totalTemplates}</div>
                                                            </div>
                                                            <div className="p-3 bg-[#2a2a2a] rounded-lg">
                                                                <div className="text-xs text-gray-400">활성 템플릿</div>
                                                                <div className="text-2xl font-bold text-green-400">{alimTalkConfigData.summary.activeTemplates}</div>
                                                            </div>
                                                            <div className="p-3 bg-[#2a2a2a] rounded-lg">
                                                                <div className="text-xs text-gray-400">승인된 템플릿</div>
                                                                <div className="text-2xl font-bold text-blue-400">{alimTalkConfigData.summary.approvedTemplates}</div>
                                                            </div>
                                                            <div className="p-3 bg-[#2a2a2a] rounded-lg">
                                                                <div className="text-xs text-gray-400">Aligo 설정</div>
                                                                <div className="text-2xl font-bold">
                                                                    {alimTalkConfigData.summary.hasAligoConfig ? '✅' : '❌'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {alimTalkConfigData.warnings && alimTalkConfigData.warnings.length > 0 && (
                                                        <div className="p-3 bg-yellow-500/10 border border-yellow-500 rounded-lg">
                                                            <div className="text-xs font-bold text-yellow-400 mb-1">경고</div>
                                                            {alimTalkConfigData.warnings.map((warning: string, idx: number) => (
                                                                <div key={idx} className="text-xs text-gray-300">• {warning}</div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {alimTalkConfigData.errors && alimTalkConfigData.errors.length > 0 && (
                                                        <div className="p-3 bg-red-500/10 border border-red-500 rounded-lg">
                                                            <div className="text-xs font-bold text-red-400 mb-1">오류</div>
                                                            {alimTalkConfigData.errors.map((error: string, idx: number) => (
                                                                <div key={idx} className="text-xs text-gray-300">• {error}</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>

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
                                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${log.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
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
                                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${metric.value > 3000 ? 'bg-red-500/20 text-red-400' :
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
                                                            <th className="p-4">작업</th>
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
                                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${alert.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
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
                                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${alert.resolved ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                                                        }`}>
                                                                        {alert.resolved ? '해결됨' : '미해결'}
                                                                    </span>
                                                                </td>
                                                                <td className="p-4">
                                                                    {!alert.resolved && (
                                                                        <Button
                                                                            onClick={() => resolveAlert(alert.id, `${alert.timestamp.toDate().toISOString().split('T')[0]}/${alert.id}`)}
                                                                            disabled={resolvingAlertId === alert.id}
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="h-8 text-xs"
                                                                        >
                                                                            {resolvingAlertId === alert.id ? (
                                                                                <>
                                                                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                                                    처리 중...
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                                                                    해결
                                                                                </>
                                                                            )}
                                                                        </Button>
                                                                    )}
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

                {activeTab === 'VENDORS' && (
                    <div className="space-y-6">
                        <Card className="shadow-lg border-t-4 border-t-indigo-500">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <Store className="w-5 h-5 text-indigo-500" /> Register Global Vendor
                                </CardTitle>
                                <CardDescription>Add new independent vendors to the platform</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <form onSubmit={handleCreateVendor} className="space-y-4">
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
                                            <Button onClick={() => handleUpdateVendor(editingVendor.id)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex-1">
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
                )}
            </main>
        </div>
    );
};

export default SuperAdminPage;
