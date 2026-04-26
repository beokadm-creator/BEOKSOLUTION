import React from 'react';
import { FileText, Calendar, UserPlus, MessageSquare, Lock, Plus } from 'lucide-react';
import { EregiButton } from '@/components/eregi/EregiForm';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { safeFormatDate } from '@/utils/dateUtils';
import type { Submission } from '@/types/schema';

interface SubmissionDashboardProps {
    lang: string;
    isSubmissionOpen: boolean;
    isEditOpen: boolean;
    mySubmissions: Submission[];
    onStartNew: () => void;
    onEdit: (sub: Record<string, unknown>) => void;
    onDelete: (id: string) => void;
    onSetStep: (step: number) => void;
}

export const SubmissionDashboard: React.FC<SubmissionDashboardProps> = ({
    lang,
    isSubmissionOpen,
    isEditOpen,
    mySubmissions,
    onStartNew,
    onEdit,
    onDelete,
    onSetStep,
}) => {
    return (
        <>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div className="text-center sm:text-left">
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                        {lang === 'ko' ? '초록 접수 관리' : 'Abstract Dashboard'}
                    </h1>
                    <p className="mt-2 text-gray-500">
                        {lang === 'ko'
                            ? '제출된 초록을 확인하고, 기간 내에 수정 또는 삭제할 수 있습니다.'
                            : 'Manage your submissions. Edit or add new abstracts within the deadline.'}
                    </p>
                </div>

                {isSubmissionOpen && (
                    <EregiButton
                        onClick={onStartNew}
                        className="h-11 bg-[#003366] hover:bg-[#002244] text-white shadow-md hover:shadow-lg transition-all rounded-xl px-5 flex-shrink-0"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        {lang === 'ko' ? '새 초록 등록하기' : 'New Submission'}
                    </EregiButton>
                )}
            </div>

            <div className={cn(
                "mb-8 p-5 rounded-2xl flex items-start sm:items-center gap-4 border",
                !isSubmissionOpen ? "bg-gray-50 border-gray-200" : "bg-blue-50 border-blue-100"
            )}>
                <div className={cn(
                    "p-2 rounded-full flex-shrink-0",
                    !isSubmissionOpen ? "bg-gray-200 text-gray-500" : "bg-blue-100 text-blue-600"
                )}>
                    {!isSubmissionOpen ? <Lock className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
                </div>
                <div>
                    <h3 className={cn("font-bold text-sm mb-0.5", !isSubmissionOpen ? "text-gray-900" : "text-blue-900")}>
                        {!isSubmissionOpen
                            ? (lang === 'ko' ? '신규 접수가 마감되었습니다.' : 'New submissions are closed.')
                            : (lang === 'ko' ? '현재 초록 접수 기간입니다.' : 'Abstract submission is currently OPEN.')}
                    </h3>
                    <p className="text-sm text-gray-500">
                        {isEditOpen
                            ? (lang === 'ko' ? '※ 기존 제출된 초록은 수정 가능합니다.' : '* Existing submissions can still be edited.')
                            : (lang === 'ko' ? '※ 수정 기간도 마감되어 변경이 불가능합니다.' : '* Editing period has ended.')}
                    </p>
                </div>
            </div>

            <div className="space-y-6">
                {mySubmissions.length === 0 ? (
                    <div className="border border-dashed border-gray-300 rounded-3xl p-12 text-center bg-white">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-10 h-10 text-gray-300" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">
                            {lang === 'ko' ? '제출된 초록이 없습니다' : 'No Submissions Yet'}
                        </h3>
                        <p className="text-gray-500 mb-6">
                            {isSubmissionOpen
                                ? (lang === 'ko' ? '새로운 초록을 등록해주세요.' : 'Start by creating a new submission.')
                                : (lang === 'ko' ? '접수 기간이 아니거나 제출 이력이 없습니다.' : 'No history found.')}
                        </p>
                        {isSubmissionOpen && (
                            <EregiButton
                                variant="outline"
                                onClick={() => onSetStep(1)}
                            >
                                {lang === 'ko' ? '작성하기' : 'Create Now'}
                            </EregiButton>
                        )}
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {mySubmissions.map(sub => (
                            <div key={sub.id} className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-blue-300 transition-all shadow-sm hover:shadow-md group relative">
                                <div className="absolute top-6 right-6">
                                    <Badge className={cn(
                                        "px-3 py-1 rounded-full text-xs font-bold border-0",
                                        sub.reviewStatus === 'accepted_oral' ? 'bg-green-100 text-green-800' :
                                            sub.reviewStatus === 'accepted_poster' ? 'bg-blue-100 text-blue-800' :
                                                sub.reviewStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                                                    'bg-gray-100 text-gray-600'
                                    )}>
                                        {sub.reviewStatus === 'accepted_oral' ? 'Oral Accepted' :
                                            sub.reviewStatus === 'accepted_poster' ? 'Poster Accepted' :
                                                sub.reviewStatus === 'rejected' ? 'Rejected' :
                                                    (lang === 'ko' ? '심사 중 / 접수 완료' : 'Submitted / Under Review')}
                                    </Badge>
                                </div>

                                <div className="pr-24">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                            {sub.field}
                                        </span>
                                        <span className="text-xs font-bold text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                            {sub.type}
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 leading-tight group-hover:text-[#003366] transition-colors mb-2">
                                        {sub.title.ko || sub.title.en}
                                    </h3>
                                    <div className="flex items-center gap-4 text-sm text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-4 h-4" />
                                            {safeFormatDate(sub.submittedAt)}
                                        </span>
                                        {sub.authors && sub.authors.length > 0 && (
                                            <span className="flex items-center gap-1 truncate max-w-[200px]">
                                                <UserPlus className="w-4 h-4" />
                                                {sub.authors.length} Author(s)
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {sub.reviewerComment && (
                                    <div className="mt-4 bg-gray-50 p-4 rounded-xl text-sm border border-gray-200">
                                        <strong className="block text-gray-900 mb-1 flex items-center gap-2">
                                            <MessageSquare className="w-4 h-4" /> Reviewer Feedback
                                        </strong>
                                        <p className="text-gray-700">{sub.reviewerComment}</p>
                                    </div>
                                )}

                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-6 mt-4 border-t border-gray-100 gap-4 sm:gap-0">
                                    <a
                                        href={sub.fileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 text-sm font-semibold text-[#003366] hover:text-[#002244] hover:underline"
                                    >
                                        <FileText className="w-4 h-4" />
                                        {lang === 'ko' ? '초록 원본 다운로드' : 'Download Manuscript'}
                                    </a>

                                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                                        {isEditOpen && (!sub.reviewStatus || sub.reviewStatus === 'submitted' || sub.reviewStatus === 'pending') ? (
                                            <>
                                                <button
                                                    onClick={() => onEdit(sub)}
                                                    className="px-4 py-2 text-sm font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200 w-full sm:w-auto"
                                                >
                                                    {lang === 'ko' ? '수정' : 'Edit'}
                                                </button>
                                                <button
                                                    onClick={() => onDelete(sub.id)}
                                                    className="px-4 py-2 text-sm font-bold text-red-600 bg-white hover:bg-red-50 rounded-lg transition-colors border border-gray-200 hover:border-red-200 w-full sm:w-auto"
                                                >
                                                    {lang === 'ko' ? '삭제' : 'Delete'}
                                                </button>
                                            </>
                                        ) : (
                                            <span className="px-4 py-2 text-sm text-gray-400 font-bold bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center gap-2 w-full sm:w-auto cursor-not-allowed">
                                                <Lock className="w-4 h-4" />
                                                {isEditOpen ? 'Locked' : (lang === 'ko' ? '수정 마감' : 'Deadline Passed')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
};
