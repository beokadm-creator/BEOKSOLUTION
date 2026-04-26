import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Settings, Plus, Trash2 } from 'lucide-react';
import type { Grade } from '@/hooks/useMemberManager';

interface GradeManagerProps {
    grades: Grade[];
    newGradeName: string;
    newGradeCode: string;
    onNewGradeNameChange: (value: string) => void;
    onNewGradeCodeChange: (value: string) => void;
    onAddGrade: () => void;
    onDeleteGrade: (gradeCode: string) => void;
}

const GradeManager: React.FC<GradeManagerProps> = ({
    grades,
    newGradeName,
    newGradeCode,
    onNewGradeNameChange,
    onNewGradeCodeChange,
    onAddGrade,
    onDeleteGrade,
}) => {
    return (
        <Card className="border-none shadow-lg shadow-slate-200/50 bg-white rounded-2xl max-w-3xl mx-auto">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600">
                        <Settings className="w-5 h-5" />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-bold text-slate-800">Grade Configuration</CardTitle>
                        <CardDescription className="text-slate-500 font-medium mt-0.5">Define member grades and codes (e.g., Regular, Associate). (v_fix_id)</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
                <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-200">
                    <Label className="text-sm font-bold text-slate-700 mb-4 block">Add New Grade</Label>
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full space-y-2">
                            <Label className="text-xs font-bold text-slate-400 uppercase">Display Name (KO)</Label>
                            <Input
                                value={newGradeName}
                                onChange={e => onNewGradeNameChange(e.target.value)}
                                placeholder="e.g. 정회원"
                                className="h-11 bg-white"
                            />
                        </div>
                        <div className="flex-1 w-full space-y-2">
                            <Label className="text-xs font-bold text-slate-400 uppercase">System Code</Label>
                            <Input
                                value={newGradeCode}
                                onChange={e => onNewGradeCodeChange(e.target.value)}
                                placeholder="e.g. regular"
                                className="h-11 bg-white font-mono"
                            />
                        </div>
                        <Button onClick={onAddGrade} className="h-11 px-6 bg-slate-900 text-white w-full md:w-auto">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Grade
                        </Button>
                    </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="font-bold text-slate-600 pl-6">Display Name</TableHead>
                                <TableHead className="font-bold text-slate-600">System Code</TableHead>
                                <TableHead className="text-right font-bold text-slate-600 pr-6">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {grades.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-12 text-slate-400">
                                        No grades defined yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                grades.map(g => (
                                    <TableRow key={g.id}>
                                        <TableCell className="font-medium pl-6">{g.name}</TableCell>
                                        <TableCell className="font-mono text-xs text-slate-500">
                                            <Badge variant="secondary" className="font-normal">{g.code}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onDeleteGrade(g.id)}
                                                className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
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

export default GradeManager;
