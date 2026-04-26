import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { safeFormatDate } from '@/utils/dateUtils';
import {
    RefreshCw, Search, RotateCcw, Filter, Edit, Trash2, CheckSquare, Square, X
} from 'lucide-react';
import type { Member } from '@/hooks/useMemberManager';

interface MemberTableProps {
    filteredMembers: Member[];
    loading: boolean;
    searchTerm: string;
    selectAll: boolean;
    selectedMemberIds: Set<string>;
    isExpired: (dateStr: string) => boolean;
    getGradeName: (code: string) => string;
    onSearchTermChange: (value: string) => void;
    onFetchMembers: () => void;
    onSelectAll: (checked: boolean) => void;
    onSelectMember: (memberId: string, checked: boolean) => void;
    onDelete: (id: string) => void;
    onResetMember: (id: string) => void;
    onEditClick: (member: Member) => void;
}

const MemberTable: React.FC<MemberTableProps> = ({
    filteredMembers,
    loading,
    searchTerm,
    selectAll,
    selectedMemberIds,
    isExpired,
    getGradeName,
    onSearchTermChange,
    onFetchMembers,
    onSelectAll,
    onSelectMember,
    onDelete,
    onResetMember,
    onEditClick,
}) => {
    return (
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
                                onChange={e => onSearchTermChange(e.target.value)}
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => onSearchTermChange('')}
                                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={onFetchMembers} disabled={loading} className="w-full md:w-auto border-dashed hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50">
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
                                    {selectAll ? <CheckSquare className="w-5 h-5 cursor-pointer" onClick={() => onSelectAll(false)} /> : <Square className="w-5 h-5 cursor-pointer" onClick={() => onSelectAll(true)} />}
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
                                                        onChange={(e) => onSelectMember(member.id, e.target.checked)}
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
                                            {safeFormatDate(member.usedAt)}
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <div className="flex justify-end items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                {member.used && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => onResetMember(member.id)}
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
                                                        onClick={() => onEditClick(member)}
                                                        className="h-8 w-8 text-slate-300 hover:text-slate-600 hover:bg-slate-50"
                                                        title="Edit Member"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => onDelete(member.id)}
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
    );
};

export default MemberTable;
