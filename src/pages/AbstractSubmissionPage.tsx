import React, { useState, useEffect } from 'react';
import { useConference } from '../hooks/useConference';
import { useAbstracts } from '../hooks/useAbstracts';
import { useAuth } from '../hooks/useAuth';
import { useNonMemberAuth } from '../hooks/useNonMemberAuth';
import toast from 'react-hot-toast';
import { Loader2, FileText, UploadCloud, Plus, Trash2, CheckCircle2, ChevronRight, AlertCircle, Lock, ChevronLeft, Calendar, UserPlus, MessageSquare, X, ArrowRight } from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { Button } from '../components/ui/button';
import { EregiButton, EregiInput, EregiCard } from '../components/eregi/EregiForm';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

const AbstractSubmissionPage: React.FC = () => {
    const { id: confId, slug, info: conferenceInfo } = useConference();
    const { auth } = useAuth(confId || '');
    const { nonMember, loading: nonMemberLoading } = useNonMemberAuth(confId);

    // [FIX] Priority: Use non-member registration ID over anonymous user ID
    // Anonymous users don't have name/email/phone/org data, which causes display issues
    // Non-member registrations should use registrationId as the submitter ID
    const submitterId = nonMember?.registrationId || auth.user?.id;

    // Deadline checks
    const now = new Date();
    const submissionDeadline = conferenceInfo?.abstractSubmissionDeadline?.toDate();
    const editDeadline = conferenceInfo?.abstractEditDeadline?.toDate();
    const isSubmissionOpen = submissionDeadline ? now <= submissionDeadline : true;
    const isEditOpen = editDeadline ? now <= editDeadline : true;

    // [Fix] Pass both IDs to support OR query in hook
    const { submitAbstract, uploading, error, mySubmissions, deleteSubmission } = useAbstracts(
        confId || undefined,
        auth.user?.id,
        nonMember?.registrationId
    );
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const lang = searchParams.get('lang') || 'ko';

    // 등록 상태 확인
    const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
    const [checkingRegistration, setCheckingRegistration] = useState(true);

    // 로그인 사용자 정보 로그
    useEffect(() => {
        if (auth.user) {
            console.log('[AbstractSubmissionPage] Logged in user:', {
                id: auth.user.id,
                uid: auth.user.uid,
                name: auth.user.name,
                email: auth.user.email,
                displayName: (auth.user as any).displayName
            });
        }
        if (nonMember) {
            console.log('[AbstractSubmissionPage] Non-member info:', {
                registrationId: nonMember.registrationId,
                email: nonMember.email,
                name: nonMember.name
            });
        }
    }, [auth.user, nonMember]);

    // 결제 완료 여부 확인
    useEffect(() => {
        const checkPaymentStatus = async () => {
            if (!confId) {
                setCheckingRegistration(false);
                return;
            }

            try {
                let isPaid = false;

                if (auth.user) {
                    // 회원: userId로 등록 내역 확인
                    const regRef = collection(db, `conferences/${confId}/registrations`);
                    const q = query(regRef, where('userId', '==', auth.user.id), where('status', '==', 'PAID'));
                    const snap = await getDocs(q);
                    isPaid = !snap.empty;
                } else if (nonMember?.registrationId) {
                    // 비회원: registrationId로 등록 내역 확인
                    const regDoc = await getDoc(doc(db, `conferences/${confId}/registrations`, nonMember.registrationId));
                    if (regDoc.exists()) {
                        const data = regDoc.data();
                        isPaid = data.status === 'PAID';
                    }
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
    }, [confId, auth.user, nonMember?.registrationId]);

    const [step, setStep] = useState(0); // 0 = History View, 1-3 = Edit Form Steps
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);

    // Step 1: Meta
    const [titleKo, setTitleKo] = useState('');
    const [titleEn, setTitleEn] = useState('');
    const [field, setField] = useState('General');
    const [type, setType] = useState('Oral');

    // Step 2: Authors
    const [authors, setAuthors] = useState([{ name: '', email: '', affiliation: '', isPresenter: true, isFirstAuthor: true }]);

    // Step 3: File
    const [file, setFile] = useState<File | null>(null);

    const handleAddAuthor = () => {
        setAuthors([...authors, { name: '', email: '', affiliation: '', isPresenter: false, isFirstAuthor: false }]);
    };

    const handleAuthorChange = (idx: number, field: string, value: any) => {
        const newAuthors = [...authors];
        (newAuthors[idx] as any)[field] = value;
        setAuthors(newAuthors);
    };

    const handleEdit = (sub: any) => {
        setEditingId(sub.id);
        setTitleKo(sub.title?.ko || '');
        setTitleEn(sub.title?.en || '');
        setField(sub.field || 'General');
        setType(sub.type || 'Oral');
        setAuthors(sub.authors || []);
        setStep(1); // Go to step 1
        window.scrollTo(0, 0);
        toast("Editing mode activated");
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

            // Reset Form Data
            setEditingId(null);
            setTitleKo('');
            setTitleEn('');
            setField('General');
            setType('Oral');
            setAuthors([{ name: '', email: '', affiliation: '', isPresenter: true, isFirstAuthor: true }]);
            setFile(null);

            // Enable Success View (Logic: If not editing, show success landing)
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

    if (auth.loading || nonMemberLoading || checkingRegistration) return <LoadingSpinner />;

    // Auth Check
    if (!submitterId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Lock size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
                    <p className="text-gray-500 mb-8">
                        {lang === 'ko'
                            ? '초록을 제출하려면 로그인이 필요합니다.'
                            : 'You must be logged in to submit an abstract.'}
                    </p>

                    <div className="space-y-3">
                        <EregiButton
                            className="w-full justify-center"
                            onClick={() => navigate(`/${slug}/auth?mode=login&returnUrl=/${slug}/abstracts&lang=${lang}`)}
                        >
                            {lang === 'ko' ? '로그인 (회원)' : 'Login (Member)'}
                        </EregiButton>
                        <EregiButton
                            variant="secondary"
                            className="w-full justify-center"
                            onClick={() => navigate(`/${slug}/check-status?returnUrl=/${slug}/abstracts&lang=${lang}`)}
                        >
                            {lang === 'ko' ? '비회원 인증' : 'Non-Member Auth'}
                        </EregiButton>
                    </div>
                </div>
            </div>
        );
    }

    // Registration/Payment Check
    if (isRegistered === false) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertCircle size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {lang === 'ko' ? '등록이 필요합니다' : 'Registration Required'}
                    </h2>
                    <p className="text-gray-500 mb-8">
                        {lang === 'ko'
                            ? '초록 제출을 위해서는 학술대회 등록과 결제가 완료되어야 합니다.'
                            : 'You must complete conference registration and payment to submit an abstract.'}
                    </p>

                    <div className="space-y-3">
                        <EregiButton
                            className="w-full justify-center"
                            onClick={() => navigate(`/${slug}/register?lang=${lang}`)}
                        >
                            {lang === 'ko' ? '등록하기 (Register)' : 'Register Now'}
                        </EregiButton>
                        <EregiButton
                            variant="secondary"
                            className="w-full justify-center"
                            onClick={() => navigate(`/${slug}`)}
                        >
                            {lang === 'ko' ? '홈으로 이동' : 'Go to Home'}
                        </EregiButton>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50/50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                {/* [Step 399-D] UX: Backdrop & Spinner */}
                {uploading && <LoadingSpinner text="Processing Submission..." />}

                {/* Header: Back Button + User Profile */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    {/* Back Button */}
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

                    {/* User Profile Display */}
                    <div className="flex items-center gap-2 text-sm">
                        {auth.user ? (
                            <>
                                <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-200 px-2.5 py-0.5 rounded-full">
                                    {lang === 'ko' ? '회원' : 'Member'}
                                </Badge>
                                <span className="font-bold text-gray-900">{auth.user.name}</span>
                                <span className="text-gray-50">({auth.user.organization || (lang === 'ko' ? '소속 없음' : 'No affiliation')})</span>
                            </>
                        ) : nonMember ? (
                            <>
                                <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200 px-2.5 py-0.5 rounded-full">
                                    {lang === 'ko' ? '비회원' : 'Non-Member'}
                                </Badge>
                                <span className="font-bold text-gray-900">{nonMember.name}</span>
                                <span className="text-gray-500">({nonMember.email})</span>
                            </>
                        ) : null}
                    </div>
                </div>

                {/* [Step 416-D] Success Landing View */}
                {isSuccess ? (
                    <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-xl p-8 sm:p-12 text-center animate-in fade-in zoom-in-95 duration-500 border border-gray-100 mt-8">
                        <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8 relative">
                            <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-20"></div>
                            <CheckCircle2 className="w-12 h-12 text-green-600 relative z-10" />
                        </div>
                        <h1 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">
                            {lang === 'ko' ? '제출이 완료되었습니다!' : 'Submission Complete!'}
                        </h1>
                        <p className="text-gray-500 mb-10 text-lg leading-relaxed">
                            {lang === 'ko'
                                ? '초록이 성공적으로 접수되었습니다.<br />심사 결과는 추후 마이페이지에서 확인 가능합니다.'
                                : 'Your abstract has been successfully submitted.<br />Review results will be available on My Page.'}
                        </p>

                        <div className="flex flex-col gap-3 w-full max-w-sm mx-auto">
                            <EregiButton
                                onClick={() => {
                                    setIsSuccess(false);
                                    setStep(0);
                                    window.scrollTo(0, 0);
                                }}
                                className="h-14 bg-[#003366] hover:bg-[#002244] text-white font-bold shadow-lg shadow-blue-900/10 rounded-xl justify-center text-lg"
                            >
                                {lang === 'ko' ? '제출 내역 확인하기' : 'View Submissions'}
                            </EregiButton>

                            <EregiButton
                                onClick={() => window.location.href = nonMember ? `/${slug}/non-member/hub` : '/mypage'}
                                variant="outline"
                                className="h-14 border-2 border-gray-100 hover:border-gray-300 text-gray-600 font-bold rounded-xl justify-center"
                            >
                                {lang === 'ko' ? '마이페이지로 이동' : 'Go to My Page'}
                            </EregiButton>
                        </div>
                    </div>
                ) : step === 0 ? (
                    // ---------------------------------------------------------------------------
                    // DASHBOARD VIEW (History List)
                    // ---------------------------------------------------------------------------
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

                            {/* [Step 31] New Submission Button - Only visible if submission deadline active */}
                            {isSubmissionOpen && (
                                <EregiButton
                                    onClick={() => {
                                        setEditingId(null);
                                        setTitleKo('');
                                        setTitleEn('');
                                        setField('General');
                                        setType('Oral');
                                        setAuthors([{ name: '', email: '', affiliation: '', isPresenter: true, isFirstAuthor: true }]);
                                        setFile(null);
                                        setStep(1);
                                    }}
                                    className="h-11 bg-[#003366] hover:bg-[#002244] text-white shadow-md hover:shadow-lg transition-all rounded-xl px-5 flex-shrink-0"
                                >
                                    <Plus className="w-5 h-5 mr-2" />
                                    {lang === 'ko' ? '새 초록 등록하기' : 'New Submission'}
                                </EregiButton>
                            )}
                        </div>

                        {/* Deadline Status Banner */}
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
                                        : (lang === 'ko' ? '현재 초록 접수 기간입니다.' : 'Abstract submission is currently OPEN.')
                                    }
                                </h3>
                                <p className="text-sm text-gray-500">
                                    {isEditOpen
                                        ? (lang === 'ko' ? '※ 기존 제출된 초록은 수정 가능합니다.' : '* Existing submissions can still be edited.')
                                        : (lang === 'ko' ? '※ 수정 기간도 마감되어 변경이 불가능합니다.' : '* Editing period has ended.')
                                    }
                                </p>
                            </div>
                        </div>

                        {/* Submission List */}
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
                                            : (lang === 'ko' ? '접수 기간이 아니거나 제출 이력이 없습니다.' : 'No history found.')
                                        }
                                    </p>
                                    {isSubmissionOpen && (
                                        <EregiButton
                                            variant="outline"
                                            onClick={() => setStep(1)}
                                        >
                                            {lang === 'ko' ? '작성하기' : 'Create Now'}
                                        </EregiButton>
                                    )}
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {mySubmissions.map(sub => (
                                        <div key={sub.id} className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-blue-300 transition-all shadow-sm hover:shadow-md group relative">
                                            {/* Status Badge (Top Right) */}
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
                                                        {sub.submittedAt ? sub.submittedAt.toDate().toLocaleDateString() : '-'}
                                                    </span>
                                                    {/* Authors Summary */}
                                                    {sub.authors && sub.authors.length > 0 && (
                                                        <span className="flex items-center gap-1 truncate max-w-[200px]">
                                                            <UserPlus className="w-4 h-4" />
                                                            {sub.authors.length} Author(s)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Reviewer Comment Section */}
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
                                                                onClick={() => handleEdit(sub)}
                                                                className="px-4 py-2 text-sm font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200 w-full sm:w-auto"
                                                            >
                                                                {lang === 'ko' ? '수정' : 'Edit'}
                                                            </button>
                                                            <button
                                                                onClick={() => deleteSubmission && deleteSubmission(sub.id)}
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
                ) : (
                    // ---------------------------------------------------------------------------
                    // FORM VIEW (New / Edit)
                    // ---------------------------------------------------------------------------
                    <div className="animate-in slide-in-from-right-8 duration-500">
                        {/* Header */}
                        <div className="mb-8 text-center sm:text-left flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                                    {editingId ? (lang === 'ko' ? '초록 수정' : 'Edit Abstract') : (lang === 'ko' ? '새 초록 등록' : 'New Abstract')}
                                </h1>
                                <p className="mt-1 text-gray-500">
                                    {lang === 'ko'
                                        ? '정확한 정보를 입력하여 주시기 바랍니다.'
                                        : 'Please fill in the information accurately.'}
                                </p>
                            </div>
                            <button
                                onClick={() => setStep(0)}
                                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"
                                aria-label="Cancel"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Stepper (Visual Only) */}
                        <div className="mb-8 p-4 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-between relative overflow-hidden">
                            <div className="absolute left-0 top-1/2 w-full h-0.5 bg-gray-100 -z-0"></div>
                            {[1, 2, 3].map((s) => (
                                <div key={s} className="relative z-10 flex flex-col items-center bg-white px-2 sm:px-4">
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-2",
                                        step === s ? "border-[#003366] bg-white text-[#003366] ring-4 ring-blue-50 shadow-md transform scale-110" :
                                            step > s ? "border-[#003366] bg-[#003366] text-white" : "border-gray-100 bg-gray-100 text-gray-400"
                                    )}>
                                        {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
                                    </div>
                                    <span className={cn(
                                        "hidden sm:block text-xs font-bold mt-2 uppercase tracking-wide",
                                        step === s ? "text-[#003366]" : step > s ? "text-[#003366]" : "text-gray-300"
                                    )}>
                                        {s === 1 ? 'Basic Info' : s === 2 ? 'Authors' : 'Upload'}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Step Content Card */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-12">
                            <div className="p-6 sm:p-8">
                                {/* Step 1: Basic Info */}
                                {step === 1 && (
                                    <div className="space-y-8">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                                <label className="text-sm font-bold text-gray-900 block">Presentation Type</label>
                                                <select
                                                    value={type}
                                                    onChange={e => setType(e.target.value)}
                                                    className="w-full h-12 rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                                                >
                                                    <option value="Oral">Oral Presentation</option>
                                                    <option value="Poster">Poster Presentation</option>
                                                </select>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-sm font-bold text-gray-900 block">Topic / Field</label>
                                                <select
                                                    value={field}
                                                    onChange={e => setField(e.target.value)}
                                                    className="w-full h-12 rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                                                >
                                                    <option value="General">General</option>
                                                    <option value="AI">Artificial Intelligence</option>
                                                    <option value="Bio">Bio-Engineering</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <EregiInput
                                                label="Title (Korean)"
                                                value={titleKo}
                                                onChange={e => setTitleKo(e.target.value)}
                                                placeholder="국문 논문 제목을 입력해 주세요"
                                                className="h-12 text-lg font-medium"
                                            />
                                            <EregiInput
                                                label="Title (English)"
                                                value={titleEn}
                                                onChange={e => setTitleEn(e.target.value)}
                                                placeholder="Please enter the abstract title in English"
                                                className="h-12 text-lg font-medium"
                                            />
                                        </div>

                                        <div className="flex justify-end pt-6 border-t border-gray-100">
                                            <EregiButton onClick={() => setStep(2)} className="h-12 px-8 text-base font-bold bg-[#003366] hover:bg-[#002244] rounded-xl shadow-lg shadow-blue-900/10">
                                                Next Step <ArrowRight className="w-5 h-5 ml-2" />
                                            </EregiButton>
                                        </div>
                                    </div>
                                )}

                                {/* Step 2: Authors */}
                                {step === 2 && (
                                    <div className="space-y-8">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-bold text-gray-900">Authors Information</h3>
                                            <button
                                                onClick={handleAddAuthor}
                                                className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors"
                                            >
                                                <Plus className="w-4 h-4" /> Add Co-Author
                                            </button>
                                        </div>

                                        <div className="space-y-6">
                                            {authors.map((author, idx) => (
                                                <div key={idx} className="relative group bg-white border border-gray-200 rounded-2xl p-6 hover:border-blue-300 transition-all shadow-sm pl-10 sm:pl-8">
                                                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-gray-100 group-hover:bg-[#003366] rounded-l-2xl transition-colors"></div>

                                                    {/* Author Number Badge */}
                                                    <div className="absolute left-[-12px] top-6 w-6 h-6 bg-white border-2 border-gray-200 group-hover:border-[#003366] rounded-full flex items-center justify-center text-xs font-bold text-gray-400 group-hover:text-[#003366] z-10">
                                                        {idx + 1}
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                                                        <EregiInput
                                                            label="Name"
                                                            placeholder="Full Name"
                                                            value={author.name}
                                                            onChange={e => handleAuthorChange(idx, 'name', e.target.value)}
                                                            className="bg-gray-50 border-gray-200 focus:bg-white"
                                                        />
                                                        <EregiInput
                                                            label="Email"
                                                            placeholder="Email Address"
                                                            value={author.email}
                                                            onChange={e => handleAuthorChange(idx, 'email', e.target.value)}
                                                            className="bg-gray-50 border-gray-200 focus:bg-white"
                                                        />
                                                        <div className="md:col-span-2">
                                                            <EregiInput
                                                                label="Affiliation"
                                                                placeholder="Institution / Organization"
                                                                value={author.affiliation}
                                                                onChange={e => handleAuthorChange(idx, 'affiliation', e.target.value)}
                                                                className="bg-gray-50 border-gray-200 focus:bg-white"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100">
                                                        <div className="flex gap-4 w-full sm:w-auto">
                                                            <label className="flex items-center space-x-2 cursor-pointer select-none px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={author.isPresenter}
                                                                    onChange={e => handleAuthorChange(idx, 'isPresenter', e.target.checked)}
                                                                    className="w-4 h-4 rounded border-gray-300 text-[#003366] focus:ring-[#003366]"
                                                                />
                                                                <span className="text-sm font-bold text-gray-700">Presenter</span>
                                                            </label>
                                                            <label className="flex items-center space-x-2 cursor-pointer select-none px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={author.isFirstAuthor}
                                                                    onChange={e => handleAuthorChange(idx, 'isFirstAuthor', e.target.checked)}
                                                                    className="w-4 h-4 rounded border-gray-300 text-[#003366] focus:ring-[#003366]"
                                                                />
                                                                <span className="text-sm font-bold text-gray-700">First Author</span>
                                                            </label>
                                                        </div>
                                                        {authors.length > 1 && (
                                                            <button
                                                                onClick={() => {
                                                                    const newAuthors = authors.filter((_, i) => i !== idx);
                                                                    setAuthors(newAuthors);
                                                                }}
                                                                className="text-red-500 hover:text-red-700 text-sm font-bold flex items-center gap-1 px-3 py-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                                            >
                                                                <Trash2 className="w-4 h-4" /> Remove
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex justify-between pt-6 border-t border-gray-100">
                                            <button onClick={() => setStep(1)} className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors">
                                                Back
                                            </button>
                                            <EregiButton onClick={() => setStep(3)} className="h-12 px-8 text-base font-bold bg-[#003366] hover:bg-[#002244] rounded-xl shadow-lg shadow-blue-900/10">
                                                Next Step <ArrowRight className="w-5 h-5 ml-2" />
                                            </EregiButton>
                                        </div>
                                    </div>
                                )}

                                {/* Step 3: File */}
                                {step === 3 && (
                                    <div className="space-y-8 animate-in fade-in duration-500">
                                        <div className="text-center space-y-2">
                                            <h3 className="text-xl font-bold text-gray-900">Upload Manuscript</h3>
                                            <p className="text-gray-500">Supported formats: PDF, DOC, DOCX (Max 10MB)</p>
                                        </div>

                                        <div className="max-w-xl mx-auto">
                                            <div className="relative group">
                                                <input
                                                    type="file"
                                                    accept=".pdf,.doc,.docx"
                                                    onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                                />
                                                <div className={cn(
                                                    "border-2 border-dashed rounded-2xl p-12 transition-all text-center flex flex-col items-center justify-center gap-6",
                                                    file ? "border-[#003366] bg-blue-50/30" : "border-gray-300 hover:border-[#003366]/50 hover:bg-gray-50/50"
                                                )}>
                                                    <div className={cn(
                                                        "w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-sm",
                                                        file ? "bg-white text-[#003366] ring-4 ring-[#003366]/10" : "bg-white text-gray-400 group-hover:scale-110"
                                                    )}>
                                                        {file ? <FileText className="w-10 h-10" /> : <UploadCloud className="w-10 h-10" />}
                                                    </div>
                                                    <div>
                                                        {file ? (
                                                            <>
                                                                <p className="text-xl font-bold text-[#003366] mb-1">{file.name}</p>
                                                                <p className="text-sm text-gray-500 mb-3">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                                                <span className="text-xs text-blue-500 font-bold bg-blue-50 px-3 py-1 rounded-full">
                                                                    Click to replace
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <p className="text-lg font-bold text-gray-700 mb-1">Drag & Drop your file here</p>
                                                                <p className="text-sm text-gray-400">or click to browse</p>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {editingId && !file && (
                                            <div className="flex items-start gap-4 p-4 bg-amber-50 text-amber-800 rounded-xl text-sm border border-amber-200 max-w-xl mx-auto">
                                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                                <p className="leading-relaxed">
                                                    You are in <strong>Edit Mode</strong>. If you do not upload a new file, the previously submitted file will be preserved and linked to this submission.
                                                </p>
                                            </div>
                                        )}

                                        {error && (
                                            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-200 text-center animate-pulse max-w-xl mx-auto">
                                                {error}
                                            </div>
                                        )}

                                        <div className="flex justify-between pt-6 border-t border-gray-100">
                                            <button onClick={() => setStep(2)} className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors">
                                                Back
                                            </button>
                                            <EregiButton
                                                onClick={handleSubmit}
                                                isLoading={uploading}
                                                disabled={uploading}
                                                className={cn(
                                                    "h-12 px-8 text-base font-bold text-white shadow-xl hover:shadow-2xl transition-all rounded-xl",
                                                    editingId ? "bg-amber-600 hover:bg-amber-700" : "bg-green-600 hover:bg-green-700"
                                                )}
                                            >
                                                {uploading ? (
                                                    <span className="flex items-center gap-2">
                                                        <Loader2 className="w-5 h-5 animate-spin" /> Uploading...
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-2">
                                                        {editingId ? <CheckCircle2 className="w-5 h-5" /> : <UploadCloud className="w-5 h-5" />}
                                                        {editingId ? 'Update Submission' : 'Complete Submission'}
                                                    </span>
                                                )}
                                            </EregiButton>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AbstractSubmissionPage;
