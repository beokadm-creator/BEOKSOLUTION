import { useState, useEffect, useCallback } from 'react';
import {
    collection, getDocs, addDoc, doc, deleteDoc, query, Timestamp, updateDoc, where, deleteField, writeBatch, setDoc, getDoc
} from 'firebase/firestore';
import { db } from '@/firebase';
import { useSocietyGrades } from '@/hooks/useSocietyGrades';
import toast from 'react-hot-toast';
import { getKstToday } from '@/utils/dateUtils';

export interface Grade {
    id: string;
    name: string;
    code: string;
}

export interface Member {
    id: string;
    societyId: string;
    name: string;
    code: string;
    expiryDate: string;
    grade: string;
    createdAt: Timestamp;
    used?: boolean;
    usedBy?: string;
    usedAt?: Timestamp;
}

export interface EditForm {
    name: string;
    code: string;
    grade: string;
    expiryDate: string;
}

export function useMemberManager(selectedSocietyId: string | null) {
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

    // Bulk Expiry Update State
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
    const [bulkNewExpiry, setBulkNewExpiry] = useState('');
    const [selectAll, setSelectAll] = useState(false);

    // Edit Member State
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [editForm, setEditForm] = useState<EditForm>({
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
        if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') return parts[0];
        if (parts.length === 2 && parts[1] === 'localhost') return parts[0];
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
            toast.error('회원 등급을 불러오지 못했습니다.');
        }
    }, [targetId, newGrade]);

    const fetchMembers = useCallback(async () => {
        if (!targetId) return;
        setLoading(true);
        try {
            const q = collection(db, 'societies', targetId, 'members');
            const snapshot = await getDocs(q);
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));

            list.sort((a, b) => {
                const timeA = a.createdAt?.seconds || 0;
                const timeB = b.createdAt?.seconds || 0;
                return timeB - timeA;
            });

            setMembers(list);
        } catch (error) {
            console.error("Error fetching members:", error);
            toast.error('회원 목록을 불러오는데 실패했습니다.');
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

            const docRef = doc(colRef, newGradeCode);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                toast.error("이미 존재하는 코드입니다.");
                return;
            }

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
            await addDoc(collection(db, 'societies', targetId, 'members'), {
                societyId: targetId,
                name: newName.replace(/\s+/g, ''),
                code: newCode.replace(/\s+/g, ''),
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

        const lines = bulkData.trim().split('\n').filter(line => line.trim());

        if (lines.length === 0) {
            toast.error('CSV 파일이 비어 있습니다.');
            return;
        }

        const parsedData: Array<{ name: string; code: string; grade: string; expiryDate: string }> = [];
        const errors: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split('|');

            if (parts.length !== 4) {
                errors.push(`줄 ${i + 1}: 형식이 올바르지 않습니다. (NAME|CODE|GRADE|EXPIRY_DATE)`);
                continue;
            }

            const [name, code, grade, expiryDate] = parts;

            if (!name.trim() || !code.trim() || !grade.trim() || !expiryDate.trim()) {
                errors.push(`줄 ${i + 1}: 필수 필드가 누락되어 있습니다.`);
                continue;
            }

            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(expiryDate.trim())) {
                errors.push(`줄 ${i + 1}: 날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)`);
                continue;
            }

            parsedData.push({
                name: name.replace(/\s+/g, ''),
                code: code.replace(/\s+/g, ''),
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

    const handleDelete = async (id: string) => {
        if (!targetId) return;
        if (!window.confirm("정말 삭제하시겠습니까? (This action cannot be undone)")) return;

        try {
            await deleteDoc(doc(db, 'societies', targetId, 'members', id));
            toast.success("삭제되었습니다.");
            fetchMembers();
        } catch (error) {
            console.error("Error deleting member:", error);
            toast.error("삭제 실패");
        }
    };

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

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = members
                .filter(m => !m.used)
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
                name: editForm.name.replace(/\s+/g, ''),
                code: editForm.code.replace(/\s+/g, ''),
                grade: editForm.grade.trim(),
                expiryDate: editForm.expiryDate,
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

    const filteredMembers = members.filter(m =>
        m.name.includes(searchTerm) || m.code.includes(searchTerm)
    );

    const isExpired = (dateStr: string) => {
        const today = getKstToday();
        return dateStr < today;
    };

    const getGradeName = (code: string) => {
        return getGradeLabel(code, 'ko');
    };

    const availableCount = members.filter(m => !m.used && !isExpired(m.expiryDate)).length;

    return {
        // State
        members,
        grades,
        loading,
        searchTerm,
        newName, setNewName,
        newCode, setNewCode,
        newExpiry, setNewExpiry,
        newGrade, setNewGrade,
        bulkData, setBulkData,
        newGradeName, setNewGradeName,
        newGradeCode, setNewGradeCode,
        selectedMemberIds,
        bulkNewExpiry, setBulkNewExpiry,
        selectAll,
        editingMember, setEditingMember,
        editForm, setEditForm,
        targetId,
        // Computed
        filteredMembers,
        availableCount,
        // Helpers
        isExpired,
        getGradeName,
        setSearchTerm,
        // Handlers
        fetchMembers,
        handleAddGrade,
        handleDeleteGrade,
        handleSingleAdd,
        handleBulkUpload,
        handleDelete,
        handleResetMember,
        handleSelectAll,
        handleSelectMember,
        handleBulkExpiryUpdate,
        handleEditClick,
        handleEditSave,
    };
}
