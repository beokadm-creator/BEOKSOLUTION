import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, getDocs, addDoc, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { Plus, Trash2, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { NotificationEventType, AlimTalkButton, NotificationTemplate, EVENT_TYPE_PRESETS } from '../../types/schema';

interface PartnerTemplatesPageProps {
    vendorId: string;
}

// Filter event types for partners only
const PARTNER_EVENT_TYPES: NotificationEventType[] = ['BOOTH_VISIT', 'GUESTBOOK_SIGN'];

export default function PartnerTemplatesPage({ vendorId }: PartnerTemplatesPageProps) {
    const [selectedEventType, setSelectedEventType] = useState<NotificationEventType>('BOOTH_VISIT');
    const [templates, setTemplates] = useState<Record<NotificationEventType, NotificationTemplate[]>>({
        BOOTH_VISIT: [],
        GUESTBOOK_SIGN: [],
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showDialog, setShowDialog] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        isActive: true,
        templateCode: '',
        content: '',
        buttons: [] as AlimTalkButton[],
    });

    const fetchTemplates = useCallback(async () => {
        if (!vendorId) return;

        setLoading(true);
        try {
            const q = query(
                collection(db, `vendors/${vendorId}/notification-templates`),
                orderBy('createdAt', 'desc')
            );
            const snap = await getDocs(q);

            const grouped: Record<NotificationEventType, NotificationTemplate[]> = {
                BOOTH_VISIT: [],
                GUESTBOOK_SIGN: [],
            };

            snap.docs.forEach(docSnap => {
                const template = { id: docSnap.id, ...docSnap.data() } as NotificationTemplate;
                if (PARTNER_EVENT_TYPES.includes(template.eventType)) {
                    grouped[template.eventType].push(template);
                }
            });

            setTemplates(grouped);
        } catch (error) {
            console.error('Failed to fetch templates:', error);
            toast.error('템플릿을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    }, [vendorId]);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    const handleOpenDialog = (template?: NotificationTemplate) => {
        if (template) {
            setEditingTemplate(template);
            setFormData({
                name: template.name,
                description: template.description || '',
                isActive: template.isActive,
                templateCode: template.channels.kakao?.kakaoTemplateCode || '',
                content: template.channels.kakao?.content || '',
                buttons: template.channels.kakao?.buttons || [],
            });
        } else {
            setEditingTemplate(null);
            setFormData({
                name: '',
                description: '',
                isActive: true,
                templateCode: '',
                content: '',
                buttons: [],
            });
        }
        setShowDialog(true);
    };

    const handleCloseDialog = () => {
        setShowDialog(false);
        setEditingTemplate(null);
        setFormData({
            name: '',
            description: '',
            isActive: true,
            templateCode: '',
            content: '',
            buttons: [],
        });
    };

    const handleSaveTemplate = async () => {
        if (!vendorId) return;

        setSaving(true);
        try {
            const templateData = {
                eventType: selectedEventType,
                vendorId,
                name: formData.name,
                description: formData.description,
                isActive: formData.isActive,
                variables: EVENT_TYPE_PRESETS[selectedEventType].variables,
                channels: {
                    kakao: {
                        content: formData.content,
                        buttons: formData.buttons,
                        kakaoTemplateCode: formData.templateCode,
                        status: 'PENDING' as const,
                    }
                },
                createdAt: editingTemplate ? editingTemplate.createdAt : Timestamp.now(),
                updatedAt: Timestamp.now(),
            };

            if (editingTemplate) {
                const docRef = doc(db, `vendors/${vendorId}/notification-templates`, editingTemplate.id);
                await updateDoc(docRef, templateData);
                toast.success('템플릿이 수정되었습니다.');
            } else {
                await addDoc(collection(db, `vendors/${vendorId}/notification-templates`), templateData);
                toast.success('템플릿이 생성되었습니다.');
            }

            handleCloseDialog();
            await fetchTemplates();
        } catch (error) {
            console.error('Failed to save template:', error);
            toast.error('템플릿 저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTemplate = async (templateId: string) => {
        if (!vendorId) return;
        if (!confirm('정말 이 템플릿을 삭제하시겠습니까?')) return;

        try {
            await deleteDoc(doc(db, `vendors/${vendorId}/notification-templates`, templateId));
            toast.success('템플릿이 삭제되었습니다.');
            await fetchTemplates();
        } catch (error) {
            console.error('Failed to delete template:', error);
            toast.error('템플릿 삭제에 실패했습니다.');
        }
    };

    const handleToggleActive = async (template: NotificationTemplate) => {
        if (!vendorId) return;

        try {
            const docRef = doc(db, `vendors/${vendorId}/notification-templates`, template.id);
            await updateDoc(docRef, { isActive: !template.isActive, updatedAt: Timestamp.now() });
            toast.success(template.isActive ? '템플릿이 비활성화되었습니다.' : '템플릿이 활성화되었습니다.');
            await fetchTemplates();
        } catch (error) {
            console.error('Failed to toggle template:', error);
            toast.error('템플릿 상태 변경에 실패했습니다.');
        }
    };

    const currentTemplates = templates[selectedEventType] || [];
    const eventTypeConfig = EVENT_TYPE_PRESETS[selectedEventType];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Notification Templates</h2>
                    <p className="text-slate-500 mt-1">Manage AlimTalk templates for booth visits and guestbook signatures</p>
                </div>
            </div>

            {/* Event Type Selector */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <Label className="text-sm font-semibold text-slate-700 mb-3 block">Event Type</Label>
                <div className="flex flex-wrap gap-2">
                    {PARTNER_EVENT_TYPES.map((eventType) => {
                        const config = EVENT_TYPE_PRESETS[eventType];
                        return (
                            <button
                                key={eventType}
                                onClick={() => setSelectedEventType(eventType)}
                                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                                    selectedEventType === eventType
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                            >
                                {config.label.ko}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Templates List */}
            <Card className="border-none shadow-lg">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="text-lg">{eventTypeConfig.label.ko} Templates</CardTitle>
                            <CardDescription>{eventTypeConfig.description.ko}</CardDescription>
                        </div>
                        <Button onClick={() => handleOpenDialog()} className="bg-indigo-600 hover:bg-indigo-700">
                            <Plus className="w-4 h-4 mr-2" />
                            New Template
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                        </div>
                    ) : currentTemplates.length === 0 ? (
                        <div className="text-center py-12">
                            <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-500">No templates found for this event type.</p>
                            <p className="text-sm text-slate-400 mt-1">Create your first template to get started.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {currentTemplates.map((template) => (
                                <div key={template.id} className="border border-slate-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h4 className="font-semibold text-slate-900">{template.name}</h4>
                                                <Badge variant={template.isActive ? 'default' : 'secondary'} className={template.isActive ? "bg-green-600" : ""}>
                                                    {template.isActive ? 'Active' : 'Inactive'}
                                                </Badge>
                                                <Badge variant="outline" className="text-xs">
                                                    {template.channels.kakao?.status}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-slate-600 mb-2">{template.description}</p>
                                            <div className="bg-slate-50 rounded p-3">
                                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{template.channels.kakao?.content}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 ml-4">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleToggleActive(template)}
                                            >
                                                {template.isActive ? 'Disable' : 'Enable'}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleOpenDialog(template)}
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleDeleteTemplate(template.id)}
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Template Dialog */}
            <Dialog open={showDialog} onOpenChange={handleCloseDialog}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create New Template'}</DialogTitle>
                        <DialogDescription>
                            {eventTypeConfig.label.ko} - {eventTypeConfig.description.ko}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Template Name *</Label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Booth Visit Welcome Message"
                                className="rounded-xl"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Brief description of this template"
                                className="rounded-xl"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Kakao Template Code *</Label>
                            <Input
                                value={formData.templateCode}
                                onChange={(e) => setFormData({ ...formData, templateCode: e.target.value })}
                                placeholder="e.g., BOOTH_VISIT_001"
                                className="rounded-xl font-mono"
                            />
                            <p className="text-xs text-slate-500">Template code from NHN Cloud console</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Message Content *</Label>
                            <Textarea
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                placeholder="Enter message content with variables like #{userName}"
                                rows={6}
                                className="rounded-xl"
                            />
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                                <p className="text-xs font-semibold text-blue-900 mb-2">Available Variables:</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {eventTypeConfig.variables.map((v) => (
                                        <div key={v.key} className="text-xs text-blue-800">
                                            <code className="bg-blue-100 px-1 rounded">#{v.key}</code> - {v.label}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseDialog} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveTemplate} disabled={saving || !formData.name || !formData.content}>
                            {saving ? 'Saving...' : 'Save Template'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
