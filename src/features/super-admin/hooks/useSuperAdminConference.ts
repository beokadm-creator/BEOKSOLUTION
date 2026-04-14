import { useState } from 'react';
import toast from 'react-hot-toast';
import { Society } from '@/types/schema';

export const useSuperAdminConference = (
    societies: Society[],
    createConferenceHook: (
        societyId: string,
        slug: string,
        titleKo: string,
        titleEn: string,
        startDate: string,
        endDate: string,
        location: string,
        adminEmail: string
    ) => Promise<boolean>
) => {
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
            const selectedSoc = societies.find((s) => s.id === selectedSocId) as (Society & { domainCode?: string }) | undefined;
            const conferenceSocietyId = (selectedSoc?.domainCode || selectedSocId).toLowerCase();
            const adminEmail = selectedSoc?.adminEmails?.[0] || 'admin@beoksolution.com';

            await createConferenceHook(
                conferenceSocietyId,
                slug,
                titleKo,
                titleEn || '',
                start,
                end,
                location,
                adminEmail
            );
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

    return {
        selectedSocId, setSelectedSocId,
        slug, setSlug,
        titleKo, setTitleKo,
        titleEn, setTitleEn,
        start, setStart,
        end, setEnd,
        location, setLocation,
        handleCreateConference
    };
};
