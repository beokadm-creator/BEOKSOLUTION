import React from 'react';
import { useAdminStore } from '@/store/adminStore';
import { useMemberManager } from '@/hooks/useMemberManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Calendar } from 'lucide-react';
import MemberTable from '@/components/admin/member/MemberTable';
import MemberAddForm from '@/components/admin/member/MemberAddForm';
import MemberBulkUpload from '@/components/admin/member/MemberBulkUpload';
import GradeManager from '@/components/admin/member/GradeManager';

const MemberManagerPage: React.FC = () => {
    const { selectedSocietyId } = useAdminStore();
    const {
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
        editingMember, setEditingMember,
        editForm, setEditForm,
        targetId,
        filteredMembers,
        availableCount,
        setSearchTerm,
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
        isExpired,
        getGradeName,
    } = useMemberManager(selectedSocietyId);

    if (!targetId) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4" />
            <p className="text-slate-500 font-medium">Resolving Society Context...</p>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-24 p-6">
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

                <TabsContent value="list" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    <MemberTable
                        filteredMembers={filteredMembers}
                        loading={loading}
                        searchTerm={searchTerm}
                        selectAll={false}
                        selectedMemberIds={selectedMemberIds}
                        isExpired={isExpired}
                        getGradeName={getGradeName}
                        onSearchTermChange={setSearchTerm}
                        onFetchMembers={fetchMembers}
                        onSelectAll={handleSelectAll}
                        onSelectMember={handleSelectMember}
                        onDelete={handleDelete}
                        onResetMember={handleResetMember}
                        onEditClick={handleEditClick}
                    />
                </TabsContent>

                <TabsContent value="add" className="animate-in fade-in slide-in-from-bottom-2">
                    <MemberAddForm
                        newName={newName}
                        newCode={newCode}
                        newExpiry={newExpiry}
                        newGrade={newGrade}
                        grades={grades}
                        onNewNameChange={setNewName}
                        onNewCodeChange={setNewCode}
                        onNewExpiryChange={setNewExpiry}
                        onNewGradeChange={setNewGrade}
                        onSingleAdd={handleSingleAdd}
                    />
                </TabsContent>

                <TabsContent value="bulk" className="animate-in fade-in slide-in-from-bottom-2">
                    <MemberBulkUpload
                        bulkData={bulkData}
                        onBulkDataChange={setBulkData}
                        onBulkUpload={handleBulkUpload}
                    />
                </TabsContent>

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

                <TabsContent value="settings" className="animate-in fade-in slide-in-from-bottom-2">
                    <GradeManager
                        grades={grades}
                        newGradeName={newGradeName}
                        newGradeCode={newGradeCode}
                        onNewGradeNameChange={setNewGradeName}
                        onNewGradeCodeChange={setNewGradeCode}
                        onAddGrade={handleAddGrade}
                        onDeleteGrade={handleDeleteGrade}
                    />
                </TabsContent>
            </Tabs>

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
                                    onChange={(e) => setEditForm({ ...editForm, expiryDate: e.target.value })}
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
