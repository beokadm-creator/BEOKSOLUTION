import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { CheckCircle2, Save } from 'lucide-react';
import type { RegistrationFieldSettings, ConferenceUser } from '@/types/schema';

interface RegistrationFormProps {
    formData: {
        name: string;
        email: string;
        phone: string;
        affiliation: string;
        position: string;
        licenseNumber: string;
        simplePassword: string;
        confirmPassword: string;
    };
    setFormData: React.Dispatch<React.SetStateAction<RegistrationFormProps['formData']>>;
    fieldSettings: RegistrationFieldSettings;
    language: 'ko' | 'en';
    auth: { user: ConferenceUser | null };
    isInfoSaved: boolean;
    setIsInfoSaved: (value: boolean) => void;
    isProcessing: boolean;
    memberVerified: boolean;
    paramMemberCode: string;
    lockNameField: boolean;
    showLoadExistingInfo: boolean;
    handleLoginAndLoad: () => Promise<void>;
    handleSaveBasicInfo: () => Promise<void>;
}

export default function RegistrationForm({
    formData,
    setFormData,
    fieldSettings,
    language,
    auth,
    isInfoSaved,
    setIsInfoSaved,
    isProcessing,
    memberVerified,
    paramMemberCode,
    lockNameField,
    showLoadExistingInfo,
    handleLoginAndLoad,
    handleSaveBasicInfo,
}: RegistrationFormProps) {
    return (
        <Card className={`transition-all duration-300 ${isInfoSaved ? 'opacity-70 grayscale' : 'shadow-lg border-blue-200'}`}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isInfoSaved ? 'bg-green-100 text-green-600' : 'bg-blue-600 text-white'}`}>
                        {isInfoSaved ? <CheckCircle2 className="w-5 h-5" /> : '1'}
                    </div>
                    {language === 'ko' ? '기본 정보' : 'Basic Information'}
                </CardTitle>
                <CardDescription>
                    {language === 'ko' ? '등록을 위해 기본 정보를 입력해주세요.' : 'Please enter your basic information for registration.'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                            {/* 1. Email & Password (Guest Login / Create) */}
                            {fieldSettings.email.visible && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                                    <div className="space-y-2">
                                        <Label>
                                            {language === 'ko' ? '이메일' : 'Email'} 
                                            {fieldSettings.email.required && <span className="text-red-500">*</span>}
                                        </Label>
                                        <Input
                                            type="email"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            readOnly={isInfoSaved || !!auth.user}
                                            className={isInfoSaved || !!auth.user ? 'bg-gray-100' : 'bg-white'}
                                            placeholder="email@example.com"
                                        />
                                    </div>

                                    {/* Password: Show for guests (non-authenticated users) */}
                                    {!auth.user && (
                                        <div className="space-y-2">
                                            <Label className="flex justify-between items-center">
                                                <span>
                                                    {language === 'ko' ? '비밀번호' : 'Password'} <span className="text-red-500">*</span>
                                                </span>
                                                {/* Load Button for Guests */}
                                                {showLoadExistingInfo && (
                                                    <button
                                                        type="button"
                                                        onClick={handleLoginAndLoad}
                                                        className="text-xs text-blue-600 hover:underline font-medium"
                                                        disabled={isProcessing}
                                                    >
                                                        {language === 'ko' ? '기존 정보 불러오기' : 'Load Existing Info'}
                                                    </button>
                                                )}
                                            </Label>
                                            <Input
                                                type="password"
                                                value={formData.simplePassword}
                                                onChange={e => setFormData({ ...formData, simplePassword: e.target.value })}
                                                readOnly={isInfoSaved}
                                                className="bg-white"
                                                placeholder={language === 'ko' ? '비밀번호를 입력하세요' : 'Enter password'}
                                            />
                                            <p className="text-xs text-gray-500">
                                                * {showLoadExistingInfo
                                                    ? (language === 'ko'
                                                        ? '기존 가입자는 정보를 불러오고, 처음 등록하는 경우에는 계정이 자동 생성됩니다.'
                                                        : 'Existing users: info auto-loads. New users: account created.')
                                                    : (language === 'ko'
                                                        ? '등록을 진행하면 계정이 생성됩니다.'
                                                        : 'An account will be created when you proceed.')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 2. Personal Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {fieldSettings.name.visible && (
                                    <div className="space-y-2">
                                        <Label>
                                            {language === 'ko' ? '이름' : 'Name'} 
                                            {fieldSettings.name.required && <span className="text-red-500">*</span>}
                                        </Label>
                                        <Input
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            readOnly={isInfoSaved || lockNameField}
                                            className={isInfoSaved || lockNameField ? 'bg-gray-100' : ''}
                                            placeholder={language === 'ko' ? '이름을 입력하세요' : 'Enter your name'}
                                        />
                                    </div>
                                )}
                                {fieldSettings.affiliation.visible && (
                                    <div className="space-y-2">
                                        <Label>
                                            {language === 'ko' ? '소속' : 'Affiliation'} 
                                            {fieldSettings.affiliation.required && <span className="text-red-500">*</span>}
                                        </Label>
                                        <Input
                                            value={formData.affiliation}
                                            onChange={e => setFormData({ ...formData, affiliation: e.target.value })}
                                            readOnly={isInfoSaved}
                                            className={isInfoSaved ? 'bg-gray-100' : ''}
                                            placeholder={language === 'ko' ? '소속을 입력하세요' : 'Enter your affiliation'}
                                        />
                                    </div>
                                )}
                                {fieldSettings.position.visible && (
                                    <div className="space-y-2">
                                        <Label>
                                            {language === 'ko' ? '직급' : 'Position'} 
                                            {fieldSettings.position.required && <span className="text-red-500">*</span>}
                                        </Label>
                                        <Input
                                            value={formData.position}
                                            onChange={e => setFormData({ ...formData, position: e.target.value })}
                                            readOnly={isInfoSaved}
                                            className={isInfoSaved ? 'bg-gray-100' : ''}
                                            placeholder={language === 'ko' ? '직급을 입력하세요' : 'Enter your position'}
                                        />
                                    </div>
                                )}
                                {fieldSettings.licenseNumber.visible && (
                                    <div className="space-y-2">
                                        <Label>
                                            {language === 'ko' ? '면허번호' : 'License Number'} 
                                            {fieldSettings.licenseNumber.required
                                                ? <span className="text-red-500">*</span>
                                                : <span className="text-slate-400 text-xs font-normal ml-1">{language === 'ko' ? '(선택)' : '(Optional)'}</span>}
                                        </Label>
                                        <Input
                                            value={formData.licenseNumber}
                                            onChange={e => setFormData({ ...formData, licenseNumber: e.target.value })}
                                            readOnly={isInfoSaved || (memberVerified && !!paramMemberCode)}
                                            className={isInfoSaved || (memberVerified && !!paramMemberCode) ? 'bg-gray-100' : ''}
                                            placeholder={language === 'ko' ? '면허번호를 입력하세요' : 'Enter your license number'}
                                        />
                                    </div>
                                )}
                                {fieldSettings.phone.visible && (
                                    <div className="space-y-2">
                                        <Label>
                                            {language === 'ko' ? '휴대폰 번호' : 'Phone'} 
                                            {fieldSettings.phone.required && <span className="text-red-500">*</span>}
                                        </Label>
                                        <Input
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            readOnly={isInfoSaved}
                                            className={isInfoSaved ? 'bg-gray-100' : ''}
                                            placeholder="010-1234-5678"
                                        />
                                    </div>
                                )}
                            </div>
                        </CardContent>
                        <CardFooter className={`${isInfoSaved ? 'hidden' : 'block'}`}>
                            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleSaveBasicInfo} disabled={isProcessing}>
                                <Save className="w-4 h-4 mr-2" />
                                {language === 'ko' ? '기본 정보 저장' : 'Save Basic Info'}
                            </Button>
                        </CardFooter>
                        {isInfoSaved && (
                            <div className="absolute top-4 right-4">
                                <Button variant="ghost" size="sm" onClick={() => setIsInfoSaved(false)}>
                                    {language === 'ko' ? '수정' : 'Edit'}
                                </Button>
                            </div>
                        )}
                    </Card>
    );
}
