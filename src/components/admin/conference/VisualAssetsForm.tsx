import React from 'react';
import { Card, CardContent } from '../../ui/card';
import { Label } from '../../ui/label';
import { Image as ImageIcon, FileText, X } from 'lucide-react';
import BilingualImageUpload from '../../ui/bilingual-image-upload';
import RichTextEditor from '../../ui/RichTextEditor';

interface VisualAssetsFormProps {
    cid: string;
    data: any;
    setData: React.Dispatch<React.SetStateAction<any>>;
    uploadingImage: boolean;
    handleAddImage: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    handleRemoveImage: (index: number) => void;
}

export const VisualAssetsForm: React.FC<VisualAssetsFormProps> = ({
    cid,
    data,
    setData,
    uploadingImage,
    handleAddImage,
    handleRemoveImage
}) => {
    return (
        <div className="space-y-12">
            {/* 3. Visual Assets Section */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                <div className="lg:col-span-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="p-2.5 bg-purple-50 rounded-xl text-purple-600">
                            <ImageIcon className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">Visual assets</h2>
                    </div>
                    <p className="text-slate-500 leading-relaxed text-sm">
                        학술대회에 사용할 배너와 포스터 이미지를 등록합니다. 등록 후 즉시 참가자에게 반영됩니다.<br />
                        배너는 학술대회 페이지 상단에, 포스터는 인쇄물 등에 활용되는 안내 이미지입니다. 등록된 이미지는 언어별로 다르게 설정할 수 있습니다.
                    </p>
                    <div className="mt-4 p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                        <h4 className="font-semibold text-purple-900 text-sm mb-2">Recommended image size</h4>
                        <ul className="text-xs text-purple-800 space-y-1.5 list-disc list-inside">
                            <li>메인 배너 권장 크기: 1920 x 600 px</li>
                            <li>포스터 / 안내 이미지: A4 비율 권장</li>
                            <li>지원 형식: JPG, PNG (최대 5MB)</li>
                        </ul>
                    </div>
                </div>

                <div className="lg:col-span-8">
                    <Card className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden rounded-2xl">
                        <CardContent className="p-6 md:p-8 space-y-10">
                            <BilingualImageUpload
                                label="메인 배너 (Main Banner)"
                                valueKO={data.visualAssets?.banner?.ko}
                                valueEN={data.visualAssets?.banner?.en}
                                onChangeKO={(url) => setData((prev: any) => ({
                                    ...prev,
                                    visualAssets: { ...prev.visualAssets, banner: { ...(prev.visualAssets?.banner || {}), ko: url } }
                                }))}
                                onChangeEN={(url) => setData((prev: any) => ({
                                    ...prev,
                                    visualAssets: { ...prev.visualAssets, banner: { ...(prev.visualAssets?.banner || {}), en: url } }
                                }))}
                                pathBaseKO={`conferences/${cid}/banner_ko`}
                                pathBaseEN={`conferences/${cid}/banner_en`}
                                recommendedSize="1920x600 px"
                                labelKO="Banner image (KO)"
                                labelEN="Banner image (EN)"
                            />

                            <div className="border-t border-slate-100" />

                            <BilingualImageUpload
                                label="포스터 / 안내 이미지 (Poster)"
                                valueKO={data.visualAssets?.poster?.ko}
                                valueEN={data.visualAssets?.poster?.en}
                                onChangeKO={(url) => setData((prev: any) => ({
                                    ...prev,
                                    visualAssets: { ...prev.visualAssets, poster: { ...(prev.visualAssets?.poster || {}), ko: url } }
                                }))}
                                onChangeEN={(url) => setData((prev: any) => ({
                                    ...prev,
                                    visualAssets: { ...prev.visualAssets, poster: { ...(prev.visualAssets?.poster || {}), en: url } }
                                }))}
                                pathBaseKO={`conferences/${cid}/poster_ko`}
                                pathBaseEN={`conferences/${cid}/poster_en`}
                                recommendedSize="Poster image for print or A4 ratio"
                                labelKO="Poster image (KO)"
                                labelEN="Poster image (EN)"
                            />
                        </CardContent>
                    </Card>
                </div>
            </section>

            <hr className="border-slate-100" />

            {/* 4. Welcome Message Section */}
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
                                    value={data.welcomeMessage?.ko || ''}
                                    onChange={(value) => setData((prev: any) => ({
                                        ...prev,
                                        welcomeMessage: { ...(prev.welcomeMessage || {}), ko: value }
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
                                    value={data.welcomeMessage?.en || ''}
                                    onChange={(value) => setData((prev: any) => ({
                                        ...prev,
                                        welcomeMessage: { ...(prev.welcomeMessage || {}), en: value }
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
                                        {data.welcomeMessageImages.map((url: string, index: number) => (
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
        </div>
    );
};
