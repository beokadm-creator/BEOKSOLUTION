import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { getFirestore, deleteDoc, doc } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ABSTRACT_STATUS } from '@/constants/abstract';
import { Submission } from '@/types/schema';
import { forceString, getSafeConferenceSlug, getSocietyIdFromSlug } from '../utils';
import { safeFormatDate } from '@/utils/dateUtils';
import { DOMAIN_CONFIG, extractSocietyFromHost } from '@/utils/domainHelper';
import { getRootCookie } from '@/utils/cookie';
import { logger } from '@/utils/logger';

interface AbstractsTabProps {
    loading: boolean;
    abstracts: Submission[];
    setActiveTab: (tab: 'EVENTS') => void;
    setAbstracts: React.Dispatch<React.SetStateAction<Submission[]>>;
}

export const AbstractsTab: React.FC<AbstractsTabProps> = ({
    loading,
    abstracts,
    setActiveTab,
    setAbstracts
}) => {
    const navigate = useNavigate();

    const formatDate = (date: any): string => {
        return safeFormatDate(date, 'ko-KR');
    };

    return (
        <div className="space-y-4">
            {loading && (
                <>
                    {[1, 2].map((i) => (
                        <div key={i} className="bg-white p-5 rounded-xl shadow-sm border flex flex-col gap-3">
                            <div className="flex justify-between">
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-5 w-16 rounded-full" />
                            </div>
                            <Skeleton className="h-6 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                        </div>
                    ))}
                </>
            )}
            {!loading && abstracts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-xl border-2 border-dashed border-gray-200 text-center">
                    <div className="w-20 h-20 bg-blue-50 text-blue-200 rounded-full flex items-center justify-center mb-6">
                        <FileText className="w-10 h-10 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">제출된 초록이 없습니다</h3>
                    <p className="text-gray-500 max-w-sm mb-8">
                        아직 제출된 초록이 없습니다.<br />
                        현재 접수 중인 학술대회를 확인해보세요.
                    </p>
                    <Button
                        onClick={() => setActiveTab('EVENTS')}
                        variant="outline"
                        className="px-8 py-6 text-base font-bold border-2 border-blue-100 text-blue-600 hover:bg-blue-50 hover:border-blue-200"
                    >
                        등록된 학회 보기
                    </Button>
                </div>
            )}
            {abstracts.map(abs => (
                <div key={abs.id} className="eregi-card hover:border-eregi-200 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-col">
                            <div className="text-xs font-bold text-eregi-600 mb-1 bg-eregi-50 inline-block px-2 py-0.5 rounded">
                                [{(abs as any).confId?.toUpperCase() || 'UNKNOWN'}]
                            </div>
                            <h3 className="font-heading-3 text-slate-900 mt-2">
                                {abs.title?.ko || abs.title?.en || 'Untitled'}
                            </h3>
                        </div>
                        <span className={`px-3 py-1 rounded-md text-xs font-bold shadow-sm border ${abs.reviewStatus === ABSTRACT_STATUS.ACCEPTED_ORAL
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : abs.reviewStatus === ABSTRACT_STATUS.ACCEPTED_POSTER
                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                : abs.reviewStatus === ABSTRACT_STATUS.REJECTED
                                    ? 'bg-red-50 text-red-600 border-red-200'
                                    : 'bg-gray-100 text-gray-600 border-gray-200'
                            }`}>
                            {abs.reviewStatus === ABSTRACT_STATUS.ACCEPTED_ORAL ? 'Oral Accepted' :
                                abs.reviewStatus === ABSTRACT_STATUS.ACCEPTED_POSTER ? 'Poster Accepted' :
                                    abs.reviewStatus === ABSTRACT_STATUS.REJECTED ? 'Rejected' : 'Under Review'}
                        </span>
                    </div>
                    <div className="text-sm text-gray-500 flex flex-col gap-1 mt-2">
                        <p>제출일: {formatDate(abs.submittedAt || (abs as any).createdAt)}</p>
                        <p>저자: {abs.authors?.map((a: any) => a.name).join(', ') || '-'}</p>

                        <div className="flex flex-col sm:flex-row gap-2 mt-4 w-full sm:w-auto">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const currentHost = window.location.hostname;
                                    const absData = abs as any;
                                    const abstractSlug = getSafeConferenceSlug(
                                        forceString(absData.slug || absData.conferenceSlug || absData.confId || absData.conferenceId)
                                    );
                                    if (!abstractSlug) {
                                        toast.error('학술대회 정보가 없어 초록 수정 페이지로 이동할 수 없습니다.');
                                        return;
                                    }
                                    const fallbackSocietyFromHost = extractSocietyFromHost(currentHost);
                                    const abstractSocietyId = forceString(
                                        absData.societyId ||
                                        getSocietyIdFromSlug(abstractSlug) ||
                                        fallbackSocietyFromHost
                                    );
                                    if (!abstractSocietyId) {
                                        toast.error('학회 정보를 찾을 수 없어 초록 수정 페이지로 이동할 수 없습니다.');
                                        return;
                                    }
                                    const targetHost = `${abstractSocietyId}.${DOMAIN_CONFIG.BASE_DOMAIN}`;
                                    const token = getRootCookie('eregi_session');

                                    if (currentHost === targetHost || currentHost.includes('localhost') || currentHost === DOMAIN_CONFIG.BASE_DOMAIN) {
                                        navigate(`/${abstractSlug}/abstracts?mode=edit&id=${abs.id}`);
                                    } else {
                                        const authUrl = `https://${targetHost}/${abstractSlug}/abstracts?mode=edit&id=${abs.id}${token ? `&token=${token}` : ''}`;
                                        window.location.href = authUrl;
                                    }
                                }}
                                className="w-full sm:w-auto text-xs bg-blue-50 text-blue-600 px-3 py-2 sm:py-1.5 rounded hover:bg-blue-100 font-bold border border-blue-200"
                            >
                                수정하기
                            </button>

                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!confirm("정말 철회하시겠습니까? 철회 후에는 복구할 수 없습니다.")) return;

                                    try {
                                        const db = getFirestore();
                                        const confId = forceString(
                                            (abs as any).confId ||
                                            (abs as any).conferenceId ||
                                            (abs as any).slug ||
                                            (abs as any).conferenceSlug
                                        );
                                        if (!confId) {
                                            toast.error("유효하지 않은 컨퍼런스 ID입니다.");
                                            return;
                                        }
                                        await deleteDoc(doc(db, `conferences/${confId}/submissions/${abs.id}`));

                                        setAbstracts(prev => prev.filter(p => p.id !== abs.id));
                                        toast.success("초록이 철회되었습니다.");
                                    } catch (err) {
                                        logger.error('UserHub', 'Withdraw failed', err);
                                        toast.error("철회 실패: 관리자에게 문의하세요.");
                                    }
                                }}
                                className="w-full sm:w-auto text-xs bg-red-50 text-red-600 px-3 py-2 sm:py-1.5 rounded hover:bg-red-100 font-bold border border-red-200"
                            >
                                제출 철회
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
