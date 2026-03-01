import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { QrCode, Monitor, Smartphone, AlertCircle } from 'lucide-react';

export default function VendorScannerIntroPage() {
    const navigate = useNavigate();

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">QR Scanner</h1>
                <p className="text-gray-500 mt-1">현장에 최적화된 스캔 방식을 선택해주세요.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer group" onClick={() => navigate('camera')}>
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            <Smartphone className="w-8 h-8" />
                        </div>
                        <CardTitle>모바일 기기 카메라</CardTitle>
                        <CardDescription>
                            스마트폰이나 태블릿 카메라 사용
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center pt-4 border-t text-sm text-gray-600">
                        <ul className="text-left space-y-2 mb-6">
                            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>기기 후면 카메라 연동</li>
                            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>별도의 장비 불필요 (무선)</li>
                            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>이동하면서 스캔하기 적합</li>
                        </ul>
                        <Button className="w-full bg-indigo-600 hover:bg-indigo-700">카메라 모드 시작</Button>
                    </CardContent>
                </Card>

                <Card className="hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group" onClick={() => navigate('external')}>
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Monitor className="w-8 h-8" />
                        </div>
                        <CardTitle>외부 바코드 스캐너</CardTitle>
                        <CardDescription>
                            PC/노트북 + USB/Bluetooth 리더기 연결
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center pt-4 border-t text-sm text-gray-600">
                        <ul className="text-left space-y-2 mb-6">
                            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>USB 방식의 스캐너 건 사용</li>
                            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>초고속 스캔 처리 속도</li>
                            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>데스크에 고정하여 빠른 처리</li>
                        </ul>
                        <Button className="w-full bg-blue-600 hover:bg-blue-700">데스크탑 모드 시작</Button>
                    </CardContent>
                </Card>
            </div>

            <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-5 flex items-start gap-4">
                <AlertCircle className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-600">
                    <p className="font-bold text-gray-700 mb-1">참고 사항</p>
                    <p>스캔 모드를 선택하셔도 언제든 상단 메뉴를 통해 다른 모드로 전환하실 수 있습니다. 모바일 환경으로 접속하셨다면 카메라 방식을, 안내 데스크에서 노트북을 사용 중이시라면 외부 리더기 방식을 권장합니다.</p>
                </div>
            </div>
        </div>
    );
}
