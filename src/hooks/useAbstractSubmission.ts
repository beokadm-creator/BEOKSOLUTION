import { useState, useEffect } from 'react';
import { useConference } from '@/hooks/useConference';
import { useAbstracts } from '@/hooks/useAbstracts';
import { useAuth } from '@/hooks/useAuth';
import { useSearchParams } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import toast from 'react-hot-toast';

/** Extended author type used in the submission form (includes isFirstAuthor). */
export interface AuthorData {
    name: string;
    email: string;
    affiliation: string;
    isPresenter: boolean;
    isFirstAuthor: boolean;
}

const DEFAULT_AUTHORS: AuthorData[] = [
    { name: '', email: '', affiliation: '', isPresenter: true, isFirstAuthor: true }
];

export const useAbstractSubmission = () => {
    const { id: confId, slug, info: conferenceInfo } = useConference();
    const { auth } = useAuth();
    const { submitAbstract, uploading, error, mySubmissions, deleteSubmission } = useAbstracts(
        confId || undefined,
        auth.user?.id
    );
    const [searchParams] = useSearchParams();
    const lang = searchParams.get('lang') || 'ko';

    const submitterId = auth.user?.id;

    const now = new Date();
    const submissionDeadline = conferenceInfo?.abstractSubmissionDeadline?.toDate();
    const editDeadline = conferenceInfo?.abstractEditDeadline?.toDate();
    const isSubmissionOpen = submissionDeadline ? now <= submissionDeadline : true;
    const isEditOpen = editDeadline ? now <= editDeadline : true;

    const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
    const [checkingRegistration, setCheckingRegistration] = useState(true);

    useEffect(() => {
        const checkPaymentStatus = async () => {
            if (!confId || !auth.user?.id) {
                setCheckingRegistration(false);
                return;
            }

            try {
                const participationsRef = collection(db, 'users', auth.user.id, 'participations');
                const q = query(participationsRef, where('conferenceId', '==', confId));
                const snap = await getDocs(q);

                let isPaid = false;
                if (!snap.empty) {
                    const docData = snap.docs[0].data();
                    const paymentStatus = docData?.paymentStatus || docData?.status || 'PENDING';
                    isPaid = paymentStatus === 'PAID' || paymentStatus === 'COMPLETED';
                }

                setIsRegistered(isPaid);
            } catch (err) {
                console.error('[AbstractSubmissionPage] 등록 상태 확인 오류:', err);
                setIsRegistered(false);
            } finally {
                setCheckingRegistration(false);
            }
        };

        checkPaymentStatus();
    }, [confId, auth.user?.id]);

    const [step, setStep] = useState(0);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);

    const [titleKo, setTitleKo] = useState('');
    const [titleEn, setTitleEn] = useState('');
    const [field, setField] = useState('General');
    const [type, setType] = useState('Oral');

    const [authors, setAuthors] = useState<AuthorData[]>(DEFAULT_AUTHORS);

    const [file, setFile] = useState<File | null>(null);

    const handleAddAuthor = () => {
        setAuthors([...authors, { name: '', email: '', affiliation: '', isPresenter: false, isFirstAuthor: false }]);
    };

    const handleAuthorChange = (idx: number, field: string, value: string | boolean) => {
        const newAuthors = [...authors];
        (newAuthors[idx] as Record<string, string | boolean>)[field] = value;
        setAuthors(newAuthors);
    };

    const handleRemoveAuthor = (idx: number) => {
        const newAuthors = authors.filter((_, i) => i !== idx);
        setAuthors(newAuthors);
    };

    const handleEdit = (sub: Record<string, unknown>) => {
        setEditingId(sub.id);
        setTitleKo(sub.title?.ko || '');
        setTitleEn(sub.title?.en || '');
        setField(sub.field || 'General');
        setType(sub.type || 'Oral');
        setAuthors((sub.authors || []).map(a => ({
            name: a.name || '',
            email: a.email || '',
            affiliation: a.affiliation || '',
            isPresenter: a.isPresenter || false,
            isFirstAuthor: (a as { isFirstAuthor?: boolean }).isFirstAuthor || false
        })));
        setStep(1);
        window.scrollTo(0, 0);
        toast("Editing mode activated");
    };

    const resetForm = () => {
        setEditingId(null);
        setTitleKo('');
        setTitleEn('');
        setField('General');
        setType('Oral');
        setAuthors(DEFAULT_AUTHORS);
        setFile(null);
    };

    const startNewSubmission = () => {
        resetForm();
        setStep(1);
    };

    const handleSubmit = async () => {
        if (!editingId && !file) return toast.error('Please select a file');

        const success = await submitAbstract({
            title: { ko: titleKo, en: titleEn },
            field,
            type,
            authors
        }, file, editingId || undefined);

        if (success) {
            toast.success(editingId ? 'Abstract Updated!' : 'Abstract Submitted Successfully!');
            resetForm();

            if (!editingId) {
                setIsSuccess(true);
                window.scrollTo(0, 0);
            } else {
                setStep(1);
            }
        } else {
            toast.error('Submission Failed');
        }
    };

    return {
        slug,
        auth,
        submitterId,
        lang,
        authLoading: auth.loading,
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
    };
};
