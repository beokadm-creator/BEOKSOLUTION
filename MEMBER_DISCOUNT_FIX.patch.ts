/**
 * MEMBER DISCOUNT FIX - RegistrationPage.tsx 패치
 * 
 * 문제: 마이페이지에서 회원 인증을 받은 후 등록 페이지 재방문 시
 *      회원 할인 가격이 적용되지 않고 비회원 가격이 표시되는 현상
 * 
 * 원인: memberVerificationData가 로드되지 않아 등급 매칭 및 가격 계산 실패
 * 
 * 해결: 마이페이지 인증 정보(affiliations)를 자동으로 로드
 */

// ============================================================================
// PATCH 1: 마이페이지 인증 데이터 자동 로드
// ============================================================================
// 위치: src/pages/RegistrationPage.tsx
// 삽입 위치: Line 356 이후 (기존 useEffect 직후)

`
    // [FIX-DISCOUNT] Load memberVerificationData from affiliations (마이페이지 인증 정보)
    useEffect(() => {
        // Skip if already has data from current verification
        if (memberVerificationData) return;
        
        // Check if user is verified and has affiliations data
        if (!auth.user || !info?.societyId || !isVerified) return;
        
        const affiliations = (auth.user as any)?.affiliations || {};
        const societyAffiliation = affiliations[info?.societyId];
        
        if (societyAffiliation?.grade) {
            // 마이페이지에서 저장된 인증 정보로 memberVerificationData 초기화
            const affiliationData = {
                grade: societyAffiliation.grade,
                id: societyAffiliation.id,
                name: societyAffiliation.name,
                licenseNumber: societyAffiliation.licenseNumber,
                societyId: info.societyId,
                expiryDate: societyAffiliation.expiryDate,
                expiry: societyAffiliation.expiryDate
            };
            
            setMemberVerificationData(affiliationData);
            console.log('[MemberDiscount] Loaded affiliation data from MyPage:', {
                society: info.societyId,
                grade: societyAffiliation.grade,
                verified: isVerified
            });
        }
    }, [auth.user, info?.societyId, isVerified, memberVerificationData]);
`;

// ============================================================================
// PATCH 2: 강화된 가격 조회 함수
// ============================================================================
// 위치: src/pages/RegistrationPage.tsx
// 위치: handleContinueStep (가격 계산 섹션)
// 라인: 약 813-825

// 기존 코드:
`
            // Calculate Price
            const periodName = language === 'ko' ? activePeriod.name.ko : (activePeriod.name.en || activePeriod.name.ko);
            // 가격 찾기 우선순위: ID -> Code -> Name
            const priceKey = selectedGradeId;
            const tierPrice = activePeriod.prices[priceKey]
                           ?? activePeriod.prices[selectedGrade?.code || '']
                           ?? activePeriod.prices[selectedGrade?.name || ''];
`;

// 수정된 코드:
`
            // Calculate Price with Enhanced Normalization
            const periodName = language === 'ko' ? activePeriod.name.ko : (activePeriod.name.en || activePeriod.name.ko);
            
            // [FIX-DISCOUNT] Enhanced price lookup with normalization
            const findMatchingPrice = (gradeInfo: any, prices: Record<string, number>): number | null => {
                if (!gradeInfo?.grade || !prices) return null;
                
                const serverGrade = String(gradeInfo.grade).trim();
                
                // Try multiple format variations
                const variants = [
                    serverGrade.toLowerCase(),                          // "dental hygienist"
                    serverGrade.toLowerCase().replace(/\s+/g, '_'),    // "dental_hygienist"
                    serverGrade.toLowerCase().replace(/\s+/g, ''),     // "dentalhygienist"
                    serverGrade.replace(/\s+/g, '_').toLowerCase(),    // "dental_hygienist" (alternate)
                ];
                
                for (const variant of variants) {
                    if (prices[variant] !== undefined) {
                        console.log(\`[MemberDiscount] Price match found: "\${serverGrade}" → "\${variant}" = \${prices[variant]}\`);
                        return prices[variant];
                    }
                }
                
                console.warn(\`[MemberDiscount] No price found for grade "\${serverGrade}"\`);
                console.warn('[MemberDiscount] Available price keys:', Object.keys(prices));
                return null;
            };
            
            // Priority: affiliations grade -> selectedGrade
            const tierPrice = findMatchingPrice(memberVerificationData, activePeriod?.prices || {})
                           ?? activePeriod?.prices[selectedGradeId]
                           ?? activePeriod?.prices[selectedGrade?.code || '']
                           ?? activePeriod?.prices[selectedGrade?.name || ''];
`;

// ============================================================================
// PATCH 3: 디버깅 로깅 추가 (선택사항)
// ============================================================================
// 등급 자동 선택 로직에 로깅 추가

`
    // [FIX-DISCOUNT] Debug logging in grade auto-selection
    useEffect(() => {
        if (grades.length === 0) return;

        const nonMemberGrade = grades.find(g => {
            const n = (g.name || '').toLowerCase();
            return n.includes('비회원') || n.includes('non-member') || n.includes('non member');
        });

        if (isVerified) {
            console.log('[MemberDiscount] Verified state detected. memberVerificationData:', memberVerificationData);
            
            // Case A: Verified -> Auto-select matching grade
            if (memberVerificationData?.grade) {
                const rawServer = String(memberVerificationData.grade).toLowerCase();
                const normalizedServer = rawServer.replace(/\s/g, '');
                
                console.log('[MemberDiscount] Attempting grade match:', {
                    raw: memberVerificationData.grade,
                    normalized: normalizedServer,
                    availableGrades: grades.map(g => ({ id: g.id, code: g.code, name: g.name }))
                });

                const matched = grades.find(g => {
                    const gCode = (g.code || '').toLowerCase().replace(/\s/g, '');
                    const gName = (g.name || '').toLowerCase().replace(/\s/g, '');
                    return gCode === normalizedServer || gName === normalizedServer || gName.includes(normalizedServer);
                });

                if (matched) {
                    console.log('[MemberDiscount] ✅ Grade matched successfully:', matched.id, matched.name);
                    if (selectedGradeId !== matched.id) {
                        setSelectedGradeId(matched.id);
                    }
                } else {
                    console.warn('[MemberDiscount] ⚠️ Grade matching FAILED. Keeping current selection:', selectedGradeId);
                }
            } else {
                console.warn('[MemberDiscount] ⚠️ isVerified=true but memberVerificationData is empty!');
            }
        } else {
            console.log('[MemberDiscount] Not verified - using non-member grade');
            if (nonMemberGrade && selectedGradeId !== nonMemberGrade.id) {
                setSelectedGradeId(nonMemberGrade.id);
            }
        }
    }, [isVerified, grades, memberVerificationData, selectedGradeId]);
`;

// ============================================================================
// IMPLEMENTATION CHECKLIST
// ============================================================================

/*

1. PATCH 1 적용 (마이페이지 인증 데이터 로드)
   - 파일: src/pages/RegistrationPage.tsx
   - 위치: Line 356 이후 (기존 useEffect 직후에 새로운 useEffect 추가)
   - 효과: isVerified=true일 때 auth.user.affiliations[societyId]에서 grade 정보 로드

2. PATCH 2 적용 (가격 조회 로직 강화)
   - 파일: src/pages/RegistrationPage.tsx
   - 함수: handleContinueStep()
   - 위치: 라인 813-825 근처 (가격 계산 섹션)
   - 효과: 다양한 형식의 등급명을 가격 키로 정규화하여 조회

3. PATCH 3 적용 (선택사항 - 디버깅용)
   - 파일: src/pages/RegistrationPage.tsx
   - 함수: useEffect (라인 387 근처)
   - 효과: 콘솔 로그를 통해 문제 추적 용이

4. 테스트
   - KADD 회원으로 로그인
   - 마이페이지 방문 → 회원 인증 수행
   - 콘퍼런스 등록 페이지 재방문
   - Console 확인: [MemberDiscount] 로그 확인
   - 등급 자동 선택 확인
   - 할인 가격 표시 확인 ✅

5. 배포
   - 테스트 환경에서 검증 후
   - Production 배포

*/

// ============================================================================
// DEBUGGING TIPS
// ============================================================================

/*

문제 진단을 위한 콘솔 확인 사항:

1. 인증 상태 확인
   - "[Persistence] User already verified for kadd" 메시지 확인

2. 인증 데이터 로드
   - "[MemberDiscount] Loaded affiliation data from MyPage" 메시지 확인

3. 등급 매칭
   - "[MemberDiscount] ✅ Grade matched successfully" 확인
   - 또는 "[MemberDiscount] ⚠️ Grade matching FAILED" 경고

4. 가격 조회
   - "[MemberDiscount] Price match found: ... = ..." 메시지 확인
   - 또는 "[MemberDiscount] No price found for grade ..." 경고

만약 아래 메시지가 나타나면:
   "[MemberDiscount] ⚠️ isVerified=true but memberVerificationData is empty!"
   → PATCH 1이 정상 적용되지 않았을 가능성

*/
