import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Upload, FileSpreadsheet } from 'lucide-react';

interface MemberBulkUploadProps {
    bulkData: string;
    onBulkDataChange: (value: string) => void;
    onBulkUpload: () => void;
}

const MemberBulkUpload: React.FC<MemberBulkUploadProps> = ({
    bulkData,
    onBulkDataChange,
    onBulkUpload,
}) => {
    return (
        <Card className="border-none shadow-lg shadow-slate-200/50 bg-white rounded-2xl">
            <CardHeader className="bg-emerald-50/50 border-b border-emerald-100">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-600">
                        <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-bold text-slate-800">CSV 대량 업로드</CardTitle>
                        <CardDescription className="text-emerald-600/80 font-medium mt-0.5">회원 정보를 CSV 형식으로 대량 업로드합니다.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-sm font-bold text-slate-700">CSV 파일 입력</Label>
                        <Textarea
                            placeholder="CSV 데이터를 여기에 붙여넣으세요..."
                            rows={12}
                            value={bulkData}
                            onChange={e => onBulkDataChange(e.target.value)}
                            className="font-mono text-sm leading-relaxed bg-slate-50 border-slate-200 focus:bg-white focus:border-emerald-500 transition-colors rounded-xl resize-none p-4"
                        />
                    </div>
                    <Button onClick={onBulkUpload} size="lg" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 rounded-xl h-12">
                        <Upload className="w-5 h-5 mr-2" />
                        CSV 업로드 처리
                    </Button>
                </div>

                <div className="p-6 bg-yellow-50 rounded-xl border border-yellow-200">
                    <h4 className="font-bold text-yellow-800 mb-4">CSV 파일 형식 가이드</h4>
                    <p className="text-sm text-slate-600 mb-4">
                        CSV 형식: <code className="bg-white px-2 py-1 rounded border border-slate-200">NAME|CODE|GRADE|EXPIRY_DATE</code>
                    </p>

                    <div className="space-y-2">
                        <p className="text-xs font-bold text-slate-400 uppercase">CSV 파일 예시</p>
                        <div className="bg-white border border-slate-200 rounded-lg p-3 font-mono text-xs text-slate-600 space-y-1 shadow-sm">
                            <p>홍길동|1001|정회원|2026-12-31</p>
                            <p>김철수|1002|준회원|2026-06-30</p>
                            <p>이영희|1003|준비회원|2026-03-31</p>
                        </div>
                    </div>

                    <div className="pt-2">
                        <p className="text-xs text-slate-400">
                            • 구분자: 파이프(|)<br />
                            • 형식: 이름|코드|등급|유효기간(YYYY-MM-DD)
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default MemberBulkUpload;
