import React, { useState } from 'react';
import { useConference } from '../hooks/useConference';
import { useAbstracts } from '../hooks/useAbstracts';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { Loader2, FileText, UploadCloud, Plus, Trash2, CheckCircle2, ChevronRight, AlertCircle, Lock } from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';

const AbstractSubmissionPage: React.FC = () => {
    const { id: confId } = useConference();
    const { auth } = useAuth(confId || '');
    const { submitAbstract, uploading, error, mySubmissions, deleteSubmission } = useAbstracts(confId || '', auth.user?.id);

    const [step, setStep] = useState(1);
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

    if (auth.loading) return <LoadingSpinner />;
    if (!auth.user) return <div style={{ padding: 40, textAlign: 'center' }}>Please Log in to submit abstract</div>;

    return (
        <div className="min-h-screen bg-gray-50/50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                {/* [Step 399-D] UX: Backdrop & Spinner */}
                {uploading && <LoadingSpinner text="Processing Submission..." />}

                {/* [Step 416-D] Success Landing View */}
                {isSuccess ? (
                    <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-xl p-8 sm:p-12 text-center animate-in fade-in zoom-in-95 duration-500 border border-gray-100 mt-8">
                        <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8 relative">
                            <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-20"></div>
                            <CheckCircle2 className="w-12 h-12 text-green-600 relative z-10" />
                        </div>
                        <h1 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">제출이 완료되었습니다!</h1>
                        <p className="text-gray-500 mb-10 text-lg">
                            초록이 안전하게 접수되었습니다.<br />
                            심사 결과는 마이페이지에서 확인 가능합니다.
                        </p>

                        <div className="flex flex-col gap-3 w-full max-w-sm mx-auto">
                            <Button
                                onClick={() => {
                                    // Attempt to view the most recent submission (first in list usually if sorted desc)
                                    const lastSub = mySubmissions[0];
                                    if (lastSub && lastSub.fileUrl) {
                                        window.open(lastSub.fileUrl, '_blank');
                                    } else {
                                        toast("파일을 준비하는 중입니다. 잠시 후 시도해주세요.");
                                    }
                                }}
                                variant="outline"
                                className="h-14 border-2 border-gray-100 hover:border-blue-100 hover:bg-blue-50 text-gray-700 hover:text-[#003366] text-lg font-semibold rounded-xl"
                            >
                                <FileText className="w-5 h-5 mr-2" /> 방금 제출한 초록 보기
                            </Button>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Button
                                    onClick={() => window.location.href = '/mypage'}
                                    variant="outline"
                                    className="h-14 border-2 border-gray-100 hover:border-gray-300 text-gray-600 font-bold rounded-xl"
                                >
                                    마이페이지
                                </Button>
                                <Button
                                    onClick={() => {
                                        setIsSuccess(false);
                                        setStep(1);
                                        window.scrollTo(0, 0);
                                    }}
                                    className="h-14 bg-[#003366] hover:bg-[#002244] text-white font-bold shadow-lg shadow-blue-900/10 rounded-xl"
                                >
                                    추가 제출
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>

                        {/* Header */}
                        <div className="mb-10 text-center sm:text-left">
                            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                                {editingId ? 'Edit Abstract' : 'Abstract Submission'}
                            </h1>
                            <p className="mt-2 text-gray-500">
                                {editingId ? 'Modify your previously submitted abstract details.' : 'Please fill in the details below to submit your abstract.'}
                            </p>
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
                                        "hidden sm:block text-xs font-semibold mt-2 uppercase tracking-wide",
                                        step === s ? "text-[#003366]" : step > s ? "text-[#003366]" : "text-gray-400"
                                    )}>
                                        {s === 1 ? 'Basic info' : s === 2 ? 'Authors' : 'File Upload'}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Step Content Card */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="p-6 sm:p-8">
                                {/* Step 1: Basic Info */}
                                {step === 1 && (
                                    <div className="space-y-6">
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <Label className="text-gray-700 font-semibold">Presentation Type</Label>
                                                    <select
                                                        value={type}
                                                        onChange={e => setType(e.target.value)}
                                                        className="flex h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003366] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all hover:border-gray-400"
                                                    >
                                                        <option value="Oral">Oral Presentation</option>
                                                        <option value="Poster">Poster Presentation</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-gray-700 font-semibold">Topic / Field</Label>
                                                    <select
                                                        value={field}
                                                        onChange={e => setField(e.target.value)}
                                                        className="flex h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003366] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all hover:border-gray-400"
                                                    >
                                                        <option value="General">General</option>
                                                        <option value="AI">Artificial Intelligence</option>
                                                        <option value="Bio">Bio-Engineering</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-gray-700 font-semibold">Title (Korean)</Label>
                                                <Input
                                                    value={titleKo}
                                                    onChange={e => setTitleKo(e.target.value)}
                                                    placeholder="국문 논문 제목을 입력해 주세요"
                                                    className="h-11 border-gray-300 focus:border-[#003366] focus:ring-[#003366] rounded-lg"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-gray-700 font-semibold">Title (English)</Label>
                                                <Input
                                                    value={titleEn}
                                                    onChange={e => setTitleEn(e.target.value)}
                                                    placeholder="Please enter the abstract title in English"
                                                    className="h-11 border-gray-300 focus:border-[#003366] focus:ring-[#003366] rounded-lg"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-end pt-4">
                                            <Button onClick={() => setStep(2)} className="bg-[#003366] hover:bg-[#002244] text-white px-8 h-11 text-base font-medium rounded-lg shadow-sm transition-all hover:shadow-md">
                                                Next : Review Authors <ChevronRight className="w-4 h-4 ml-2" />
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Step 2: Authors */}
                                {step === 2 && (
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-bold text-gray-800">Authors Information</h3>
                                            <Button variant="outline" size="sm" onClick={handleAddAuthor} className="border-dashed border-gray-300 hover:border-[#003366] hover:text-[#003366] bg-gray-50/50">
                                                <Plus className="w-4 h-4 mr-2" /> Add Co-Author
                                            </Button>
                                        </div>

                                        <div className="space-y-4">
                                            {authors.map((author, idx) => (
                                                <div key={idx} className="relative group bg-white border border-gray-200 rounded-xl p-6 hover:border-blue-300 transition-all shadow-sm hover:shadow-md pl-10 sm:pl-6">
                                                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gray-100 group-hover:bg-[#003366] rounded-l-xl transition-colors"></div>
                                                    <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs text-gray-500 uppercase font-bold tracking-wider">Name</Label>
                                                            <Input
                                                                placeholder="Name"
                                                                value={author.name}
                                                                onChange={e => handleAuthorChange(idx, 'name', e.target.value)}
                                                                className="h-10 border-gray-200 bg-gray-50/50 focus:bg-white transition-colors"
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs text-gray-500 uppercase font-bold tracking-wider">Email</Label>
                                                            <Input
                                                                placeholder="Email address"
                                                                value={author.email}
                                                                onChange={e => handleAuthorChange(idx, 'email', e.target.value)}
                                                                className="h-10 border-gray-200 bg-gray-50/50 focus:bg-white transition-colors"
                                                            />
                                                        </div>
                                                        <div className="md:col-span-2 space-y-1.5">
                                                            <Label className="text-xs text-gray-500 uppercase font-bold tracking-wider">Affiliation</Label>
                                                            <Input
                                                                placeholder="Institution / Organization"
                                                                value={author.affiliation}
                                                                onChange={e => handleAuthorChange(idx, 'affiliation', e.target.value)}
                                                                className="h-10 border-gray-200 bg-gray-50/50 focus:bg-white transition-colors"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-gray-100 mt-2">
                                                        <div className="flex flex-wrap gap-6 w-full sm:w-auto p-2 bg-gray-50/50 rounded-lg sm:bg-transparent sm:p-0">
                                                            <label className="flex items-center space-x-2 cursor-pointer group/chk select-none">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={author.isPresenter}
                                                                    onChange={e => handleAuthorChange(idx, 'isPresenter', e.target.checked)}
                                                                    className="w-4 h-4 rounded border-gray-300 text-[#003366] focus:ring-[#003366]"
                                                                />
                                                                <span className="text-sm font-bold text-gray-700 group-hover/chk:text-[#003366] transition-colors">Presenter</span>
                                                            </label>
                                                            <label className="flex items-center space-x-2 cursor-pointer group/chk select-none">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={author.isFirstAuthor}
                                                                    onChange={e => handleAuthorChange(idx, 'isFirstAuthor', e.target.checked)}
                                                                    className="w-4 h-4 rounded border-gray-300 text-[#003366] focus:ring-[#003366]"
                                                                />
                                                                <span className="text-sm font-bold text-gray-700 group-hover/chk:text-[#003366] transition-colors">First Author</span>
                                                            </label>
                                                        </div>
                                                        {authors.length > 1 && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => {
                                                                    const newAuthors = authors.filter((_, i) => i !== idx);
                                                                    setAuthors(newAuthors);
                                                                }}
                                                                className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 self-end sm:self-auto"
                                                            >
                                                                <Trash2 className="w-4 h-4 mr-1.5" /> Remove Card
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex justify-between pt-6">
                                            <Button variant="outline" onClick={() => setStep(1)} className="h-11 px-6">Back</Button>
                                            <Button onClick={() => setStep(3)} className="bg-[#003366] hover:bg-[#002244] text-white h-11 px-8 rounded-lg shadow-sm">
                                                Next : Upload File <ChevronRight className="w-4 h-4 ml-2" />
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Step 3: File */}
                                {step === 3 && (
                                    <div className="space-y-8 animate-in fade-in duration-500">
                                        <div className="text-center space-y-2">
                                            <h3 className="text-lg font-bold text-gray-900">Upload Manuscript</h3>
                                            <p className="text-sm text-gray-500">Supported formats: PDF, DOC, DOCX</p>
                                        </div>

                                        <div className="relative group">
                                            <input
                                                type="file"
                                                accept=".pdf,.doc,.docx"
                                                onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            />
                                            <div className={cn(
                                                "border-2 border-dashed rounded-xl p-10 transition-all text-center flex flex-col items-center justify-center gap-4",
                                                file ? "border-[#003366] bg-blue-50/50" : "border-gray-300 hover:border-gray-400 bg-gray-50"
                                            )}>
                                                <div className={cn(
                                                    "w-16 h-16 rounded-full flex items-center justify-center transition-all",
                                                    file ? "bg-white text-[#003366] shadow-sm" : "bg-white text-gray-400 group-hover:scale-110"
                                                )}>
                                                    {file ? <FileText className="w-8 h-8" /> : <UploadCloud className="w-8 h-8" />}
                                                </div>
                                                <div>
                                                    {file ? (
                                                        <>
                                                            <p className="text-lg font-bold text-[#003366]">{file.name}</p>
                                                            <p className="text-sm text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                                            <p className="text-xs text-blue-400 mt-2 font-medium">Click or Drag to replace</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p className="text-lg font-semibold text-gray-700">Drag & Drop your file here</p>
                                                            <p className="text-sm text-gray-400 mt-1">or click to browse from specific folder</p>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {editingId && !file && (
                                            <div className="flex items-center gap-3 p-4 bg-amber-50 text-amber-800 rounded-lg text-sm border border-amber-200">
                                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                                <p>You work in <strong>Edit Mode</strong>. If you don't upload a new file, the previously submitted file will be kept.</p>
                                            </div>
                                        )}

                                        {error && (
                                            <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-100 text-center animate-shake">
                                                {error}
                                            </div>
                                        )}

                                        <div className="flex justify-between pt-4">
                                            <Button variant="outline" onClick={() => setStep(2)} className="h-11 px-6">Back</Button>
                                            <Button
                                                onClick={handleSubmit}
                                                disabled={uploading}
                                                className={cn(
                                                    "min-w-[160px] h-11 text-base font-bold shadow-md transition-all",
                                                    editingId ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-[#003366] hover:bg-[#002244] text-white"
                                                )}
                                            >
                                                {uploading ? (
                                                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing...</>
                                                ) : (
                                                    editingId ? 'Update Abstract' : 'Submit Abstract'
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* My Submissions */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                                <h2 className="text-xl font-bold text-gray-900">Submission History</h2>
                                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">{mySubmissions.length} Items</span>
                            </div>

                            {mySubmissions.length === 0 ? (
                                <EmptyState
                                    icon={FileText}
                                    title="No Submissions Yet"
                                    description="Complete the form above to submit your first abstract."
                                />
                            ) : (
                                <div className="grid gap-4">
                                    {mySubmissions.map(sub => (
                                        <div key={sub.id} className="bg-white border border-gray-200 hover:border-blue-300 rounded-xl p-6 shadow-sm hover:shadow-md transition-all group">
                                            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge className="bg-blue-50 text-[#003366] border-blue-100 hover:bg-blue-100">
                                                            {sub.field}
                                                        </Badge>
                                                        <Badge variant="outline" className="text-gray-500 border-gray-300">
                                                            {sub.type}
                                                        </Badge>
                                                    </div>
                                                    <h3 className="text-lg font-bold text-gray-900 leading-snug group-hover:text-[#003366] transition-colors">
                                                        {sub.title.ko || sub.title.en}
                                                    </h3>
                                                    <p className="text-sm text-gray-500 mt-1">
                                                        Submitted on: {sub.submittedAt ? sub.submittedAt.toDate().toLocaleDateString() : '-'}
                                                    </p>
                                                </div>
                                                <div className={cn(
                                                    "px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 whitespace-nowrap",
                                                    sub.reviewStatus === 'accepted_oral' ? 'bg-green-100 text-green-800' :
                                                        sub.reviewStatus === 'accepted_poster' ? 'bg-blue-100 text-blue-800' :
                                                            sub.reviewStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                                                                'bg-gray-100 text-gray-600'
                                                )}>
                                                    {sub.reviewStatus === 'accepted_oral' ? <><CheckCircle2 className="w-4 h-4" /> Oral Accepted</> :
                                                        sub.reviewStatus === 'accepted_poster' ? <><CheckCircle2 className="w-4 h-4" /> Poster Accepted</> :
                                                            sub.reviewStatus === 'rejected' ? 'Rejected' : 'Under Review'}
                                                </div>
                                            </div>

                                            {sub.reviewerComment && (
                                                <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 border-l-4 border-gray-300 mb-4 animate-in fade-in">
                                                    <strong className="block text-gray-900 mb-1">Reviewer's Note:</strong>
                                                    {sub.reviewerComment}
                                                </div>
                                            )}

                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-4 border-t border-gray-100 gap-4 sm:gap-0">
                                                <a
                                                    href={sub.fileUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-sm font-semibold text-[#003366] hover:underline flex items-center gap-2"
                                                >
                                                    <FileText className="w-4 h-4" /> Download Abstract
                                                </a>

                                                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                                    {(!sub.reviewStatus || sub.reviewStatus === 'submitted' || sub.reviewStatus === 'pending') ? (
                                                        <>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleEdit(sub)}
                                                                className="h-10 sm:h-8 w-full sm:w-auto text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                                                            >
                                                                Edit
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => deleteSubmission && deleteSubmission(sub.id)}
                                                                className="h-10 sm:h-8 w-full sm:w-auto text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                                            >
                                                                Delete
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 font-medium italic flex items-center gap-1 self-end sm:self-auto">
                                                            <Lock className="w-3 h-3" /> Locked
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
                )}
            </div>
        </div>
    );
};

export default AbstractSubmissionPage;
