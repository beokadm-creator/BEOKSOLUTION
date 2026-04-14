import { useCallback, useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import toast from "react-hot-toast";

import { db } from "@/firebase";

import type { Grade, Member } from "../types";

interface UseMemberManagerDataArgs {
    targetId: string | null;
    newGrade: string;
    setNewGrade: (value: string) => void;
}

export function useMemberManagerData({ targetId, newGrade, setNewGrade }: UseMemberManagerDataArgs) {
    const [members, setMembers] = useState<Member[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchGrades = useCallback(async () => {
        if (!targetId) return;
        try {
            const colRef = collection(db, "societies", targetId, "settings", "grades", "list");
            const snapshot = await getDocs(colRef);

            if (!snapshot.empty) {
                const list = snapshot.docs.map((gradeDoc) => {
                    const data = gradeDoc.data();
                    const gradeName =
                        typeof data.name === "object" ? (data.name as { ko: string }).ko : (data.name as string);
                    return {
                        id: (data.code as string | undefined) || gradeDoc.id,
                        name: gradeName,
                        code: (data.code as string | undefined) || gradeDoc.id
                    } as Grade;
                });
                setGrades(list);
                if (list.length > 0 && !newGrade) setNewGrade(list[0].code);
            } else {
                setGrades([]);
            }
        } catch (error) {
            console.error("Error fetching grades:", error);
        }
    }, [newGrade, setNewGrade, targetId]);

    const fetchMembers = useCallback(async () => {
        if (!targetId) return;
        setLoading(true);
        try {
            const q = collection(db, "societies", targetId, "members");

            const snapshot = await getDocs(q);
            const list = snapshot.docs.map((memberDoc) => ({ id: memberDoc.id, ...memberDoc.data() }) as Member);

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

    useEffect(() => {
        if (!targetId) return;
        fetchGrades();
        fetchMembers();
    }, [fetchGrades, fetchMembers, targetId]);

    return {
        grades,
        members,
        loading,
        fetchGrades,
        fetchMembers,
        setMembers
    };
}
