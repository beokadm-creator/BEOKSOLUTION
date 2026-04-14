import { useState } from "react";
import { Timestamp, collection, doc, writeBatch } from "firebase/firestore";
import toast from "react-hot-toast";

import { db } from "@/firebase";

export function useMemberBulkUpload(targetId: string | null, newGrade: string, fetchMembers: () => Promise<void>) {
    const [bulkData, setBulkData] = useState("");

    const handleBulkUpload = async () => {
        if (!bulkData.trim()) {
            toast.error("CSV 데이터가 비어 있습니다.");
            return;
        }

        if (!newGrade) {
            toast.error("등급을 선택해주세요.");
            return;
        }

        const lines = bulkData.trim().split("\n").filter((line) => line.trim());

        if (lines.length === 0) {
            toast.error("CSV 파일이 비어 있습니다.");
            return;
        }

        const parsedData: Array<{ name: string; code: string; grade: string; expiryDate: string }> = [];
        const errors: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split("|");

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
                name: name.replace(/\s+/g, ""),
                code: code.replace(/\s+/g, ""),
                grade: grade.trim(),
                expiryDate: expiryDate.trim()
            });
        }

        if (errors.length > 0) {
            toast.error(
                `CSV 파싱 오류:\n${errors.slice(0, 5).join("\n")}${
                    errors.length > 5 ? `\n... 외 ${errors.length - 5}개 오류` : ""
                }`
            );
            return;
        }

        if (parsedData.length === 0) {
            toast.error("파싱된 데이터가 없습니다.");
            return;
        }

        try {
            if (!targetId) return;

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
            setBulkData("");
            fetchMembers();
        } catch (error) {
            console.error("CSV Upload error:", error);
            toast.error("업로드 실패");
        }
    };

    return { bulkData, setBulkData, handleBulkUpload };
}

