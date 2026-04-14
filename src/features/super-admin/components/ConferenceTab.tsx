import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar, Plus } from 'lucide-react';
import { useSuperAdminConference } from '../hooks/useSuperAdminConference';
import { Society } from '@/types/schema';

interface ConferenceTabProps {
    societies: Society[];
    createConference: (
        societyId: string,
        slug: string,
        titleKo: string,
        titleEn: string,
        startDate: string,
        endDate: string,
        location: string,
        adminEmail: string
    ) => Promise<boolean>;
}

export const ConferenceTab: React.FC<ConferenceTabProps> = ({ societies, createConference }) => {
    const {
        selectedSocId, setSelectedSocId,
        slug, setSlug,
        titleKo, setTitleKo,
        titleEn, setTitleEn,
        start, setStart,
        end, setEnd,
        location, setLocation,
        handleCreateConference
    } = useSuperAdminConference(societies, createConference);

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
