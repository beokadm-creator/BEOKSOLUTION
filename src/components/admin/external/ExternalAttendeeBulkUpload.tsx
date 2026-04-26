import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Upload, Download, Loader2 } from 'lucide-react';

interface BulkPreviewItem {
    name: string;
    email: string;
    phone: string;
    organization: string;
    licenseNumber?: string;
    amount?: number;
    password?: string;
}

interface ExternalAttendeeBulkUploadProps {
    bulkPreview: BulkPreviewItem[];
    setBulkPreview: React.Dispatch<React.SetStateAction<BulkPreviewItem[]>>;
    isProcessing: boolean;
    progress: number;
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    handleBulkRegister: () => Promise<void>;
    downloadTemplate: () => void;
    exporting: boolean;
}

export const ExternalAttendeeBulkUpload: React.FC<ExternalAttendeeBulkUploadProps> = ({
    bulkPreview, _setBulkPreview, isProcessing, progress, handleFileUpload, handleBulkRegister, downloadTemplate, _exporting
}) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    대량 등록
                </CardTitle>
                <CardDescription>
                    엑셀(.xlsx) 또는 CSV 파일로 외부 참석자를 일괄 등록합니다. <br />
                    <span className="text-blue-600 font-semibold">* 등록된 모든 참석자에 대해 회원 계정이 자동 생성됩니다.</span>
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
                    disabled={isProcessing || bulkPreview.length === 0}
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
