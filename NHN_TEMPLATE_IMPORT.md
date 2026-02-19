# ✅ NHN Cloud 템플릿 불러오기 구현 완료!

## 🎯 구현 내용

### 1. **Cloud Function 생성** ✅
**파일**: `functions/src/index.ts`

```typescript
export const getNhnAlimTalkTemplates = functions
    .runWith({
        enforceAppCheck: false,
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
        }

        const { senderKey } = data;

        if (!senderKey) {
            throw new functions.https.HttpsError('invalid-argument', 'senderKey is required');
        }

        try {
            const result = await getTemplates(senderKey);
            
            // ⭐ Filter only APPROVED templates
            if (result.success && result.data?.templateListResponse?.templates) {
                const approvedTemplates = result.data.templateListResponse.templates.filter(
                    (template: any) => template.templateStatus === 'APR'
                );
                
                functions.logger.info(`[NHN Templates] Total: ${result.data.templateListResponse.templates.length}, Approved: ${approvedTemplates.length}`);
                
                return {
                    success: true,
                    data: {
                        ...result.data,
                        templateListResponse: {
                            ...result.data.templateListResponse,
                            templates: approvedTemplates
                        }
                    }
                };
            }
            
            return result;
        } catch (error: any) {
            functions.logger.error("Error in getNhnAlimTalkTemplates:", error);
            throw new functions.https.HttpsError('internal', error.message);
        }
    });
```

**핵심 기능**:
- ✅ 승인된 템플릿만 필터링 (`templateStatus === 'APR'`)
- ✅ 인증된 사용자만 호출 가능
- ✅ senderKey 필수 파라미터
- ✅ 에러 핸들링 및 로깅

---

### 2. **Frontend State 및 핸들러** ✅
**파일**: `src/pages/admin/TemplatesPage.tsx`

#### State 추가
```typescript
// NHN Cloud Import State
const [isNhnImportOpen, setIsNhnImportOpen] = useState(false);
const [nhnTemplates, setNhnTemplates] = useState<any[]>([]);
const [loadingNhn, setLoadingNhn] = useState(false);
```

#### 템플릿 불러오기 핸들러
```typescript
const handleFetchNhnTemplates = async () => {
    setLoadingNhn(true);
    try {
        // 1. Infrastructure 설정에서 senderKey 조회
        const infraDoc = await getDoc(
            doc(db, 'societies', targetSocietyId!, 'settings', 'infrastructure')
        );
        const senderKey = infraDoc.data()?.notification?.nhnAlimTalk?.senderKey;

        if (!senderKey) {
            toast.error("NHN Cloud 발신 프로필 키가 설정되지 않았습니다.\nInfrastructure Settings에서 먼저 설정해주세요.");
            return;
        }

        // 2. Cloud Function 호출
        const getNhnTemplatesFn = httpsCallable(functions, 'getNhnAlimTalkTemplates');
        const result = await getNhnTemplatesFn({ senderKey });
        const data = result.data as any;

        // 3. 결과 처리
        if (data.success && data.data?.templateListResponse?.templates) {
            const templates = data.data.templateListResponse.templates;
            
            if (templates.length === 0) {
                toast.error("승인된 템플릿이 없습니다.\nNHN Cloud Console에서 템플릿을 등록하고 승인받아주세요.");
            } else {
                setNhnTemplates(templates);
                setIsNhnImportOpen(true);
                toast.success(`${templates.length}개의 승인된 템플릿을 불러왔습니다.`);
            }
        }
    } catch (error) {
        console.error("Failed to fetch NHN templates:", error);
        toast.error("NHN Cloud 템플릿 호출 중 오류가 발생했습니다.");
    } finally {
        setLoadingNhn(false);
    }
};
```

#### 템플릿 선택 핸들러
```typescript
const handleSelectNhnTemplate = (tpl: any) => {
    // 1. 템플릿 내용 적용
    setKakaoContent(tpl.templateContent);
    setKakaoTemplateCode(tpl.templateCode);

    // 2. 버튼 파싱 및 적용
    if (tpl.buttons && Array.isArray(tpl.buttons)) {
        const mappedButtons = tpl.buttons.map((b: any) => ({
            name: b.name,
            type: b.linkType || 'WL',
            linkMobile: b.linkMo || '',
            linkPc: b.linkPc || ''
        }));
        setKakaoButtons(mappedButtons);
    } else {
        setKakaoButtons([]);
    }

    // 3. 승인 상태 설정 (승인된 템플릿만 불러오므로 항상 APPROVED)
    setKakaoStatus('APPROVED');

    setIsNhnImportOpen(false);
    toast.success("NHN Cloud 템플릿을 불러왔습니다.");
};
```

---

### 3. **UI 컴포넌트** ✅

#### "NHN Cloud 불러오기" 버튼
```tsx
<Button
    variant="outline"
    size="sm"
    onClick={handleFetchNhnTemplates}
    disabled={loadingNhn}
    className="h-7 text-xs border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
>
    {loadingNhn ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Download className="w-3 h-3 mr-1" />}
    NHN Cloud 불러오기
</Button>
```

#### 템플릿 선택 Dialog
```tsx
<Dialog open={isNhnImportOpen} onOpenChange={setIsNhnImportOpen}>
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
            <DialogTitle>NHN Cloud 템플릿 불러오기</DialogTitle>
            <DialogDescription>
                NHN Cloud에 등록된 승인된 알림톡 템플릿 목록입니다.
            </DialogDescription>
        </DialogHeader>

        <div className="p-6">
            {nhnTemplates.map((tpl: any) => (
                <Card key={tpl.templateCode} onClick={() => handleSelectNhnTemplate(tpl)}>
                    <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h5>{tpl.templateName}</h5>
                                <p className="text-xs text-slate-400 font-mono">{tpl.templateCode}</p>
                            </div>
                            <Badge className="bg-emerald-500">승인됨</Badge>
                        </div>
                        <div className="bg-emerald-50/30 p-3 rounded-lg">
                            <p className="text-xs whitespace-pre-wrap">{tpl.templateContent}</p>
                        </div>
                        {tpl.buttons && tpl.buttons.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {tpl.buttons.map((btn: any, idx: number) => (
                                    <Badge key={idx} variant="outline">🔘 {btn.name}</Badge>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    </DialogContent>
</Dialog>
```

---

## 🎨 UI 특징

### 색상 구분
- **NHN Cloud**: 🟢 Emerald (녹색) - 새로운 시스템
- **Aligo**: 🟡 Amber (황색) - 레거시 시스템

### 사용자 경험
1. ✅ **자동 검증**: Infrastructure 설정에서 senderKey 자동 조회
2. ✅ **친절한 에러 메시지**: 설정 누락 시 안내 메시지
3. ✅ **승인 템플릿만 표시**: 사용 불가능한 템플릿 제외
4. ✅ **로딩 상태 표시**: 버튼에 스피너 애니메이션
5. ✅ **성공 피드백**: 불러온 템플릿 개수 표시

---

## 📋 사용 방법

### 1단계: Infrastructure 설정
1. Admin > Infrastructure Settings 접속
2. Notification Service > NHN Cloud AlimTalk 활성화
3. 발신 프로필 키 입력: `514116f024d8e322cc2a82a3503bb2eb178370f3`
4. 저장

### 2단계: 템플릿 불러오기
1. Admin > Templates 접속
2. 원하는 이벤트 타입 선택
3. "새 템플릿 생성" 클릭
4. 알림톡 설정 섹션에서 **"NHN Cloud 불러오기"** 버튼 클릭
5. 승인된 템플릿 목록에서 선택
6. 자동으로 내용, 버튼, 템플릿 코드 적용됨
7. 필요시 수정 후 저장

---

## 🔍 데이터 흐름

```
1. 사용자가 "NHN Cloud 불러오기" 클릭
   ↓
2. Infrastructure 설정에서 senderKey 조회
   ↓
3. Cloud Function 호출 (getNhnAlimTalkTemplates)
   ↓
4. NHN Cloud API 호출 (getTemplates)
   ↓
5. 승인된 템플릿만 필터링 (templateStatus === 'APR')
   ↓
6. Frontend에 결과 반환
   ↓
7. Dialog에 템플릿 목록 표시
   ↓
8. 사용자가 템플릿 선택
   ↓
9. 폼에 자동 적용 (content, buttons, templateCode, status)
```

---

## ✅ 체크리스트

### Backend
- [x] Cloud Function `getNhnAlimTalkTemplates` 생성
- [x] 승인된 템플릿만 필터링 로직
- [x] 인증 검증
- [x] 에러 핸들링

### Frontend
- [x] State 추가 (isNhnImportOpen, nhnTemplates, loadingNhn)
- [x] handleFetchNhnTemplates 함수
- [x] handleSelectNhnTemplate 함수
- [x] "NHN Cloud 불러오기" 버튼 UI
- [x] 템플릿 선택 Dialog UI
- [x] getDoc import 추가

### UX
- [x] Infrastructure 설정 자동 조회
- [x] senderKey 누락 시 안내 메시지
- [x] 승인된 템플릿 개수 표시
- [x] 로딩 상태 표시
- [x] 버튼 정보 표시
- [x] 승인 상태 뱃지

---

## 🚀 다음 단계

### 즉시 테스트 가능
1. **Infrastructure 설정 완료**
   ```
   Admin > Infrastructure Settings
   → NHN Cloud AlimTalk 활성화
   → senderKey: 514116f024d8e322cc2a82a3503bb2eb178370f3
   → 저장
   ```

2. **템플릿 불러오기 테스트**
   ```
   Admin > Templates
   → 이벤트 타입 선택
   → "새 템플릿 생성"
   → "NHN Cloud 불러오기" 클릭
   → 템플릿 선택
   ```

### 추가 개선 사항 (선택)
- [ ] 템플릿 미리보기 기능
- [ ] 템플릿 검색/필터링
- [ ] 최근 사용한 템플릿 표시
- [ ] 템플릿 즐겨찾기 기능

---

## 📖 관련 문서

- **NHN_ALIMTALK_GUIDE.md** - 완전한 API 가이드
- **NHN_ALIMTALK_INTEGRATION.md** - 통합 개요
- **functions/src/utils/nhnAlimTalk.ts** - 핵심 API 함수
- **functions/src/utils/nhnAlimTalk.examples.ts** - 사용 예제

---

## 🎉 완료!

**승인된 템플릿만 정확하게 불러와 적용하는 기능**이 완벽하게 구현되었습니다!

- ✅ Cloud Function에서 승인 템플릿 필터링
- ✅ UI에서 승인 상태 표시
- ✅ 자동으로 APPROVED 상태 설정
- ✅ 버튼 정보 자동 파싱 및 적용
- ✅ 템플릿 코드 자동 적용

**마지막 업데이트**: 2026-02-09 15:45
