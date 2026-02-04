// RegistrationListPage.tsx에 추가할 클린업 도구 UI 코드
// 기존 버튼 영역 (라인 321-338)에 다음 코드를 추가하세요

const [isCleaning, setIsCleaning] = useState(false);

// 기존 버튼 영역에 추가
<div className="ml-auto flex gap-2">
    <EregiButton
        onClick={async () => {
            if (!conferenceId) return;
            setIsCleaning(true);
            try {
                await checkDataIntegrity(conferenceId);
            } finally {
                setIsCleaning(false);
            }
        }}
        disabled={isCleaning}
        variant="secondary"
        className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 py-2 px-4 h-auto text-sm"
    >
        {isCleaning ? (
            <>
                <Loader2 className="animate-spin w-4 h-4 mr-2" />
                검사 중...
            </>
        ) : (
            '📊 무결성 검사'
        )}
    </EregiButton>

    <EregiButton
        onClick={async () => {
            if (!conferenceId) return;
            setIsCleaning(true);
            try {
                await runDataCleanup(conferenceId);
            } finally {
                setIsCleaning(false);
            }
        }}
        disabled={isCleaning}
        variant="secondary"
        className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 py-2 px-4 h-auto text-sm"
    >
        {isCleaning ? (
            <>
                <Loader2 className="animate-spin w-4 h-4 mr-2" />
                정리 중...
            </>
        ) : (
            '🧹 데이터 정리'
        )}
    </EregiButton>

    <EregiButton
        onClick={handleRecovery}
        variant="secondary"
        className="bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 py-2 px-4 h-auto text-sm"
    >
        데이터 복구 (Fix)
    </EregiButton>
    
    <EregiButton
        onClick={handleExport}
        disabled={exporting || isCleaning}
        isLoading={exporting}
        variant="primary"
        className="bg-green-600 hover:bg-green-700 text-white border-none py-2 px-4 h-auto text-sm"
    >
        엑셀 다운로드 (Excel)
    </EregiButton>
</div>

// 필요시 로딩 아이콘 import 확인
// import { Loader2, Printer } from 'lucide-react';