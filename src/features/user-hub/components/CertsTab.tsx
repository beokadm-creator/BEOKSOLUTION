import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Affiliation } from '../types';
import { forceString } from '../utils';
import { safeFormatDate } from '@/utils/dateUtils';

interface CertsTabProps {
    loading: boolean;
    user: any;
    societies: Array<{ id: string; name: string | { ko?: string; en?: string };[key: string]: unknown }>;
    handleOpenModal: () => void;
}

export const CertsTab: React.FC<CertsTabProps> = ({
    loading,
    user,
    societies,
    handleOpenModal
}) => {
    const navigate = useNavigate();

    const formatDate = (date: any): string => {
        return safeFormatDate(date, 'ko-KR');
    };

    return (
        <div className="space-y-4">
            {loading && (
                <>
                    <div className="bg-white p-5 rounded-xl shadow-sm border-blue-100 flex justify-between items-center">
                        <div className="flex items-center gap-4 w-full">
                            <Skeleton className="w-10 h-10 rounded-full" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-5 w-1/3" />
                                <Skeleton className="h-4 w-1/2" />
                            </div>
                        </div>
                    </div>
                </>
            )}

            {!loading && user?.affiliations && Object.entries(user.affiliations).map(([socId, aff]: [string, any]) => {
                const typedAff = aff as Affiliation;
                if (!typedAff.verified) return null;

                const soc = societies.find(s => s.id === socId);

                return (
                    <div key={socId} className="eregi-card flex justify-between items-center bg-blue-50/30 border-blue-100">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#e1ecf6] text-[#24669e] rounded-full flex items-center justify-center font-bold text-xl">✓</div>
                            <div>
                                <h4 className="font-heading-3 text-slate-900 leading-tight">{forceString(soc?.name || socId)}</h4>
                                <p className="text-body-sm text-slate-500 flex flex-col gap-1">
                                    {forceString(user.name)} | {forceString(typedAff.licenseNumber || typedAff.memberId)}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="bg-white border border-blue-100 text-eregi-700 px-3 py-1 rounded text-xs font-bold block mb-1 shadow-sm">
                                {forceString(typedAff.grade || '정회원')}
                            </span>
                            <p className="text-xs text-blue-600 mt-1">
                                {typedAff.expiry || typedAff.expiryDate ? `유효기간: ${formatDate(typedAff.expiry || typedAff.expiryDate)}` : '무기한'}
                            </p>
                        </div>
                    </div>
                );
            })}
            <button onClick={handleOpenModal} className="w-full py-4 bg-white border-2 border-dashed border-blue-300 text-blue-600 rounded-xl font-bold hover:bg-blue-50">
                + 학회 정회원 인증 추가하기
            </button>
            <button onClick={() => navigate('/mypage/membership')} className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold hover:from-blue-700 hover:to-blue-800 shadow-md flex items-center justify-center gap-2">
                <CreditCard className="w-5 h-5" />
                학회 회비 납부
            </button>
        </div>
    );
};
