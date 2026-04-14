import React from "react";
import { Timestamp, doc, writeBatch } from "firebase/firestore";
import { Calendar } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { db } from "@/firebase";

interface MemberBulkExpiryTabProps {
    targetId: string;
    selectedMemberIds: Set<string>;
    bulkNewExpiry: string;
    setBulkNewExpiry: (value: string) => void;
    clearSelection: () => void;
    fetchMembers: () => Promise<void>;
}

export function MemberBulkExpiryTab({
    targetId,
    selectedMemberIds,
    bulkNewExpiry,
    setBulkNewExpiry,
    clearSelection,
    fetchMembers
}: MemberBulkExpiryTabProps) {
    const handleBulkExpiryUpdate = async () => {
        if (!bulkNewExpiry || selectedMemberIds.size === 0) {
            toast.error("선택된 회원이 없거나 유효기간을 설정해주세요.");
            return;
        }

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(bulkNewExpiry)) {
            toast.error("날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요.");
            return;
        }

        try {
            const batch = writeBatch(db);
            let count = 0;

            selectedMemberIds.forEach((memberId) => {
                const memberRef = doc(db, "societies", targetId, "members", memberId);
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
            clearSelection();
            setBulkNewExpiry("");
            fetchMembers();
        } catch (error) {
            console.error("Bulk update error:", error);
            toast.error("대량 수정 실패");
        }
    };

    return (
        <TabsContent value="bulk-expiry" className="animate-in fade-in slide-in-from-bottom-2">
            <Card className="border-none shadow-lg shadow-slate-200/50 bg-white rounded-2xl max-w-3xl mx-auto">
                <CardHeader className="bg-blue-50/50 border-b border-blue-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-100 rounded-xl text-blue-600">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-bold text-slate-800">대량 유효기간 수정</CardTitle>
                            <CardDescription className="text-blue-600/80 font-medium mt-0.5">
                                선택된 회원들의 유효기간을 일괄로 수정합니다.
                            </CardDescription>
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
    );
}

