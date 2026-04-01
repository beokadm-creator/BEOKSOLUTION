---
precedence: 15
required-for: []
optional-for:
  - historical-reference
memory-type: archive
token-estimate: 306
@include:
  - ../shared/AI_DOC_SHARED_RULES.md
  - ../shared/ESSENTIAL_POST_COMPACT.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Classified as historical archive under the markdown governance schema.
---

<!-- STATIC:BEGIN -->

# 헬스체크 및 알림톡 설정 안내

## 🚀 헬스체크 기능 업데이트 완료

헬스체크에서 발생하던 "환경 변수 누락" 경고를 해결했습니다.
우리 시스템은 `ALIGO_API_KEY` 같은 설정을 환경 변수가 아닌 **Firestore 설정 문서**에서 안전하게 관리하고 있습니다.
따라서 헬스체크 로직에서 불필요한 환경 변수 확인 과정을 제거했습니다.

**지금 다시 확인해보시면 "✅ 정상"으로 표시될 것입니다.**

### 헬스체크 확인 방법
1. **슈퍼어드민 페이지** → **모니터링** 탭
2. **직접 링크**: https://us-central1-eregi-8fc1e.cloudfunctions.net/healthCheck

---

## 🔎 알림톡 설정 상세 확인

환경 변수가 아닌 실제 DB에 저장된 알림톡 설정이 올바른지 확인하려면, 제가 새로 만든 **"알림톡 설정 확인"** 기능을 사용하세요.

### 사용 방법
1. **슈퍼어드민 페이지** → **모니터링** 탭
2. 오른쪽 **"알림톡 설정 확인"** 카드에서 학회(예: KAP) 선택 후 **"확인"** 버튼 클릭

### 확인 항목
- ✅ 템플릿 등록 여부 (총 개수, 활성 개수)
- ✅ 카카오 승인 상태
- ✅ Aligo API Key 및 User ID 설정 여부

**직접 링크로 확인하기**:
```
https://us-central1-eregi-8fc1e.cloudfunctions.net/checkAlimTalkConfigHttp?societyId=kap
```

---

## 🏆 안정화 버전 (v3.5.8-stable)

현재 상태를 안정화 버전으로 확정하고 태그를 생성했습니다.

- **버전**: `v3.5.8-stable`
- **주요 포함 사항**:
  - React 버전 고정 (19.2.3)
  - 헬스체크 시스템 개선
  - 알림톡 설정 확인 기능 추가
  - 배포 안전성 강화

이제 안심하고 서비스를 운영하실 수 있습니다! 🚀

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

Update this section only for volatile facts such as current status, versions, owners, or execution notes.

<!-- DYNAMIC:END -->
