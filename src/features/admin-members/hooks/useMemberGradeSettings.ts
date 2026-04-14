import { useState } from "react";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import toast from "react-hot-toast";

import { db } from "@/firebase";

interface UseMemberGradeSettingsArgs {
    targetId: string | null;
    fetchGrades: () => Promise<void>;
}

export function useMemberGradeSettings({ targetId, fetchGrades }: UseMemberGradeSettingsArgs) {
    const [newGradeName, setNewGradeName] = useState("");
    const [newGradeCode, setNewGradeCode] = useState("");

    const handleAddGrade = async () => {
        if (!targetId) return;
        if (!newGradeName || !newGradeCode) {
            toast.error("등급 이름과 코드를 입력해주세요.");
            return;
        }
        try {
            const colRef = collection(db, "societies", targetId, "settings", "grades", "list");

            const docRef = doc(colRef, newGradeCode);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                toast.error("이미 존재하는 코드입니다.");
                return;
            }

            const q = query(colRef, where("code", "==", newGradeCode));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                toast.error("이미 존재하는 코드입니다.");
                return;
            }

            const newGradeObj = {
                code: newGradeCode,
                name: { ko: newGradeName, en: newGradeCode }
            };

            console.log(`[MemberManager] Creating grade with ID: ${newGradeCode}`);
            await setDoc(doc(colRef, newGradeCode), newGradeObj);

            toast.success(`등급이 추가되었습니다. (ID: ${newGradeCode})`);
            setNewGradeName("");
            setNewGradeCode("");
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
            const colRef = collection(db, "societies", targetId, "settings", "grades", "list");
            const q = query(colRef, where("code", "==", gradeCode));
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

    return {
        newGradeName,
        setNewGradeName,
        newGradeCode,
        setNewGradeCode,
        handleAddGrade,
        handleDeleteGrade
    };
}

