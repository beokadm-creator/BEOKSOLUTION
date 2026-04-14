import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConferenceInfo } from '@/types/schema';

interface RegistrationHeaderProps {
    societyId: string | undefined;
    societyName: string;
    language: 'ko' | 'en';
    setLanguage: (lang: 'ko' | 'en') => void;
    info: ConferenceInfo | null | undefined;
    slug: string | undefined;
    navigate: (path: string) => void;
}

export function RegistrationHeader({
    societyId,
    societyName,
    language,
    setLanguage,
    info,
    slug,
    navigate
}: RegistrationHeaderProps) {
    return (
        <>
            <header className="bg-white shadow-sm py-4 px-6 flex justify-between items-center sticky top-0 z-10">
                <div className="font-bold text-xl text-blue-900">{societyId?.toUpperCase() || 'Academic Society'}</div>
                <button
                    type="button"
                    onClick={() => setLanguage(language === 'ko' ? 'en' : 'ko')}
                    className="px-3 py-1 rounded text-sm font-bold bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                >
                    {language === 'ko' ? 'EN' : 'KO'}
                </button>
            </header>

            <div>
                <Button variant="ghost" className="pl-0 mb-4" onClick={() => navigate(`/${slug}`)}>
                    <ChevronLeft className="w-5 h-5 mr-1" />
                    {language === 'ko' ? '홈으로' : 'Home'}
                </Button>
                <h1 className="text-3xl font-bold text-gray-900">
                    {language === 'ko' ? societyName + ' 등록 페이지' : societyName + ' Conference Registration Page'}
                </h1>
                <p className="mt-2 text-gray-600">
                    {info?.title ? (language === 'ko' ? info.title.ko : info.title.en) : 'Conference'}
                </p>
            </div>
        </>
    );
}
