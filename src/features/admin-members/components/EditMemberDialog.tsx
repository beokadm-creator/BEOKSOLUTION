import React from "react";
import { Calendar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { Grade } from "../types";

export interface EditMemberFormState {
    name: string;
    code: string;
    grade: string;
    expiryDate: string;
}

interface EditMemberDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    grades: Grade[];
    editForm: EditMemberFormState;
    setEditForm: (next: EditMemberFormState) => void;
    onCancel: () => void;
    onSave: () => void;
}

export function EditMemberDialog({
    open,
    onOpenChange,
    grades,
    editForm,
    setEditForm,
    onCancel,
    onSave
}: EditMemberDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>회원 정보 수정</DialogTitle>
                    <DialogDescription>회원의 유효기간 및 기본 정보를 수정합니다.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <Label>이름</Label>
                        <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            placeholder="홍길동"
                        />
                    </div>

                    <div>
                        <Label>면허번호/코드</Label>
                        <Input
                            value={editForm.code}
                            onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                            placeholder="MEMBER001"
                            className="font-mono"
                        />
                    </div>

                    <div>
                        <Label>회원등급</Label>
                        <select
                            value={editForm.grade}
                            onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}
                            className="flex h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white transition-colors appearance-none cursor-pointer"
                        >
                            <option value="">등급 선택...</option>
                            {grades.map((g) => (
                                <option key={g.id} value={g.code}>
                                    {g.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <Label>유효기간</Label>
                        <div className="relative">
                            <Input
                                type="date"
                                value={editForm.expiryDate}
                                onChange={(e) => setEditForm({ ...editForm, expiryDate: e.target.value })}
                                className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                            />
                            <Calendar className="absolute right-3 top-3 h-5 w-5 text-slate-400 pointer-events-none" />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">형식: YYYY-MM-DD</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>
                        취소
                    </Button>
                    <Button onClick={onSave}>저장</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

