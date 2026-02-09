import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import toast from 'react-hot-toast';

interface MigrationResult {
    success: boolean;
    dryRun: boolean;
    results: {
        total: number;
        updated: number;
        skipped: number;
        errors: string[];
    };
    message: string;
}

interface ExternalAttendeeMigrationProps {
    confId: string;
}

/**
 * Admin Component: External Attendee Participation Migration
 * 
 * This component allows admins to migrate existing external attendee
 * participation records to include all required fields for My Page display.
 */
const ExternalAttendeeMigration: React.FC<ExternalAttendeeMigrationProps> = ({ confId }) => {
    const [isRunning, setIsRunning] = useState(false);
    const [dryRunResult, setDryRunResult] = useState<MigrationResult | null>(null);
    const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);

    const runMigration = async (dryRun: boolean) => {
        setIsRunning(true);

        try {
            const functions = getFunctions();
            const migrateFn = httpsCallable<{ confId: string; dryRun: boolean }, MigrationResult>(
                functions,
                'migrateExternalAttendeeParticipations'
            );

            const result = await migrateFn({ confId, dryRun });

            if (result.data.success) {
                if (dryRun) {
                    setDryRunResult(result.data);
                    toast.success(`시뮬레이션 완료: ${result.data.results.updated}개 레코드가 업데이트됩니다.`);
                } else {
                    setMigrationResult(result.data);
                    toast.success(`마이그레이션 완료: ${result.data.results.updated}개 레코드 업데이트됨`);
                }
            } else {
                toast.error('마이그레이션 실패');
            }
        } catch (error) {
            console.error('Migration error:', error);
            toast.error(`오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    외부 참석자 데이터 마이그레이션
                </CardTitle>
                <CardDescription>
                    기존 외부 참석자의 마이페이지 표시를 위해 participation 레코드를 업데이트합니다.
                    <br />
                    <strong className="text-orange-600">⚠️ 먼저 시뮬레이션을 실행하여 영향받을 레코드를 확인하세요.</strong>
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Info Alert */}
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                        <strong>마이그레이션 대상:</strong> 계정이 생성되었지만 마이페이지에 학술대회가 표시되지 않는 외부 참석자
                        <br />
                        <strong>변경 내용:</strong> participation 레코드에 slug, societyId, paymentStatus 등 필수 필드 추가
                    </AlertDescription>
                </Alert>

                {/* Dry Run Section */}
                <div className="space-y-2">
                    <Button
                        onClick={() => runMigration(true)}
                        disabled={isRunning}
                        variant="outline"
                        className="w-full"
                    >
                        {isRunning ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                실행 중...
                            </>
                        ) : (
                            <>
                                <Info className="w-4 h-4 mr-2" />
                                1단계: 시뮬레이션 실행 (변경 없음)
                            </>
                        )}
                    </Button>

                    {dryRunResult && (
                        <Alert className="bg-blue-50 border-blue-200">
                            <CheckCircle className="h-4 w-4 text-blue-600" />
                            <AlertDescription>
                                <div className="space-y-1">
                                    <p className="font-semibold text-blue-900">시뮬레이션 결과:</p>
                                    <ul className="text-sm text-blue-800 space-y-1">
                                        <li>• 전체 외부 참석자: {dryRunResult.results.total}명</li>
                                        <li>• 업데이트 대상: {dryRunResult.results.updated}명</li>
                                        <li>• 스킵 (계정 미생성): {dryRunResult.results.skipped}명</li>
                                        {dryRunResult.results.errors.length > 0 && (
                                            <li className="text-red-600">• 오류: {dryRunResult.results.errors.length}건</li>
                                        )}
                                    </ul>
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}
                </div>

                {/* Actual Migration Section */}
                {dryRunResult && dryRunResult.results.updated > 0 && (
                    <div className="space-y-2">
                        <Button
                            onClick={() => runMigration(false)}
                            disabled={isRunning}
                            variant="default"
                            className="w-full bg-orange-600 hover:bg-orange-700"
                        >
                            {isRunning ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    마이그레이션 실행 중...
                                </>
                            ) : (
                                <>
                                    <AlertTriangle className="w-4 h-4 mr-2" />
                                    2단계: 실제 마이그레이션 실행 ({dryRunResult.results.updated}개 레코드)
                                </>
                            )}
                        </Button>

                        {migrationResult && (
                            <Alert className="bg-green-50 border-green-200">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <AlertDescription>
                                    <div className="space-y-1">
                                        <p className="font-semibold text-green-900">마이그레이션 완료!</p>
                                        <ul className="text-sm text-green-800 space-y-1">
                                            <li>• 성공: {migrationResult.results.updated}명</li>
                                            {migrationResult.results.errors.length > 0 && (
                                                <li className="text-red-600">• 실패: {migrationResult.results.errors.length}명</li>
                                            )}
                                        </ul>
                                        <p className="text-xs text-green-700 mt-2">
                                            ✅ 외부 참석자들이 이제 마이페이지에서 학술대회를 확인할 수 있습니다.
                                        </p>
                                    </div>
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                )}

                {/* Error Display */}
                {(dryRunResult?.results.errors.length ?? 0) > 0 && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                            <p className="font-semibold">오류 발생:</p>
                            <ul className="text-xs mt-1 space-y-1">
                                {dryRunResult!.results.errors.map((error, idx) => (
                                    <li key={idx}>• {error}</li>
                                ))}
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
};

export default ExternalAttendeeMigration;
