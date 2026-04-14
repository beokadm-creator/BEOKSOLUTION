import React, { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSocietyGrades } from "@/hooks/useSocietyGrades";
import { useAdminStore } from "@/store/adminStore";

import { MemberAddTab } from "@/features/admin-members/components/MemberAddTab";
import { MemberBulkExpiryTab } from "@/features/admin-members/components/MemberBulkExpiryTab";
import { MemberBulkUploadTab } from "@/features/admin-members/components/MemberBulkUploadTab";
import { MemberGradesTab } from "@/features/admin-members/components/MemberGradesTab";
import { MembersListTab } from "@/features/admin-members/components/MembersListTab";
import { useMemberBulkUpload } from "@/features/admin-members/hooks/useMemberBulkUpload";
import { useMemberGradeSettings } from "@/features/admin-members/hooks/useMemberGradeSettings";
import { useMemberManagerData } from "@/features/admin-members/hooks/useMemberManagerData";
import { useMemberSelection } from "@/features/admin-members/hooks/useMemberSelection";

export default function MemberManagerPage() {
    const { selectedSocietyId } = useAdminStore();

    const [newGrade, setNewGrade] = useState("");
    const [bulkNewExpiry, setBulkNewExpiry] = useState("");

    const getSocietyId = () => {
        if (selectedSocietyId) return selectedSocietyId;
        const hostname = window.location.hostname;
        const parts = hostname.split(".");
        if (parts.length > 2 && parts[0] !== "www" && parts[0] !== "admin") return parts[0];
        if (parts.length === 2 && parts[1] === "localhost") return parts[0];
        return null;
    };

    const targetId = getSocietyId();
    const { getGradeLabel } = useSocietyGrades(targetId || undefined);

    const { members, grades, loading, fetchMembers, fetchGrades } = useMemberManagerData({
        targetId,
        newGrade,
        setNewGrade
    });

    const selection = useMemberSelection(members);

    const { newGradeName, setNewGradeName, newGradeCode, setNewGradeCode, handleAddGrade, handleDeleteGrade } =
        useMemberGradeSettings({ targetId, fetchGrades });

    const { bulkData, setBulkData, handleBulkUpload } = useMemberBulkUpload(targetId, newGrade, fetchMembers);

    const isExpired = (dateStr: string) => {
        const today = new Date().toISOString().split("T")[0];
        return dateStr < today;
    };

    const getGradeName = (code: string) => {
        return getGradeLabel(code, "ko");
    };

    if (!targetId)
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4" />
                <p className="text-slate-500 font-medium">Resolving Society Context...</p>
            </div>
        );

    const availableCount = members.filter((m) => !m.used && !isExpired(m.expiryDate)).length;

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-24 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50">
                            Admin Console
                        </Badge>
                        <span className="text-slate-300">|</span>
                        <span className="text-sm font-medium text-slate-500 uppercase tracking-wide">
                            Member Management
                        </span>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Society Members</h1>
                    <p className="text-slate-500 mt-2 font-medium">
                        Manage member verification codes (Whitelist) and grades.
                    </p>
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
                    <TabsTrigger
                        value="list"
                        className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm"
                    >
                        Member List
                        <Badge
                            variant="secondary"
                            className="ml-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                        >
                            {members.length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger
                        value="add"
                        className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm"
                    >
                        Add Single
                    </TabsTrigger>
                    <TabsTrigger
                        value="bulk"
                        className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm"
                    >
                        Bulk Upload
                    </TabsTrigger>
                    <TabsTrigger
                        value="bulk-expiry"
                        className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm"
                    >
                        Bulk Expiry Update
                    </TabsTrigger>
                    <TabsTrigger
                        value="settings"
                        className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm"
                    >
                        Grade Settings
                    </TabsTrigger>
                </TabsList>

                <MembersListTab
                    targetId={targetId}
                    members={members}
                    grades={grades}
                    loading={loading}
                    fetchMembers={fetchMembers}
                    getGradeName={getGradeName}
                    isExpired={isExpired}
                    selectedMemberIds={selection.selectedMemberIds}
                    selectAll={selection.selectAll}
                    handleSelectAll={selection.handleSelectAll}
                    handleSelectMember={selection.handleSelectMember}
                />

                <MemberAddTab
                    targetId={targetId}
                    grades={grades}
                    newGrade={newGrade}
                    setNewGrade={setNewGrade}
                    fetchMembers={fetchMembers}
                />

                <MemberBulkUploadTab bulkData={bulkData} setBulkData={setBulkData} handleBulkUpload={handleBulkUpload} />

                <MemberBulkExpiryTab
                    targetId={targetId}
                    selectedMemberIds={selection.selectedMemberIds}
                    bulkNewExpiry={bulkNewExpiry}
                    setBulkNewExpiry={setBulkNewExpiry}
                    clearSelection={selection.clearSelection}
                    fetchMembers={fetchMembers}
                />

                <MemberGradesTab
                    grades={grades}
                    newGradeName={newGradeName}
                    setNewGradeName={setNewGradeName}
                    newGradeCode={newGradeCode}
                    setNewGradeCode={setNewGradeCode}
                    handleAddGrade={handleAddGrade}
                    handleDeleteGrade={handleDeleteGrade}
                />
            </Tabs>
        </div>
    );
}
