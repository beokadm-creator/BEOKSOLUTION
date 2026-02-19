import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, addDoc, doc, deleteDoc, query, Timestamp, updateDoc, where, deleteField, writeBatch, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useSocietyGrades } from '../../hooks/useSocietyGrades';
import { useAdminStore } from '../../store/adminStore';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '../../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Badge } from '../../components/ui/badge';
import {
    Plus,
    Trash2,
    RefreshCw,
    Upload,
    Search,
    Settings,
    RotateCcw,
    FileSpreadsheet,
    UserPlus,
    ShieldCheck,
    Calendar,
    X,
    Filter,
    Edit,
    CheckSquare,
    Square
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';

interface Grade {
    id: string;
    name: string;
    code: string;
}

interface Member {
    id: string;
    societyId: string;
    name: string;
    code: string; // License Number or ID
    expiryDate: string; // YYYY-MM-DD
    grade: string; // Grade Code
    createdAt: Timestamp;
    used?: boolean;
    usedBy?: string;
    usedAt?: Timestamp;
}

const MemberManagerPage: React.FC = () => {
    const { selectedSocietyId } = useAdminStore();
    const [members, setMembers] = useState<Member[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Tab 2: Manual Add
    const [newName, setNewName] = useState('');
    const [newCode, setNewCode] = useState('');
    const [newExpiry, setNewExpiry] = useState('');
    const [newGrade, setNewGrade] = useState('');

    // Tab 3: Bulk Upload
    const [bulkData, setBulkData] = useState('');

    // Grade Settings State
    const [newGradeName, setNewGradeName] = useState('');
    const [newGradeCode, setNewGradeCode] = useState('');

    // Bulk Expiry Update State (NEW)
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
    const [bulkNewExpiry, setBulkNewExpiry] = useState('');
    const [selectAll, setSelectAll] = useState(false);

    // Edit Member State (NEW)
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [editForm, setEditForm] = useState({
        name: '',
        code: '',
        grade: '',
        expiryDate: ''
    });

    // Determine Society ID
    const getSocietyId = () => {
        if (selectedSocietyId) return selectedSocietyId;
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        // Handle subdomain format: kadd.localhost, kadd.eregi.co.kr
        if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') return parts[0];
        // Handle kadd.localhost format explicitly
        if (parts.length === 2 && parts[1] === 'localhost') return parts[0];
        if (hostname === 'localhost' || hostname === '127.0.0.1') return 'kap';
        return null;
    };

    const targetId = getSocietyId();
    const { getGradeLabel } = useSocietyGrades(targetId || undefined);

    const fetchGrades = useCallback(async () => {
        if (!targetId) return;
        try {
            const colRef = collection(db, 'societies', targetId, 'settings', 'grades', 'list');
            const snapshot = await getDocs(colRef);

            if (!snapshot.empty) {
                const list = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: data.code || doc.id,
                        name: typeof data.name === 'object' ? data.name.ko : data.name,
                        code: data.code || doc.id
                    };
                });
                setGrades(list);
                if (list.length > 0 && !newGrade) setNewGrade(list[0].code);
            } else {
                setGrades([]);
            }
        } catch (error) {
            console.error("Error fetching grades:", error);
        }
    }, [targetId, newGrade]);

    const fetchMembers = useCallback(async () => {
        if (!targetId) return;
        setLoading(true);
        try {
            // [Fix-Step 347] Realign Admin DB Paths to Sub-collection
            // Old: collection(db, 'members') with where clause
            // New: collection(db, 'societies', targetId, 'members')

            // INDEX ERROR FIX: Remove DB-level sorting to avoid composite index requirement
            const q = collection(db, 'societies', targetId, 'members');

            const snapshot = await getDocs(q);
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));

            // Client-side sorting (Newest first)
            list.sort((a, b) => {
                const timeA = a.createdAt?.seconds || 0;
                const timeB = b.createdAt?.seconds || 0;
                return timeB - timeA;
            });

            setMembers(list);
        } catch (error) {
            console.error("Error fetching members:", error);
            toast.error("회원 목록을 불러오는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    }, [targetId]);

    const handleAddGrade = async () => {
        if (!targetId) return;
        if (!newGradeName || !newGradeCode) {
            toast.error("등급 이름과 코드를 입력해주세요.");
            return;
        }
        try {
            const colRef = collection(db, 'societies', targetId, 'settings', 'grades', 'list');
            
            // Check for duplicate ID (which is the code)
            const docRef = doc(colRef, newGradeCode);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                toast.error("이미 존재하는 코드입니다.");
                return;
            }

            // Also check for duplicate code field just in case (legacy mixed data)
            const q = query(colRef, where('code', '==', newGradeCode));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                toast.error("이미 존재하는 코드입니다.");
                return;
            }

            const newGradeObj = {
                code: newGradeCode,
                name: { ko: newGradeName, en: newGradeCode }
            };

            // Use setDoc with the code as the document ID to maintain consistency with legacy format
            // and ensure the ID is readable (e.g., 'Member_LM' instead of random string)
            console.log(`[MemberManager] Creating grade with ID: ${newGradeCode}`);
            await setDoc(doc(colRef, newGradeCode), newGradeObj);

            toast.success(`등급이 추가되었습니다. (ID: ${newGradeCode})`);
            setNewGradeName('');
            setNewGradeCode('');
            fetchGrades();
        } catch (e) {
            console.error(e);
            toast.error("등급 추가 실패");
        }
    };

    const handleDeleteGrade = async (gradeCode: string) => {
        if (!targetId) return;
        if (!window.confirm("이 등급을 삭제하시겠습니까?")) return;
        try {
            const colRef = collection(db, 'societies', targetId, 'settings', 'grades', 'list');
            const q = query(colRef, where('code', '==', gradeCode));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                await deleteDoc(snapshot.docs[0].ref);
                toast.success("등급이 삭제되었습니다.");
                fetchGrades();
            }
        } catch (e) {
            console.error(e);
            toast.error("삭제 실패");
        }
    };

    const handleSingleAdd = async () => {
        if (!targetId) return;
        if (!newName || !newCode || !newExpiry || !newGrade) {
            toast.error("모든 필드를 입력해주세요.");
            return;
        }

        try {
            // [Fix-Step 347] Use subcollection path
            await addDoc(collection(db, 'societies', targetId, 'members'), {
                societyId: targetId,
                name: newName.replace(/\s+/g, ''), // [FIX] Remove all spaces from name
                code: newCode.replace(/\s+/g, ''), // [FIX] Remove all spaces from code
                expiryDate: newExpiry,
                grade: newGrade,
                used: false,
                createdAt: Timestamp.now()
            });
            toast.success("회원이 추가되었습니다.");
            setNewName('');
            setNewCode('');
            fetchMembers();
        } catch (error) {
            console.error("Error adding member:", error);
            toast.error("추가 실패");
        }
    };

    const handleBulkUpload = async () => {
        if (!bulkData.trim()) {
            toast.error('CSV 데이터가 비어 있습니다.');
            return;
        }
        
        if (!newGrade) {
            toast.error('등급을 선택해주세요.');
            return;
        }
        
        // CSV 파싱
        const lines = bulkData.trim().split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
            toast.error('CSV 파일이 비어 있습니다.');
            return;
        }
        
        const parsedData = [];
        const errors: string[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // 파이프(|)로 분리
            const parts = line.split('|');
            
            // 필드 수 검증 (NAME|CODE|GRADE|EXPIRY_DATE)
            if (parts.length !== 4) {
                errors.push(`줄 ${i+1}: 형식이 올바르지 않습니다. (NAME|CODE|GRADE|EXPIRY_DATE)`);
                continue;
            }
            
            const [name, code, grade, expiryDate] = parts;
            
            // 필수 필드 검증
            if (!name.trim() || !code.trim() || !grade.trim() || !expiryDate.trim()) {
                errors.push(`줄 ${i+1}: 필수 필드가 누락되어 있습니다.`);
                continue;
            }
            
            // 날짜 형식 검증
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(expiryDate.trim())) {
                errors.push(`줄 ${i+1}: 날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)`);
                continue;
            }

            parsedData.push({
                name: name.replace(/\s+/g, ''), // [FIX] Remove all spaces from name
                code: code.replace(/\s+/g, ''), // [FIX] Remove all spaces from code
                grade: grade.trim(),
                expiryDate: expiryDate.trim()
            });
        }
        
        if (errors.length > 0) {
            toast.error(`CSV 파싱 오류:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... 외 ${errors.length - 5}개 오류` : ''}`);
            return;
        }
        
        if (parsedData.length === 0) {
            toast.error('파싱된 데이터가 없습니다.');
            return;
        }
        
        try {
            // Firestore Batch 사용
            const batches: Promise<unknown>[] = [];
            let currentBatch = writeBatch(db);
            let batchCount = 0;
            
            for (const member of parsedData) {
                const newDocRef = doc(collection(db, `societies/${targetId}/members`));
                currentBatch.set(newDocRef, {
                    societyId: targetId,
                    name: member.name,
                    code: member.code,
                    grade: member.grade,
                    expiryDate: member.expiryDate,
                    used: false,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                });
                batchCount++;
                
                // Firestore batch 제한 (500개)
                if (batchCount >= 500) {
                    batches.push(currentBatch.commit());
                    currentBatch = writeBatch(db);
                    batchCount = 0;
                }
            }
            
            if (batchCount > 0) {
                batches.push(currentBatch.commit());
            }
            
            await Promise.all(batches);
            
            toast.success(`${parsedData.length}명의 회원이 업로드되었습니다.`);
            setBulkData('');
            fetchMembers();
        } catch (error) {
            console.error("CSV Upload error:", error);
            toast.error('업로드 실패');
        }
    };

    // [Fix-Step 257] Fix Delete Logic (Root Collection)
    const handleDelete = async (id: string) => {
        if (!targetId) return;
        if (!window.confirm("정말 삭제하시겠습니까? (This action cannot be undone)")) return;

        try {
            // [Fix-Step 347] Correct Path: doc(db, 'societies', targetId, 'members', id)
            await deleteDoc(doc(db, 'societies', targetId, 'members', id));
            toast.success("삭제되었습니다.");
            fetchMembers();
        } catch (error) {
            console.error("Error deleting member:", error);
            toast.error("삭제 실패");
        }
    };

    // [New] Reset Member Status
    const handleResetMember = async (id: string) => {
        if (!targetId) return;
        if (!window.confirm("이 회원의 '사용됨(Used)' 상태를 초기화하시겠습니까? 다시 등록에 사용할 수 있게 됩니다.")) return;

        try {
            const memberRef = doc(db, 'societies', targetId, 'members', id);
            await updateDoc(memberRef, {
                used: false,
                usedBy: deleteField(),
                usedAt: deleteField()
            });
            toast.success("회원 상태가 초기화되었습니다.");
            fetchMembers();
        } catch (error) {
            console.error("Error resetting member:", error);
            toast.error("초기화 실패");
        }
    };

    // Bulk Expiry Update Handlers (NEW)
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = members
                .filter(m => !m.used) // 사용 안 된 회원만 선택 가능
                .map(m => m.id);
            setSelectedMemberIds(new Set(allIds));
        } else {
            setSelectedMemberIds(new Set());
        }
        setSelectAll(checked);
    };

    const handleSelectMember = (memberId: string, checked: boolean) => {
        const newSelected = new Set(selectedMemberIds);
        if (checked) {
            newSelected.add(memberId);
        } else {
            newSelected.delete(memberId);
        }
        setSelectedMemberIds(newSelected);
    };

    const handleBulkExpiryUpdate = async () => {
        if (!targetId || !bulkNewExpiry || selectedMemberIds.size === 0) {
            toast.error('선택된 회원이 없거나 유효기간을 설정해주세요.');
            return;
        }

        // 날짜 형식 검증 (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(bulkNewExpiry)) {
            toast.error('날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요.');
            return;
        }

        try {
            const batch = writeBatch(db);
            let count = 0;

            selectedMemberIds.forEach(memberId => {
                const memberRef = doc(db, 'societies', targetId, 'members', memberId);
                batch.update(memberRef, {
                    expiryDate: bulkNewExpiry,
                    updatedAt: Timestamp.now()
                });
                count++;

                // Firestore batch 제한 (500개)
                if (count % 500 === 0) {
                    batch.commit();
                }
            });

            if (count > 0) {
                await batch.commit();
            }

            toast.success(`${selectedMemberIds.size}명의 회원 유효기간이 ${bulkNewExpiry}로 수정되었습니다.`);
            setSelectedMemberIds(new Set());
            setBulkNewExpiry('');
            setSelectAll(false);
            fetchMembers();
        } catch (error) {
            console.error("Bulk update error:", error);
            toast.error('대량 수정 실패');
        }
    };

    // Edit Member Handlers (NEW)
    const handleEditClick = (member: Member) => {
        if (!targetId) return;
        setEditingMember(member);
        setEditForm({
            name: member.name,
            code: member.code,
            grade: member.grade,
            expiryDate: member.expiryDate
        });
    };

    const handleEditSave = async () => {
        if (!targetId || !editingMember) return;

        try {
            const memberRef = doc(db, 'societies', targetId, 'members', editingMember.id);
            await updateDoc(memberRef, {
                name: editForm.name.replace(/\s+/g, ''), // [FIX] Remove all spaces from name
                code: editForm.code.replace(/\s+/g, ''), // [FIX] Remove all spaces from code
                grade: editForm.grade.trim(),
                expiryDate: editForm.expiryDate, // YYYY-MM-DD
                updatedAt: Timestamp.now()
            });

            toast.success('회원 정보가 수정되었습니다.');
            setEditingMember(null);
            setEditForm({
                name: '',
                code: '',
                grade: '',
                expiryDate: ''
            });
            fetchMembers();
        } catch (error) {
            console.error("Edit member error:", error);
            toast.error('수정 실패');
        }
    };

    useEffect(() => {
        if (targetId) {
            fetchGrades();
            fetchMembers();
        }
    }, [targetId, fetchGrades, fetchMembers]);

    // Filtering
    const filteredMembers = members.filter(m =>
        m.name.includes(searchTerm) || m.code.includes(searchTerm)
    );

    const isExpired = (dateStr: string) => {
        const today = new Date().toISOString().split('T')[0];
        return dateStr < today;
    };

    const getGradeName = (code: string) => {
        return getGradeLabel(code, 'ko');
    };

    if (!targetId) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4" />
            <p className="text-slate-500 font-medium">Resolving Society Context...</p>
        </div>
    );

    const availableCount = members.filter(m => !m.used && !isExpired(m.expiryDate)).length;

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-24 p-6">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50">Admin Console</Badge>
                        <span className="text-slate-300">|</span>
                        <span className="text-sm font-medium text-slate-500 uppercase tracking-wide">Member Management</span>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Society Members</h1>
                    <p className="text-slate-500 mt-2 font-medium">Manage member verification codes (Whitelist) and grades.</p>
                </div>
                <div className="flex gap-4">
                    <div className="text-right hidden md:block">
                        <p className="text-sm text-slate-400 font-medium uppercase">Total Members</p>
                        <p className="text-2xl font-bold text-slate-800">{members.length}</p>
                    </div>
                    <div className="w-px bg-slate-200 hidden md:block" />
                    <div className="text-right hidden md:block">
                        <p className="text-sm text-emerald-600 font-medium uppercase">Available</p>
                        <p className="text-2xl font-bold text-emerald-600">{availableCount}</p>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="list" className="w-full space-y-8">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-14 p-1.5 bg-slate-100/80 rounded-xl">
                    <TabsTrigger value="list" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                        Member List
                        <Badge variant="secondary" className="ml-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200">{members.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="add" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                        Add Single
                    </TabsTrigger>
                    <TabsTrigger value="bulk" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                        Bulk Upload
                    </TabsTrigger>
                    <TabsTrigger value="bulk-expiry" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                        Bulk Expiry Update
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                        Grade Settings
                    </TabsTrigger>
                </TabsList>

                {/* Tab 1: List */}
                <TabsContent value="list" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    <Card className="border-none shadow-lg shadow-slate-200/50 overflow-hidden bg-white rounded-2xl">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <div className="p-2 bg-white border border-slate-200 rounded-lg shadow-sm">
                                        <Filter className="w-4 h-4 text-slate-500" />
                                    </div>
                                    <div className="relative w-full md:w-80">
                                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                                        <Input
                                            placeholder="Search by name or code..."
                                            className="pl-9 pr-8 bg-white border-slate-200 focus:border-indigo-300 transition-colors"
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
                                        {searchTerm && (
                                            <button
                                                onClick={() => setSearchTerm('')}
                                                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <Button variant="outline" size="sm" onClick={fetchMembers} disabled={loading} className="w-full md:w-auto border-dashed hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50">
                                    <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                    Refresh List
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="border-t border-slate-100">
                                <Table>
                                    <TableHeader className="bg-slate-50/50">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="w-[60px] font-bold text-slate-600 pl-6">
                                                {selectAll ? <CheckSquare className="w-5 h-5 cursor-pointer" onClick={() => handleSelectAll(false)} /> : <Square className="w-5 h-5 cursor-pointer" onClick={() => handleSelectAll(true)} />}
                                            </TableHead>
                                            <TableHead className="w-[180px] font-bold text-slate-600 pl-6">Name</TableHead>
                                            <TableHead className="font-bold text-slate-600">Verification Code</TableHead>
                                            <TableHead className="font-bold text-slate-600">Grade</TableHead>
                                            <TableHead className="font-bold text-slate-600">Expiry</TableHead>
                                            <TableHead className="font-bold text-slate-600">Status</TableHead>
                                            <TableHead className="font-bold text-slate-600">Used By</TableHead>
                                            <TableHead className="font-bold text-slate-600">Used At</TableHead>
                                            <TableHead className="text-right font-bold text-slate-600 pr-6">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredMembers.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center h-64 text-slate-400">
                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                        <Search className="w-8 h-8 opacity-20" />
                                                        <p>No members found matching your criteria.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredMembers.map((member) => (
                                                <TableRow key={member.id} className="group hover:bg-slate-50/50 transition-colors">
                                                        <TableCell className="pl-6">
                                                        {!member.used && (
                                                            <div className="flex items-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedMemberIds.has(member.id)}
                                                                    onChange={(e) => handleSelectMember(member.id, e.target.checked)}
                                                                    className="w-5 h-5 cursor-pointer mr-3"
                                                                />
                                                                <span className="font-bold text-slate-700">{member.name}</span>
                                                            </div>
                                                        )}
                                                        {member.used && <span className="font-bold text-slate-700 pl-6">{member.name}</span>}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-sm text-slate-500">{member.code}</TableCell>
                                                    <TableCell><Badge variant="outline" className="text-slate-600 bg-slate-50 border-slate-200">{getGradeName(member.grade)}</Badge></TableCell>
                                                    <TableCell className="text-sm text-slate-600 font-medium tabular-nums">{member.expiryDate}</TableCell>
                                                    <TableCell>
                                                        {member.used ? (
                                                            <Badge variant="destructive" className="bg-red-100 text-red-600 hover:bg-red-200 border-red-200 shadow-none font-bold">Used</Badge>
                                                        ) : isExpired(member.expiryDate) ? (
                                                            <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 font-bold">Expired</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 font-bold">Available</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-slate-500 font-mono">
                                                        {member.usedBy || '-'}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-slate-500">
                                                        {member.usedAt ? new Date(member.usedAt.seconds * 1000).toLocaleDateString() : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <div className="flex justify-end items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                            {member.used && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleResetMember(member.id)}
                                                                    className="h-8 w-8 text-orange-400 hover:text-orange-600 hover:bg-orange-50"
                                                                    title="Reset Status"
                                                                >
                                                                    <RotateCcw className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                            {!member.used && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleEditClick(member)}
                                                                    className="h-8 w-8 text-slate-300 hover:text-slate-600 hover:bg-slate-50"
                                                                    title="Edit Member"
                                                                >
                                                                    <Edit className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleDelete(member.id)}
                                                                className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50"
                                                                title="Delete Member"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 2: Manual Add */}
                <TabsContent value="add" className="animate-in fade-in slide-in-from-bottom-2">
                    <Card className="border-none shadow-lg shadow-slate-200/50 bg-white rounded-2xl max-w-2xl mx-auto">
                        <CardHeader className="bg-indigo-50/50 border-b border-indigo-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-100 rounded-xl text-indigo-600">
                                    <UserPlus className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-bold text-slate-800">Add New Member</CardTitle>
                                    <CardDescription className="text-indigo-600/80 font-medium mt-0.5">Manually register a single member to whitelist.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">Member Name</Label>
                                    <Input
                                        placeholder="e.g. Hong Gil Dong"
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">License / Code</Label>
                                    <Input
                                        placeholder="e.g. 12345"
                                        value={newCode}
                                        onChange={e => setNewCode(e.target.value)}
                                        className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors font-mono"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">Verification Grade</Label>
                                    <div className="relative">
                                        <select
                                            className="flex h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white transition-colors appearance-none cursor-pointer"
                                            value={newGrade}
                                            onChange={e => setNewGrade(e.target.value)}
                                        >
                                            <option value="">Select Grade...</option>
                                            {grades.map(g => (
                                                <option key={g.id} value={g.code}>{g.name}</option>
                                            ))}
                                        </select>
                                        <ShieldCheck className="absolute right-3 top-3 h-5 w-5 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">Expiry Date</Label>
                                    <div className="relative">
                                        <Input
                                            type="date"
                                            value={newExpiry}
                                            onChange={e => setNewExpiry(e.target.value)}
                                            className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                                        />
                                        <Calendar className="absolute right-3 top-3 h-5 w-5 text-slate-400 pointer-events-none bg-transparent" />
                                    </div>
                                </div>
                            </div>
                            <Button onClick={handleSingleAdd} size="lg" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 mt-4 rounded-xl">
                                <Plus className="w-5 h-5 mr-2" />
                                Register Member
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 3: Bulk Upload (NEW) */}
                <TabsContent value="bulk" className="animate-in fade-in slide-in-from-bottom-2">
                    <Card className="border-none shadow-lg shadow-slate-200/50 bg-white rounded-2xl">
                        <CardHeader className="bg-emerald-50/50 border-b border-emerald-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-600">
                                    <FileSpreadsheet className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-bold text-slate-800">CSV 대량 업로드</CardTitle>
                                    <CardDescription className="text-emerald-600/80 font-medium mt-0.5">회원 정보를 CSV 형식으로 대량 업로드합니다.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold text-slate-700">CSV 파일 입력</Label>
                                    <Textarea
                                        placeholder="CSV 데이터를 여기에 붙여넣으세요..."
                                        rows={12}
                                        value={bulkData}
                                        onChange={e => setBulkData(e.target.value)}
                                        className="font-mono text-sm leading-relaxed bg-slate-50 border-slate-200 focus:bg-white focus:border-emerald-500 transition-colors rounded-xl resize-none p-4"
                                    />
                                </div>
                                <Button onClick={handleBulkUpload} size="lg" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 rounded-xl h-12">
                                    <Upload className="w-5 h-5 mr-2" />
                                    CSV 업로드 처리
                                </Button>
                            </div>
                            
                            <div className="p-6 bg-yellow-50 rounded-xl border border-yellow-200">
                                <h4 className="font-bold text-yellow-800 mb-4">CSV 파일 형식 가이드</h4>
                                <p className="text-sm text-slate-600 mb-4">
                                    CSV 형식: <code className="bg-white px-2 py-1 rounded border border-slate-200">NAME|CODE|GRADE|EXPIRY_DATE</code>
                                </p>
                                
                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-slate-400 uppercase">CSV 파일 예시</p>
                                    <div className="bg-white border border-slate-200 rounded-lg p-3 font-mono text-xs text-slate-600 space-y-1 shadow-sm">
                                        <p>홍길동|1001|정회원|2026-12-31</p>
                                        <p>김철수|1002|준회원|2026-06-30</p>
                                        <p>이영희|1003|준비회원|2026-03-31</p>
                                    </div>
                                </div>
                                
                                <div className="pt-2">
                                    <p className="text-xs text-slate-400">
                                        • 구분자: 파이프(|)<br/>
                                        • 형식: 이름|코드|등급|유효기간(YYYY-MM-DD)
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 4: Bulk Expiry Update (NEW) */}
                <TabsContent value="bulk-expiry" className="animate-in fade-in slide-in-from-bottom-2">
                    <Card className="border-none shadow-lg shadow-slate-200/50 bg-white rounded-2xl max-w-3xl mx-auto">
                        <CardHeader className="bg-blue-50/50 border-b border-blue-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-100 rounded-xl text-blue-600">
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-bold text-slate-800">대량 유효기간 수정</CardTitle>
                                    <CardDescription className="text-blue-600/80 font-medium mt-0.5">선택된 회원들의 유효기간을 일괄로 수정합니다.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                                <div className="space-y-4 flex-1">
                                    <Label className="text-sm font-bold text-slate-700">새로운 유효기간</Label>
                                    <Input
                                        type="date"
                                        value={bulkNewExpiry}
                                        onChange={(e) => setBulkNewExpiry(e.target.value)}
                                        placeholder="YYYY-MM-DD"
                                        className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">형식: YYYY-MM-DD</p>
                                </div>
                                <div className="space-y-4">
                                    <Button
                                        onClick={handleBulkExpiryUpdate}
                                        disabled={selectedMemberIds.size === 0 || !bulkNewExpiry}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 h-12"
                                    >
                                        선택된 회원들 ({selectedMemberIds.size}명) 유효기간 수정
                                    </Button>
                                </div>
                            </div>
                            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <p className="text-sm text-gray-600">
                                    <strong className="text-gray-800">선택 팁:</strong>
                                    <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
                                        <li>사용 완료된 회원은 선택할 수 없습니다.</li>
                                        <li>최대 500명씩 일괄로 처리됩니다.</li>
                                        <li>수정 완료 후 선택이 해제됩니다.</li>
                                    </ul>
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 4: Grade Settings */}
                <TabsContent value="settings" className="animate-in fade-in slide-in-from-bottom-2">
                    <Card className="border-none shadow-lg shadow-slate-200/50 bg-white rounded-2xl max-w-3xl mx-auto">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600">
                                    <Settings className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-bold text-slate-800">Grade Configuration</CardTitle>
                                    <CardDescription className="text-slate-500 font-medium mt-0.5">Define member grades and codes (e.g., Regular, Associate). (v_fix_id)</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-200">
                                <Label className="text-sm font-bold text-slate-700 mb-4 block">Add New Grade</Label>
                                <div className="flex flex-col md:flex-row gap-4 items-end">
                                    <div className="flex-1 w-full space-y-2">
                                        <Label className="text-xs font-bold text-slate-400 uppercase">Display Name (KO)</Label>
                                        <Input
                                            value={newGradeName}
                                            onChange={e => setNewGradeName(e.target.value)}
                                            placeholder="e.g. 정회원"
                                            className="h-11 bg-white"
                                        />
                                    </div>
                                    <div className="flex-1 w-full space-y-2">
                                        <Label className="text-xs font-bold text-slate-400 uppercase">System Code</Label>
                                        <Input
                                            value={newGradeCode}
                                            onChange={e => setNewGradeCode(e.target.value)}
                                            placeholder="e.g. regular"
                                            className="h-11 bg-white font-mono"
                                        />
                                    </div>
                                    <Button onClick={handleAddGrade} className="h-11 px-6 bg-slate-900 text-white w-full md:w-auto">
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Grade
                                    </Button>
                                </div>
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="font-bold text-slate-600 pl-6">Display Name</TableHead>
                                            <TableHead className="font-bold text-slate-600">System Code</TableHead>
                                            <TableHead className="text-right font-bold text-slate-600 pr-6">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {grades.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center py-12 text-slate-400">
                                                    No grades defined yet.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            grades.map(g => (
                                                <TableRow key={g.id}>
                                                    <TableCell className="font-medium pl-6">{g.name}</TableCell>
                                                    <TableCell className="font-mono text-xs text-slate-500">
                                                        <Badge variant="secondary" className="font-normal">{g.code}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteGrade(g.id)}
                                                            className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Edit Member Dialog (NEW) */}
            <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>회원 정보 수정</DialogTitle>
                        <DialogDescription>
                            회원의 유효기간 및 기본 정보를 수정합니다.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label>이름</Label>
                            <Input
                                value={editForm.name}
                                onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                                placeholder="홍길동"
                            />
                        </div>

                        <div>
                            <Label>면허번호/코드</Label>
                            <Input
                                value={editForm.code}
                                onChange={(e) => setEditForm({...editForm, code: e.target.value})}
                                placeholder="MEMBER001"
                                className="font-mono"
                            />
                        </div>

                        <div>
                            <Label>회원등급</Label>
                            <select
                                value={editForm.grade}
                                onChange={(e) => setEditForm({...editForm, grade: e.target.value})}
                                className="flex h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white transition-colors appearance-none cursor-pointer"
                            >
                                <option value="">등급 선택...</option>
                                {grades.map(g => (
                                    <option key={g.id} value={g.code}>{g.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <Label>유효기간</Label>
                            <div className="relative">
                                <Input
                                    type="date"
                                    value={editForm.expiryDate}
                                    onChange={(e) => setEditForm({...editForm, expiryDate: e.target.value})}
                                    className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                                />
                                <Calendar className="absolute right-3 top-3 h-5 w-5 text-slate-400 pointer-events-none" />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">형식: YYYY-MM-DD</p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingMember(null)}>
                            취소
                        </Button>
                        <Button onClick={handleEditSave}>
                            저장
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default MemberManagerPage;
