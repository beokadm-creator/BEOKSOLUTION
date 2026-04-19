import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../ui/card';
import { Calendar, Plus } from 'lucide-react';
import { useSuperAdmin } from '../../../hooks/useSuperAdmin';

export const ConferenceTab: React.FC = () => {
    const { societies, createConference } = useSuperAdmin();

    const [selectedSocId, setSelectedSocId] = useState('');
    const [slug, setSlug] = useState('');
    const [titleKo, setTitleKo] = useState('');
    const [titleEn, setTitleEn] = useState('');
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [location, setLocation] = useState('');

    const handleCreateConference = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSocId || !slug || !titleKo || !start || !end) return toast.error("필수 항목 누락");

        const toastId = toast.loading("Creating conference...");
        try {
            const selectedSoc = societies.find((s) => s.id === selectedSocId) as (typeof societies[0] & { domainCode?: string }) | undefined;
            const conferenceSocietyId = (selectedSoc?.domainCode || selectedSocId).toLowerCase();
            await createConference({
                societyId: conferenceSocietyId,
                slug,
                title: { ko: titleKo, en: titleEn || undefined },
                description: { ko: '' },
                venue: { name: 'TBD', address: 'TBD' },
                start: new Date(start),
                end: new Date(end),
                location
            });
            toast.success("Conference created.", { id: toastId });
            setSlug('');
            setTitleKo('');
            setTitleEn('');
            setStart('');
            setEnd('');
            setLocation('');
        } catch (e) {
            console.error("Create Conference Error:", e);
            toast.error(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`, { id: toastId });
        }
    };

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-t-4 border-t-green-600">
                <CardHeader className="pb-4">
                    <CardTitle className="text-xl flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-green-600" /> Create Conference
                    </CardTitle>
                    <CardDescription>Create new conference events for societies</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <form onSubmit={handleCreateConference} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500 uppercase">Select Society</Label>
                            <select
                                className="w-full p-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:border-green-600"
                                value={selectedSocId}
                                onChange={e => setSelectedSocId(e.target.value)}
                            >
                                <option value="">Select Society...</option>
                                {societies.map(s => <option key={s.id} value={s.id}>{s.name.ko}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500 uppercase">Conference Slug</Label>
                                <Input value={slug} onChange={e => setSlug(e.target.value)} className="bg-white border-slate-300 focus:border-green-600" placeholder="e.g., 2026spring" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500 uppercase">Start Date</Label>
                                <Input type="date" value={start} onChange={e => setStart(e.target.value)} className="bg-white border-slate-300 focus:border-green-600" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500 uppercase">Title (한국어)</Label>
                                <Input value={titleKo} onChange={e => setTitleKo(e.target.value)} className="bg-white border-slate-300 focus:border-green-600" placeholder="예: 2026년 춘계학술대회" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500 uppercase">Title (English)</Label>
                                <Input value={titleEn} onChange={e => setTitleEn(e.target.value)} className="bg-white border-slate-300 focus:border-green-600" placeholder="Optional: Spring Conference 2026" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500 uppercase">End Date</Label>
                                <Input type="date" value={end} onChange={e => setEnd(e.target.value)} className="bg-white border-slate-300 focus:border-green-600" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500 uppercase">Location</Label>
                                <Input value={location} onChange={e => setLocation(e.target.value)} className="bg-white border-slate-300 focus:border-green-600" placeholder="예: 서울 코엑스" />
                            </div>
                        </div>
                        <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold">
                            <Plus className="w-4 h-4 mr-2" /> Create Conference
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};
