import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type FormData = {
  name: string;
  email: string;
  phone: string;
  organization: string;
  licenseNumber: string;
  amount: number;
  password: string;
};

type Props = {
  isProcessing: boolean;
  onRegister: (data: FormData & { noEmail: boolean }) => Promise<boolean>;
};

export const IndividualRegisterForm: React.FC<Props> = ({ isProcessing, onRegister }) => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    organization: '',
    licenseNumber: '',
    amount: 0,
    password: '',
  });
  const [noEmail, setNoEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleNoEmailChange = (checked: boolean) => {
    setNoEmail(checked);
    if (checked) {
      if (formData.phone) {
        const cleanPhone = formData.phone.replace(/[^0-9]/g, '');
        setFormData((prev) => ({ ...prev, email: `${cleanPhone}@no-email.placeholder` }));
      } else {
        setFormData((prev) => ({ ...prev, email: '' }));
      }
    } else {
      setFormData((prev) => ({ ...prev, email: '' }));
    }
  };

  const handleSubmit = async () => {
    const success = await onRegister({ ...formData, noEmail });
    if (success) {
      setFormData({
        name: '',
        email: '',
        phone: '',
        organization: '',
        licenseNumber: '',
        amount: 0,
        password: '',
      });
      setNoEmail(false);
      setShowPassword(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          개별 등록
        </CardTitle>
        <CardDescription>
          외부 참석자를 한 명씩 수동으로 등록합니다. <br />
          <span className="text-blue-600 font-semibold">
            * 등록 시 회원 계정이 자동으로 생성됩니다. (비밀번호 미입력 시 전화번호 뒷 6자리)
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>
              이름 <span className="text-red-500">*</span>
            </Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="홍길동"
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>
                이메일 <span className="text-red-500">*</span>
              </Label>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="noEmail"
                  checked={noEmail}
                  onChange={(e) => handleNoEmailChange(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="noEmail" className="text-xs text-gray-500 cursor-pointer select-none">
                  이메일 없음
                </label>
              </div>
            </div>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="example@email.com"
              disabled={noEmail}
              className={noEmail ? 'bg-gray-100 text-gray-500' : ''}
            />
          </div>
          <div className="space-y-2">
            <Label>
              전화번호 <span className="text-red-500">*</span>
            </Label>
            <Input
              value={formData.phone}
              onChange={(e) => {
                const phone = e.target.value;
                setFormData((prev) => {
                  if (!noEmail) return { ...prev, phone };
                  const cleanPhone = phone.replace(/[^0-9]/g, '');
                  return { ...prev, phone, email: cleanPhone ? `${cleanPhone}@no-email.placeholder` : '' };
                });
              }}
              placeholder="010-1234-5678"
            />
          </div>
          <div className="space-y-2">
            <Label>
              소속 <span className="text-red-500">*</span>
            </Label>
            <Input
              value={formData.organization}
              onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
              placeholder="병원/학교명"
            />
          </div>
          <div className="space-y-2">
            <Label>면허번호 (선택)</Label>
            <Input
              value={formData.licenseNumber}
              onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
              placeholder="면허번호"
            />
          </div>
          <div className="space-y-2">
            <Label>등록비 (선택)</Label>
            <Input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label>비밀번호 (선택)</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
        <Button onClick={handleSubmit} disabled={isProcessing} className="w-full">
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
