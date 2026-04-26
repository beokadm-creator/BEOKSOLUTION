import React from 'react';
import { FileText, UploadCloud, Plus, Trash2, CheckCircle2, AlertCircle, Loader2, X, ArrowRight } from 'lucide-react';
import { EregiButton, EregiInput } from '@/components/eregi/EregiForm';
import { cn } from '@/lib/utils';
import type { AuthorData } from '@/hooks/useAbstractSubmission';

interface SubmissionFormProps {
    lang: string;
    step: number;
    setStep: (step: number) => void;
    editingId: string | null;
    uploading: boolean;
    error: string | null;
    titleKo: string;
    setTitleKo: (v: string) => void;
    titleEn: string;
    setTitleEn: (v: string) => void;
    field: string;
    setField: (v: string) => void;
    type: string;
    setType: (v: string) => void;
    authors: AuthorData[];
    file: File | null;
    setFile: (f: File | null) => void;
    onAddAuthor: () => void;
    onAuthorChange: (idx: number, field: string, value: string | boolean) => void;
    onRemoveAuthor: (idx: number) => void;
    onSubmit: () => void;
}

export const SubmissionForm: React.FC<SubmissionFormProps> = ({
    lang,
    step,
    setStep,
    editingId,
    uploading,
    error,
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
    onAddAuthor,
    onAuthorChange,
    onRemoveAuthor,
    onSubmit,
}) => {
    return (
        <div className="animate-in slide-in-from-right-8 duration-500">
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

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-12">
                <div className="p-6 sm:p-8">
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

                    {step === 2 && (
                        <div className="space-y-8">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900">Authors Information</h3>
                                <button
                                    onClick={onAddAuthor}
                                    className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors"
                                >
                                    <Plus className="w-4 h-4" /> Add Co-Author
                                </button>
                            </div>

                            <div className="space-y-6">
                                {authors.map((author, idx) => (
                                    <div key={idx} className="relative group bg-white border border-gray-200 rounded-2xl p-6 hover:border-blue-300 transition-all shadow-sm pl-10 sm:pl-8">
                                        <div className="absolute left-0 top-0 bottom-0 w-2 bg-gray-100 group-hover:bg-[#003366] rounded-l-2xl transition-colors"></div>

                                        <div className="absolute left-[-12px] top-6 w-6 h-6 bg-white border-2 border-gray-200 group-hover:border-[#003366] rounded-full flex items-center justify-center text-xs font-bold text-gray-400 group-hover:text-[#003366] z-10">
                                            {idx + 1}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                                            <EregiInput
                                                label="Name"
                                                placeholder="Full Name"
                                                value={author.name}
                                                onChange={e => onAuthorChange(idx, 'name', e.target.value)}
                                                className="bg-gray-50 border-gray-200 focus:bg-white"
                                            />
                                            <EregiInput
                                                label="Email"
                                                placeholder="Email Address"
                                                value={author.email}
                                                onChange={e => onAuthorChange(idx, 'email', e.target.value)}
                                                className="bg-gray-50 border-gray-200 focus:bg-white"
                                            />
                                            <div className="md:col-span-2">
                                                <EregiInput
                                                    label="Affiliation"
                                                    placeholder="Institution / Organization"
                                                    value={author.affiliation}
                                                    onChange={e => onAuthorChange(idx, 'affiliation', e.target.value)}
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
                                                        onChange={e => onAuthorChange(idx, 'isPresenter', e.target.checked)}
                                                        className="w-4 h-4 rounded border-gray-300 text-[#003366] focus:ring-[#003366]"
                                                    />
                                                    <span className="text-sm font-bold text-gray-700">Presenter</span>
                                                </label>
                                                <label className="flex items-center space-x-2 cursor-pointer select-none px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={author.isFirstAuthor}
                                                        onChange={e => onAuthorChange(idx, 'isFirstAuthor', e.target.checked)}
                                                        className="w-4 h-4 rounded border-gray-300 text-[#003366] focus:ring-[#003366]"
                                                    />
                                                    <span className="text-sm font-bold text-gray-700">First Author</span>
                                                </label>
                                            </div>
                                            {authors.length > 1 && (
                                                <button
                                                    onClick={() => onRemoveAuthor(idx)}
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
                                    onClick={onSubmit}
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
    );
};
