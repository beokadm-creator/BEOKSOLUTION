import React from 'react';
import { Card, CardContent } from '../../ui/card';
import { Label } from '../../ui/label';
import { Image as ImageIcon, FileText, X, Plus, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import BilingualImageUpload from '../../ui/bilingual-image-upload';
import RichTextEditor from '../../ui/RichTextEditor';
import BilingualInput from '../../ui/bilingual-input';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import ImageUpload from '../../ui/ImageUpload';
import { v4 as uuidv4 } from 'uuid';

import { ConferenceInfo } from '../../../types/conference';

interface VisualAssetsFormProps {
    cid: string;
    data: ConferenceInfo;
    setData: React.Dispatch<React.SetStateAction<ConferenceInfo>>;
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
    const greetings = Array.isArray((data as unknown as { welcomeGreetings?: unknown }).welcomeGreetings)
        ? ((data as unknown as { welcomeGreetings: unknown[] }).welcomeGreetings as unknown[])
        : [];

    const setGreetings = (next: unknown[]) => {
        setData((prev: ConferenceInfo) => ({
            ...prev,
            welcomeGreetings: next
        }));
    };

    const addGreeting = () => {
        if (greetings.length >= 5) return;
        const id = uuidv4();
        setGreetings([
            ...greetings,
            {
                id,
                role: { ko: '', en: '' },
                name: '',
                affiliation: { ko: '', en: '' },
                message: { ko: '', en: '' },
                photoUrl: '',
                order: greetings.length
            }
        ]);
    };

    const removeGreeting = (index: number) => {
        setGreetings(greetings.filter((_, i) => i !== index));
    };

    const moveGreeting = (index: number, dir: -1 | 1) => {
        const target = index + dir;
        if (target < 0 || target >= greetings.length) return;
        const next = [...greetings];
        const tmp = next[index];
        next[index] = next[target];
        next[target] = tmp;
        setGreetings(next);
    };

    const updateGreeting = (index: number, patch: Record<string, unknown>) => {
        setGreetings(greetings.map((g, i) => (i === index ? { ...(g as Record<string, unknown>), ...patch } : g)));
    };

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
                                onChangeKO={(url) => setData((prev: ConferenceInfo) => ({
                                    ...prev,
                                    visualAssets: { ...prev.visualAssets, banner: { ...(prev.visualAssets?.banner || {}), ko: url } }
                                }))}
                                onChangeEN={(url) => setData((prev: ConferenceInfo) => ({
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
                                onChangeKO={(url) => setData((prev: ConferenceInfo) => ({
                                    ...prev,
                                    visualAssets: { ...prev.visualAssets, poster: { ...(prev.visualAssets?.poster || {}), ko: url } }
                                }))}
                                onChangeEN={(url) => setData((prev: ConferenceInfo) => ({
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
                        <CardContent className="p-6 md:p-8 space-y-6">
                            <div className="flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <h3 className="text-base font-bold text-slate-800">복수 인사말</h3>
                                    <p className="text-sm text-slate-500">최대 5개까지 등록할 수 있으며, 사용자 페이지에서 직함+이름 버튼으로 전환됩니다.</p>
                                </div>
                                <Button
                                    type="button"
                                    onClick={addGreeting}
                                    disabled={greetings.length >= 5}
                                    className="gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    인사말 추가
                                </Button>
                            </div>

                            {greetings.length === 0 && (
                                <div className="text-sm text-slate-500 bg-slate-50 border border-slate-100 rounded-xl p-4">
                                    등록된 복수 인사말이 없습니다. 필요 시 “인사말 추가”로 여러 명의 인사말을 구성하세요.
                                </div>
                            )}

                            {greetings.map((g, idx) => {
                                const gg = g as Record<string, any>;
                                const role = (gg.role && typeof gg.role === 'object') ? gg.role : { ko: '', en: '' };
                                const affiliation = (gg.affiliation && typeof gg.affiliation === 'object') ? gg.affiliation : { ko: '', en: '' };
                                const message = (gg.message && typeof gg.message === 'object') ? gg.message : { ko: '', en: '' };
                                const gid = String(gg.id || '');

                                return (
                                    <div key={gid || idx} className="border border-slate-200 rounded-2xl p-5 md:p-6 space-y-6">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-0.5">
                                                <div className="text-sm font-bold text-slate-800">인사말 {idx + 1}</div>
                                                <div className="text-xs text-slate-500">버튼 라벨: 직함 + 이름</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button type="button" variant="outline" size="icon" onClick={() => moveGreeting(idx, -1)} disabled={idx === 0}>
                                                    <ArrowUp className="w-4 h-4" />
                                                </Button>
                                                <Button type="button" variant="outline" size="icon" onClick={() => moveGreeting(idx, 1)} disabled={idx === greetings.length - 1}>
                                                    <ArrowDown className="w-4 h-4" />
                                                </Button>
                                                <Button type="button" variant="destructive" size="icon" onClick={() => removeGreeting(idx)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <BilingualInput
                                                label="직함 (Role)"
                                                valueKO={String(role.ko || '')}
                                                valueEN={String(role.en || '')}
                                                onChangeKO={(value) => updateGreeting(idx, { role: { ...role, ko: value } })}
                                                onChangeEN={(value) => updateGreeting(idx, { role: { ...role, en: value } })}
                                                placeholderKO="예: 회장"
                                                placeholderEN="e.g. President"
                                                required
                                            />

                                            <div className="space-y-2">
                                                <Label className="text-sm font-bold text-slate-700">이름 (Name)</Label>
                                                <Input
                                                    value={String(gg.name || '')}
                                                    onChange={(e) => updateGreeting(idx, { name: e.target.value })}
                                                    placeholder="예: 홍길동"
                                                    className="h-10 border-slate-200 rounded-md"
                                                />
                                            </div>
                                        </div>

                                        <BilingualInput
                                            label="소속 (Affiliation)"
                                            valueKO={String(affiliation.ko || '')}
                                            valueEN={String(affiliation.en || '')}
                                            onChangeKO={(value) => updateGreeting(idx, { affiliation: { ...affiliation, ko: value } })}
                                            onChangeEN={(value) => updateGreeting(idx, { affiliation: { ...affiliation, en: value } })}
                                            placeholderKO="예: RCA"
                                            placeholderEN="e.g. RCA"
                                        />

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-base font-medium text-slate-700 mb-2 block">한국어 인사말 / Korean</Label>
                                                <RichTextEditor
                                                    value={String(message.ko || '')}
                                                    onChange={(value) => updateGreeting(idx, { message: { ...message, ko: value } })}
                                                    placeholder="환영사를 작성해주세요..."
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-base font-medium text-slate-700 mb-2 block">영어 인사말 / English</Label>
                                                <RichTextEditor
                                                    value={String(message.en || '')}
                                                    onChange={(value) => updateGreeting(idx, { message: { ...message, en: value } })}
                                                    placeholder="e.g. Dear Colleagues and Friends..."
                                                />
                                            </div>
                                        </div>

                                        <ImageUpload
                                            path={`conferences/${cid}/welcome/greetings/${gid || idx}`}
                                            previewUrl={gg.photoUrl ? String(gg.photoUrl) : undefined}
                                            onUploadComplete={(url) => updateGreeting(idx, { photoUrl: url })}
                                            label="프로필 사진 (1장)"
                                        />
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden rounded-2xl">
                        <CardContent className="p-6 md:p-8 space-y-8">
                            {/* Korean Editor */}
                            <div>
                                <Label className="text-base font-medium text-slate-700 mb-2 block">
                                    한국어 인사말 / Korean
                                </Label>
                                <RichTextEditor
                                    value={data.welcomeMessage?.ko || ''}
                                    onChange={(value) => setData((prev: ConferenceInfo) => ({
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
                                    onChange={(value) => setData((prev: ConferenceInfo) => ({
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
