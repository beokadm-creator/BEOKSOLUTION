import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserPlus, ShieldCheck, Calendar, Plus } from 'lucide-react';
import type { Grade } from '@/hooks/useMemberManager';

interface MemberAddFormProps {
    newName: string;
    newCode: string;
    newExpiry: string;
    newGrade: string;
    grades: Grade[];
    onNewNameChange: (value: string) => void;
    onNewCodeChange: (value: string) => void;
    onNewExpiryChange: (value: string) => void;
    onNewGradeChange: (value: string) => void;
    onSingleAdd: () => void;
}

const MemberAddForm: React.FC<MemberAddFormProps> = ({
    newName,
    newCode,
    newExpiry,
    newGrade,
    grades,
    onNewNameChange,
    onNewCodeChange,
    onNewExpiryChange,
    onNewGradeChange,
    onSingleAdd,
}) => {
    return (
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
                            onChange={e => onNewNameChange(e.target.value)}
                            className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase">License / Code</Label>
                        <Input
                            placeholder="e.g. 12345"
                            value={newCode}
                            onChange={e => onNewCodeChange(e.target.value)}
                            className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors font-mono"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase">Verification Grade</Label>
                        <div className="relative">
                            <select
                                className="flex h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white transition-colors appearance-none cursor-pointer"
                                value={newGrade}
                                onChange={e => onNewGradeChange(e.target.value)}
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
                                onChange={e => onNewExpiryChange(e.target.value)}
                                className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                            />
                            <Calendar className="absolute right-3 top-3 h-5 w-5 text-slate-400 pointer-events-none bg-transparent" />
                        </div>
                    </div>
                </div>
                <Button onClick={onSingleAdd} size="lg" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 mt-4 rounded-xl">
                    <Plus className="w-5 h-5 mr-2" />
                    Register Member
                </Button>
            </CardContent>
        </Card>
    );
};

export default MemberAddForm;
