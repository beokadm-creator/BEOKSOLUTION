import React from 'react';
import { FileText, ImageIcon, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { ConferenceData } from '../types';
import toast from 'react-hot-toast';

interface Props {
    data: ConferenceData;
    setData: React.Dispatch<React.SetStateAction<ConferenceData>>;
    uploadingImage: boolean;
    handleImageUpload: (file: File) => Promise<string>;
}

export function WelcomeMessageSection({ data, setData, uploadingImage, handleImageUpload }: Props) {
    const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const url = await handleImageUpload(file);
            setData(prev => ({
                ...prev,
                welcomeMessageImages: [...(prev.welcomeMessageImages || []), url]
            }));
            toast.success('이미지가 추가되었습니다. / Image added');
        } catch {
            // Error already handled in handleImageUpload
        }
    };

    const handleRemoveImage = (index: number) => {
        setData(prev => ({
            ...prev,
            welcomeMessageImages: prev.welcomeMessageImages?.filter((_, i) => i !== index) || []
        }));
    };

    return (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            <div className="lg:col-span-4 space-y-3">
                <div className="flex items-center gap-2">
                    <div className="p-2.5 bg-green-50 rounded-xl text-green-600">
                        <FileText className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">환영사 / 인사말</h2>
                </div>
                <p className="text-slate-500 leading-relaxed text-sm">
                    학술대회 환영사를 작성합니다. 학술대회 페이지에 표시되는 인사말로, 참가자에게 학술대회의 목적과 환영의 메시지를 전달합니다.<br />
                    HTML 형식으로 작성할 수 있으며, 한국어와 영어 각각 입력하세요. 저장 후 즉시 반영됩니다.
                </p>
            </div>

            <div className="lg:col-span-8 space-y-6">
                <Card className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden rounded-2xl">
                    <CardContent className="p-6 md:p-8 space-y-8">
                        {/* Korean Editor */}
                        <div>
                            <Label className="text-base font-medium text-slate-700 mb-2 block">
                                한국어 인사말 / Korean
                            </Label>
                            <RichTextEditor
                                value={data.welcomeMessage.ko}
                                onChange={(value) => setData(prev => ({
                                    ...prev,
                                    welcomeMessage: { ...prev.welcomeMessage, ko: value }
                                }))}
                                placeholder="환영사를 작성해주세요. 학술대회 참가자들에게 전하는 인사말입니다..."
                            />
                        </div>

                        {/* English Editor */}
                        <div>
                            <Label className="text-base font-medium text-slate-700 mb-2 block">
                                영어 인사말 / English
                            </Label>
                            <RichTextEditor
                                value={data.welcomeMessage.en}
                                onChange={(value) => setData(prev => ({
                                    ...prev,
                                    welcomeMessage: { ...prev.welcomeMessage, en: value }
                                }))}
                                placeholder="e.g. Dear Colleagues and Friends..."
                            />
                        </div>

                        {/* Image Upload */}
                        <div>
                            <Label className="text-base font-medium text-slate-700 mb-2 flex items-center gap-2">
                                <ImageIcon size={18} />
                                이미지 추가 / Add Images
                            </Label>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition">
                                    <ImageIcon size={18} />
                                    <span className="text-sm font-bold text-slate-700">
                                        {uploadingImage ? '업로드 중... / Uploading...' : '이미지 선택 / Choose Image'}
                                    </span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleAddImage}
                                        className="hidden"
                                        disabled={uploadingImage}
                                    />
                                </label>
                                <span className="text-xs text-slate-500">
                                    JPG, PNG (최대 5MB)
                                </span>
                            </div>

                            {/* Image Preview */}
                            {data.welcomeMessageImages && data.welcomeMessageImages.length > 0 && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                    {data.welcomeMessageImages.map((url, index) => (
                                        <div key={index} className="relative group">
                                            <img
                                                src={url}
                                                alt={`Welcome ${index + 1}`}
                                                className="w-full h-32 object-cover rounded-lg border border-slate-200"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveImage(index)}
                                                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </section>
    );
}
