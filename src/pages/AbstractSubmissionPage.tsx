import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { Badge } from '@/components/ui/badge';
import { useAbstractSubmission } from '@/hooks/useAbstractSubmission';
import { AccessDeniedView } from '@/components/abstract/AccessDeniedView';
import { RegistrationRequiredView } from '@/components/abstract/RegistrationRequiredView';
import { SubmissionSuccessView } from '@/components/abstract/SubmissionSuccessView';
import { SubmissionDashboard } from '@/components/abstract/SubmissionDashboard';
import { SubmissionForm } from '@/components/abstract/SubmissionForm';

const AbstractSubmissionPage: React.FC = () => {
    const {
        slug,
        auth,
        submitterId,
        lang,
        authLoading,
        checkingRegistration,
        isRegistered,
        isSubmissionOpen,
        isEditOpen,
        uploading,
        error,
        mySubmissions,
        deleteSubmission,
        step,
        setStep,
        editingId,
        isSuccess,
        setIsSuccess,
        titleKo,
        setTitleKo,
        titleEn,
        setTitleEn,
        field,
        setField,
        type,
        setType,
        authors,
        file,
        setFile,
        handleAddAuthor,
        handleAuthorChange,
        handleRemoveAuthor,
        handleEdit,
        handleSubmit,
        startNewSubmission,
    } = useAbstractSubmission();

    const navigate = useNavigate();

    if (authLoading || checkingRegistration) return <LoadingSpinner />;

    if (!submitterId) {
        return <AccessDeniedView slug={slug} lang={lang} />;
    }

    if (isRegistered === false) {
        return <RegistrationRequiredView slug={slug} lang={lang} />;
    }

    const handleViewSubmissions = () => {
        setIsSuccess(false);
        setStep(0);
        window.scrollTo(0, 0);
    };

    const handleDelete = (id: string) => {
        if (deleteSubmission) deleteSubmission(id);
    };

    return (
        <div className="min-h-screen bg-gray-50/50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                {uploading && <LoadingSpinner text="Processing Submission..." />}

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <button
                        className="text-gray-600 hover:bg-gray-100 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors focus:ring-2 focus:ring-gray-200 outline-none"
                        onClick={() => navigate(`/${slug}`)}
                        aria-label="Back to Conference Function"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="text-sm font-medium">
                            {lang === 'ko' ? '학술대회 홈으로' : 'Back to Conference'}
                        </span>
                    </button>

                    <div className="flex items-center gap-2 text-sm">
                        {auth.user ? (
                            <>
                                <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-200 px-2.5 py-0.5 rounded-full">
                                    {lang === 'ko' ? '회원' : 'Member'}
                                </Badge>
                                <span className="font-bold text-gray-900">{auth.user.name}</span>
                                <span className="text-gray-500">({auth.user.organization || (lang === 'ko' ? '소속 없음' : 'No affiliation')})</span>
                            </>
                        ) : null}
                    </div>
                </div>

                {isSuccess ? (
                    <SubmissionSuccessView lang={lang} onViewSubmissions={handleViewSubmissions} />
                ) : step === 0 ? (
                    <SubmissionDashboard
                        lang={lang}
                        isSubmissionOpen={isSubmissionOpen}
                        isEditOpen={isEditOpen}
                        mySubmissions={mySubmissions}
                        onStartNew={startNewSubmission}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onSetStep={setStep}
                    />
                ) : (
                    <SubmissionForm
                        lang={lang}
                        step={step}
                        setStep={setStep}
                        editingId={editingId}
                        uploading={uploading}
                        error={error}
                        titleKo={titleKo}
                        setTitleKo={setTitleKo}
                        titleEn={titleEn}
                        setTitleEn={setTitleEn}
                        field={field}
                        setField={setField}
                        type={type}
                        setType={setType}
                        authors={authors}
                        file={file}
                        setFile={setFile}
                        onAddAuthor={handleAddAuthor}
                        onAuthorChange={handleAuthorChange}
                        onRemoveAuthor={handleRemoveAuthor}
                        onSubmit={handleSubmit}
                    />
                )}
            </div>
        </div>
    );
};

export default AbstractSubmissionPage;
