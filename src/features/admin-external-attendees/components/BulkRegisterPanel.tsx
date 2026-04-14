import React, { useState } from 'react';
import { Download, Loader2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useExcel } from '@/hooks/useExcel';
import type { ExternalAttendeeBulkRow } from '../types';

type Props = {
  isProcessing: boolean;
  progress: number;
  onRegisterBulk: (rows: ExternalAttendeeBulkRow[]) => Promise<boolean>;
};

const toStringValue = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';

const toNumberValue = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

export const BulkRegisterPanel: React.FC<Props> = ({ isProcessing, progress, onRegisterBulk }) => {
  const [bulkPreview, setBulkPreview] = useState<ExternalAttendeeBulkRow[]>([]);
  const { exportToExcel, importFromExcel, processing: exporting } = useExcel();

  const downloadTemplate = () => {
    const templateData = [
      {
        이름: '홍길동',
        이메일: 'hong@example.com',
        전화번호: '010-1234-5678',
        소속: '서울대학교',
        면허번호: '12345',
        등록비: 0,
        비밀번호: 'mypassword123 (미입력시 전화번호 뒷 6자리)',
      },
    ];
    exportToExcel(templateData, 'external_attendees_template', 'Template');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rawData = await importFromExcel(file);

      const mappedData = rawData
        .map((row) => {
          const rowObj = row as Record<string, unknown>;
          const name = toStringValue(rowObj.name ?? rowObj['이름'] ?? rowObj['성명']);
          const phone = toStringValue(
            rowObj.phone ?? rowObj['전화번호'] ?? rowObj['핸드폰'] ?? rowObj['연락처'],
          );
          let email = toStringValue(rowObj.email ?? rowObj['이메일']);

          if (!email && phone) {
            const cleanPhone = phone.replace(/[^0-9]/g, '');
            if (cleanPhone.length >= 8) {
              email = `${cleanPhone}@no-email.placeholder`;
            }
          }

          const passwordRaw = rowObj.password ?? rowObj['비밀번호'];
          const password = passwordRaw ? toStringValue(passwordRaw) : undefined;

          return {
            name,
            email,
            phone,
            organization: toStringValue(rowObj.organization ?? rowObj['소속'] ?? rowObj['직장']),
            licenseNumber: toStringValue(rowObj.licenseNumber ?? rowObj['면허번호']),
            amount: toNumberValue(rowObj.amount ?? rowObj['등록비'] ?? rowObj['결제금액']),
            password,
          } satisfies ExternalAttendeeBulkRow;
        })
        .filter((item) => item.name && (item.email || item.phone));

      if (mappedData.length === 0) {
        toast.error('유효한 데이터가 없습니다. 파일의 컬럼명을 확인해주세요.');
        return;
      }

      setBulkPreview(mappedData);
      toast.success(`${mappedData.length}명의 데이터를 불러왔습니다.`);
    } catch (error) {
      console.error('File import failed:', error);
      toast.error('파일을 읽는 중 오류가 발생했습니다.');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleBulkRegister = async () => {
    const success = await onRegisterBulk(bulkPreview);
    if (success) {
      setBulkPreview([]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          대량 등록
        </CardTitle>
        <CardDescription>
          엑셀(.xlsx) 또는 CSV 파일로 외부 참석자를 일괄 등록합니다. <br />
          <span className="text-blue-600 font-semibold">
            * 등록된 모든 참석자에 대해 회원 계정이 자동 생성됩니다.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={downloadTemplate} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            템플릿 다운로드
          </Button>
          <div className="flex-1">
            <Input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="cursor-pointer"
            />
          </div>
        </div>

        {bulkPreview.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">등록 예정: {bulkPreview.length}명</p>
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left">이름</th>
                    <th className="px-4 py-2 text-left">이메일</th>
                    <th className="px-4 py-2 text-left">전화번호</th>
                    <th className="px-4 py-2 text-left">소속</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkPreview.map((item) => (
                    <tr key={`${item.email}-${item.name}`} className="border-t">
                      <td className="px-4 py-2">{item.name}</td>
                      <td className="px-4 py-2">{item.email}</td>
                      <td className="px-4 py-2">{item.phone}</td>
                      <td className="px-4 py-2">{item.organization}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleBulkRegister}
          disabled={isProcessing || exporting || bulkPreview.length === 0}
          className="w-full relative overflow-hidden"
        >
          <span className="relative z-10 flex items-center justify-center">
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {progress > 0 ? `처리 중... ${progress}%` : '일괄 등록 및 계정 생성 중...'}
                <span className="ml-2 text-xs opacity-90">(창을 닫지 마세요)</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                {bulkPreview.length}명 일괄 등록
              </>
            )}
          </span>
          {isProcessing && progress > 0 && (
            <div
              className="absolute bottom-0 left-0 top-0 bg-white/20 transition-all duration-300"
              style={{ width: `${progress}%`, zIndex: 0 }}
            />
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

