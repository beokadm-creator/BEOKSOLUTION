import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, Timestamp, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAdminStore } from '../../store/adminStore';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '../../components/ui/table';
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger 
} from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Plus, Trash2, RefreshCw, MessageSquare, Info } from 'lucide-react';
import toast from 'react-hot-toast';

interface TemplateButton {
    name: string;
    type: 'WL' | 'AL' | 'BK' | 'MD'; // Web Link, App Link, Bot Keyword, Message Delivery
    linkMobile?: string;
    linkPc?: string;
}

interface Template {
    id: string;
    code: string; 
    name: string;
    content: string;
    buttons: TemplateButton[];
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: Timestamp;
}

export default function TemplatesPage() {
    const { selectedSocietyId } = useAdminStore();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Form State
    const [newName, setNewName] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newButtons, setNewButtons] = useState<TemplateButton[]>([]);
    
    // Determine Society ID
    const getSocietyId = () => {
        if (selectedSocietyId) return selectedSocietyId;
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') return parts[0];
        if (hostname === 'localhost' || hostname === '127.0.0.1') return 'kap'; 
        return null;
    };

    const targetSocietyId = getSocietyId();

    const fetchTemplates = async () => {
        if (!targetSocietyId) return;
        setLoading(true);
        try {
            const q = query(
                collection(db, 'societies', targetSocietyId, 'templates'),
                orderBy('createdAt', 'desc')
            );
            const snapshot = await getDocs(q);
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Template));
            setTemplates(list);
        } catch (error) {
            console.error("Error fetching templates:", error);
            toast.error("템플릿 목록을 불러오는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, [targetSocietyId]);

    const handleAddButton = () => {
        setNewButtons([...newButtons, { name: '홈페이지 이동', type: 'WL', linkMobile: '', linkPc: '' }]);
    };

    const updateButton = (index: number, field: keyof TemplateButton, value: string) => {
        const updated = [...newButtons];
        updated[index] = { ...updated[index], [field]: value };
        setNewButtons(updated);
    };

    const handleSmartLinkPreset = (index: number, preset: string) => {
        const domain = `https://${targetSocietyId}.eregi.co.kr`; // Simplified domain logic
        let url = '';
        
        switch(preset) {
            case 'custom': url = ''; break;
            case 'qr': url = `${domain}/my-qr/#{id}`; break;
            case 'badge': url = `${domain}/my-badge/#{id}`; break;
            case 'landing': url = domain; break;
        }

        const updated = [...newButtons];
        updated[index] = { ...updated[index], linkMobile: url, linkPc: url };
        setNewButtons(updated);
    };

    const removeButton = (index: number) => {
        const updated = newButtons.filter((_, i) => i !== index);
        setNewButtons(updated);
    };

    const handleCreate = async () => {
        if (!targetSocietyId) return;
        if (!newName || !newContent) {
            toast.error("템플릿 이름과 내용을 입력해주세요.");
            return;
        }

        try {
            const code = `TMP_${Date.now().toString().slice(-6)}`;

            await addDoc(collection(db, 'societies', targetSocietyId, 'templates'), {
                code,
                name: newName,
                content: newContent,
                buttons: newButtons,
                status: 'PENDING',
                createdAt: Timestamp.now()
            });

            toast.success("템플릿 신청이 완료되었습니다.");
            setIsDialogOpen(false);
            setNewName('');
            setNewContent('');
            setNewButtons([]);
            fetchTemplates();
        } catch (error) {
            console.error("Error creating template:", error);
            toast.error("템플릿 신청에 실패했습니다.");
        }
    };

    const handleDelete = async (id: string) => {
        if (!targetSocietyId) return;
        if (!window.confirm("정말로 이 템플릿을 삭제하시겠습니까?")) return;

        try {
            await deleteDoc(doc(db, 'societies', targetSocietyId, 'templates', id));
            toast.success("템플릿이 삭제되었습니다.");
            fetchTemplates();
        } catch (error) {
            console.error("Error deleting template:", error);
            toast.error("삭제에 실패했습니다.");
        }
    };

    const insertVariable = (variable: string) => {
        setNewContent(prev => prev + ` #{${variable}}`);
    };

    if (!targetSocietyId) return <div className="p-10 text-center">Society ID not found. Please access via society domain.</div>;

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">알림톡 템플릿 관리</h1>
                    <p className="text-gray-500 mt-2">알림톡 템플릿을 신청하고 관리합니다. (승인까지 영업일 기준 1-2일 소요)</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="w-4 h-4" />
                            새 템플릿 신청
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>새 템플릿 신청</DialogTitle>
                            <DialogDescription>
                                메시지 내용과 버튼을 설정해주세요. 변수를 활용하면 개인화된 메시지를 보낼 수 있습니다.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-6 py-4">
                            <div className="space-y-2">
                                <Label>템플릿 이름</Label>
                                <Input 
                                    placeholder="예: 등록 완료 안내" 
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-2 space-y-2">
                                    <Label>내용</Label>
                                    <Textarea 
                                        placeholder="메시지 내용을 입력하세요..." 
                                        value={newContent}
                                        onChange={e => setNewContent(e.target.value)}
                                        rows={8}
                                        className="font-sans text-sm resize-none"
                                    />
                                    <p className="text-xs text-gray-500">
                                        광고성 내용은 포함할 수 없습니다. 정보성 메시지만 승인됩니다.
                                    </p>
                                </div>
                                <div className="space-y-3 bg-blue-50 p-4 rounded-lg border border-blue-100 h-fit">
                                    <div className="flex items-center gap-2 text-blue-800 font-semibold text-sm">
                                        <Info className="w-4 h-4" />
                                        <span>사용 가능한 변수</span>
                                    </div>
                                    <div className="flex flex-col gap-2 text-sm">
                                        <button onClick={() => insertVariable('이름')} className="text-left px-2 py-1 bg-white border border-blue-200 rounded hover:bg-blue-100 text-slate-700 transition-colors">
                                            <span className="font-mono text-blue-600 mr-2">#{'{이름}'}</span> 수신자 성명
                                        </button>
                                        <button onClick={() => insertVariable('행사명')} className="text-left px-2 py-1 bg-white border border-blue-200 rounded hover:bg-blue-100 text-slate-700 transition-colors">
                                            <span className="font-mono text-blue-600 mr-2">#{'{행사명}'}</span> 행사 제목
                                        </button>
                                        <button onClick={() => insertVariable('등록번호')} className="text-left px-2 py-1 bg-white border border-blue-200 rounded hover:bg-blue-100 text-slate-700 transition-colors">
                                            <span className="font-mono text-blue-600 mr-2">#{'{등록번호}'}</span> 접수 번호
                                        </button>
                                        <button onClick={() => insertVariable('시작일')} className="text-left px-2 py-1 bg-white border border-blue-200 rounded hover:bg-blue-100 text-slate-700 transition-colors">
                                            <span className="font-mono text-blue-600 mr-2">#{'{시작일}'}</span> 행사 시작일
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-4 border-t pt-4">
                                <div className="flex justify-between items-center">
                                    <Label>버튼 설정 (선택사항)</Label>
                                    <Button variant="outline" size="sm" onClick={handleAddButton} type="button">
                                        <Plus className="w-3 h-3 mr-1" /> 버튼 추가
                                    </Button>
                                </div>
                                {newButtons.map((btn, idx) => (
                                    <div key={idx} className="grid grid-cols-12 gap-3 items-start bg-gray-50 p-3 rounded border">
                                        <div className="col-span-3 space-y-1">
                                            <Label className="text-xs">버튼명</Label>
                                            <Input 
                                                placeholder="버튼명" 
                                                value={btn.name} 
                                                onChange={e => updateButton(idx, 'name', e.target.value)} 
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                        <div className="col-span-8 space-y-1">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-xs">링크 (URL)</Label>
                                                <Select onValueChange={(val) => handleSmartLinkPreset(idx, val)}>
                                                    <SelectTrigger className="h-6 text-xs w-[140px]">
                                                        <SelectValue placeholder="링크 프리셋" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="custom">직접 입력</SelectItem>
                                                        <SelectItem value="qr">모바일 QR 페이지</SelectItem>
                                                        <SelectItem value="badge">디지털 명찰</SelectItem>
                                                        <SelectItem value="landing">행사 홈페이지</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <Input 
                                                placeholder="Mobile Link (http://...)" 
                                                value={btn.linkMobile} 
                                                onChange={e => updateButton(idx, 'linkMobile', e.target.value)} 
                                                className="h-8 text-sm font-mono text-xs"
                                            />
                                            <Input 
                                                placeholder="PC Link (선택사항)" 
                                                value={btn.linkPc} 
                                                onChange={e => updateButton(idx, 'linkPc', e.target.value)} 
                                                className="h-8 text-sm font-mono text-xs"
                                            />
                                        </div>
                                        <div className="col-span-1 flex justify-end pt-5">
                                            <Button variant="ghost" size="icon" onClick={() => removeButton(idx)} className="h-8 w-8 text-red-500 hover:bg-red-50">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>취소</Button>
                            <Button onClick={handleCreate}>신청하기</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>템플릿 목록</CardTitle>
                            <CardDescription>신청하신 템플릿의 승인 상태를 확인할 수 있습니다.</CardDescription>
                        </div>
                        <Button variant="ghost" size="icon" onClick={fetchTemplates} disabled={loading}>
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">상태</TableHead>
                                <TableHead className="w-[150px]">템플릿 코드</TableHead>
                                <TableHead className="w-[200px]">템플릿 이름</TableHead>
                                <TableHead>내용 미리보기</TableHead>
                                <TableHead className="text-right">관리</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {templates.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-32 text-gray-500">
                                        신청된 템플릿이 없습니다.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                templates.map((tpl) => (
                                    <TableRow key={tpl.id}>
                                        <TableCell>
                                            <Badge variant={
                                                tpl.status === 'APPROVED' ? 'default' : 
                                                tpl.status === 'REJECTED' ? 'destructive' : 'secondary'
                                            }>
                                                {tpl.status === 'PENDING' ? '대기중' : 
                                                 tpl.status === 'APPROVED' ? '승인됨' : '반려됨'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-gray-600">{tpl.code}</TableCell>
                                        <TableCell className="font-medium">{tpl.name}</TableCell>
                                        <TableCell className="max-w-md truncate text-gray-600" title={tpl.content}>
                                            {tpl.content}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => handleDelete(tpl.id)}
                                                className="text-gray-400 hover:text-red-600"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
