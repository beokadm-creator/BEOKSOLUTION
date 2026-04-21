import React, { useState, useEffect } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/firebase';
import { GlobalExpert } from '@/types/schema';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, User, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

interface GlobalExpertSelectorModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (expert: GlobalExpert) => void;
}

export function GlobalExpertSelectorModal({ open, onOpenChange, onSelect }: GlobalExpertSelectorModalProps) {
    const [experts, setExperts] = useState<GlobalExpert[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (open) {
            fetchExperts();
        }
    }, [open]);

    const fetchExperts = async () => {
        try {
            setLoading(true);
            // No index needed if we just get all and filter in memory since the list might not be huge yet
            const q = query(collection(db, 'global_experts'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as GlobalExpert));
            setExperts(data);
        } catch (error) {
            console.error('Failed to fetch experts:', error);
            toast.error('인명사전을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const filteredExperts = experts.filter(e => 
        e.name?.ko?.includes(searchQuery) || 
        e.name?.en?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.organization?.includes(searchQuery) ||
        e.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                        인명사전에서 불러오기
                    </DialogTitle>
                </DialogHeader>

                <div className="relative mb-4 mt-2">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input 
                        placeholder="이름, 소속, 이메일 검색..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>

                <div className="flex-1 overflow-y-auto min-h-[300px] border rounded-lg bg-slate-50">
                    {loading ? (
                        <div className="flex justify-center items-center h-full text-slate-500 text-sm">
                            로딩 중...
                        </div>
                    ) : filteredExperts.length === 0 ? (
                        <div className="flex justify-center items-center h-full text-slate-500 text-sm">
                            검색 결과가 없습니다.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {filteredExperts.map(expert => (
                                <div 
                                    key={expert.id} 
                                    className="flex items-center justify-between p-4 bg-white hover:bg-blue-50 transition-colors cursor-pointer group"
                                    onClick={() => {
                                        onSelect(expert);
                                        onOpenChange(false);
                                    }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden flex-shrink-0 border">
                                            {expert.photoUrl ? (
                                                <img src={expert.photoUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <User className="w-6 h-6 m-3 text-slate-300" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-slate-900">
                                                {expert.name?.ko} 
                                                {expert.name?.en && <span className="text-slate-500 text-xs ml-2 font-normal">{expert.name.en}</span>}
                                            </div>
                                            <div className="text-sm text-slate-600 mt-0.5">
                                                {expert.organization || '소속 없음'} 
                                                {expert.email && <span className="text-slate-400 ml-2">({expert.email})</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-600 border-blue-200 hover:bg-blue-100">
                                        선택
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}