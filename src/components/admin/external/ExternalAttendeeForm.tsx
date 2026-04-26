import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { UserPlus, Loader2, Eye, EyeOff } from 'lucide-react';
import type { RegistrationFieldSettings } from '@/types/schema';

interface ExternalAttendeeFormProps {
    formData: {
        name: string;
        email: string;
        phone: string;
        organization: string;
        position: string;
        licenseNumber: string;
        amount: number;
        password: string;
    };
    setFormData: React.Dispatch<React.SetStateAction<{
        name: string;
        email: string;
        phone: string;
        organization: string;
        position: string;
        licenseNumber: string;
        amount: number;
        password: string;
    }>>;
    noEmail: boolean;
    handleNoEmailChange: (checked: boolean) => void;
    showPassword: boolean;
    setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
    fieldSettings: RegistrationFieldSettings;
    isProcessing: boolean;
    handleIndividualRegister: () => Promise<void>;
}

export const ExternalAttendeeForm: React.FC<ExternalAttendeeFormProps> = ({
    formData, setFormData, noEmail, handleNoEmailChange, showPassword, setShowPassword, fieldSettings, isProcessing, handleIndividualRegister
}) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5" />
                    개별 등록
                </CardTitle>
                <CardDescription>
                    외부 참석자를 한 명씩 수동으로 등록합니다. <br />
                    <span className="text-blue-600 font-semibold">* 등록 시 회원 계정이 자동으로 생성됩니다. (비밀번호 미입력 시 전화번호 뒷 6자리)</span>
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {fieldSettings.name.visible && (
                        <div className="space-y-2">
                            <Label>이름 {fieldSettings.name.required && <span className="text-red-500">*</span>}</Label>
                            <Input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="홍길동"
                            />
                        </div>
                    )}
                    {fieldSettings.email.visible && (
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label>이메일 {fieldSettings.email.required && <span className="text-red-500">*</span>}</Label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="noEmail"
                                        checked={noEmail}
                                        onChange={(e) => handleNoEmailChange(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                    />
                                    <label htmlFor="noEmail" className="text-xs text-gray-500 cursor-pointer select-none">이메일 없음</label>
                                </div>
                            </div>
                            <Input
                                type="email"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                placeholder="example@email.com"
                                disabled={noEmail}
                                className={noEmail ? 'bg-gray-100 text-gray-500' : ''}
                            />
                        </div>
                    )}
                    {fieldSettings.phone.visible && (
                        <div className="space-y-2">
                            <Label>전화번호 {fieldSettings.phone.required && <span className="text-red-500">*</span>}</Label>
                            <Input
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="010-1234-5678"
                            />
                        </div>
                    )}
                    {fieldSettings.affiliation.visible && (
                        <div className="space-y-2">
                            <Label>소속 {fieldSettings.affiliation.required && <span className="text-red-500">*</span>}</Label>
                            <Input
                                value={formData.organization}
                                onChange={e => setFormData({ ...formData, organization: e.target.value })}
                                placeholder="소속 기관명"
                            />
                        </div>
                    )}
                    {fieldSettings.position.visible && (
                        <div className="space-y-2">
                            <Label>직급 {fieldSettings.position.required && <span className="text-red-500">*</span>}</Label>
                            <Input
                                value={formData.position}
                                onChange={e => setFormData({ ...formData, position: e.target.value })}
                                placeholder="직급"
                            />
                        </div>
                    )}
                    {fieldSettings.licenseNumber.visible && (
                        <div className="space-y-2">
                            <Label>면허번호 {fieldSettings.licenseNumber.required ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal text-xs ml-1">(선택)</span>}</Label>
                            <Input
                                value={formData.licenseNumber}
                                onChange={e => setFormData({ ...formData, licenseNumber: e.target.value })}
                                placeholder="면허번호"
                            />
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label>등록비 (선택)</Label>
                        <Input
                            type="number"
                            value={formData.amount}
                            onChange={e => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
                            placeholder="0"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>비밀번호 (선택)</Label>
                        <div className="relative">
                            <Input
                                type={showPassword ? 'text' : 'password'}
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                placeholder="미입력 시 전화번호 뒷 6자리"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">회원가입에 사용될 비밀번호입니다.</p>
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                <Button onClick={handleIndividualRegister} disabled={isProcessing} className="w-full">
                    {isProcessing ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            처리 중...
                        </>
                    ) : (
                        <>
                            <UserPlus className="w-4 h-4 mr-2" />
                            등록 및 계정 생성
                        </>
                    )}
                </Button>
            </CardFooter>
        </Card>
    );
};
