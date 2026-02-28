# 바우처 URL 재발송 기능 추가 방법

## 1. Import 추가

`src/pages/admin/RegistrationListPage.tsx` 파일의 imports 부분에 다음을 추가:

```typescript
import { Loader2, Printer, Send } from 'lucide-react';
import { httpsCallable, getFunctions } from 'firebase/functions';
```

## 2. handleResendToken 함수 추가

`handleDeleteRegistration` 함수 뒤에 다음 함수를 추가:

```typescript
const handleResendToken = async (e: React.MouseEvent, reg: RootRegistration) => {
    e.stopPropagation();
    if (!conferenceId) {
        toast.error("Conference ID가 없습니다.");
        return;
    }

    try {
        const functions = getFunctions();
        const resendBadgePrepTokenFn = httpsCallable(functions, 'resendBadgePrepToken');

        const result = await resendBadgePrepTokenFn({
            confId: conferenceId,
            regId: reg.id
        }) as { data: { success: boolean; newToken: string } };

        if (result.data.success) {
            const hostname = window.location.hostname;
            const url = `https://${hostname}/${conferenceId}/badge-prep/${result.data.newToken}`;

            // URL을 클립보드에 복사
            await navigator.clipboard.writeText(url);

            toast.success(
                `바우처 URL이 새로 발급되었습니다.\n클립보드에 복사되었습니다.`
            );
        }
    } catch (error) {
        console.error('[Resend Token] Error:', error);
        toast.error('바우처 URL 재발송 실패');
    }
};
```

## 3. 테이블 버튼 추가

Line 398-405 부분을 다음으로 교체:

```typescript
<td className="p-4">
    <div className="flex items-center gap-2">
        {r.badgeIssued ? (
            <span className="text-green-600 font-bold text-xs flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div> 발급완료
            </span>
        ) : (
            r.status === 'PAID' && (
                <EregiButton
                    onClick={(e) => handleIssueBadge(e, r)}
                    variant="secondary"
                    className="px-3 py-1 text-xs h-auto bg-white border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100"
                >
                    명찰 발급
                </EregiButton>
            )
        )}
        <EregiButton
            onClick={(e) => handleResendToken(e, r)}
            variant="secondary"
            className="px-3 py-1 text-xs h-auto bg-blue-50 border-blue-200 hover:bg-blue-100 hover:text-blue-600"
            title="바우처 URL 재발송"
        >
            <Send size={14} />
        </EregiButton>
        <EregiButton
            onClick={(e) => handlePrintClick(e, r)}
            variant="secondary"
            className="px-2 py-1 text-xs h-auto bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
            title="인쇄"
        >
            <Printer size={14} />
        </EregiButton>
    </div>
</td>
```

## 배포 후 테스트

```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

테스트:
1. 관리자 페이지에서 등록 목록 접근
2. "송신" 아이콘 버튼 클릭
3. 새로운 바우처 URL이 클립보드에 복사되었는지 확인
4. URL 접속 시 새 토큰이 생성되었는지 확인
