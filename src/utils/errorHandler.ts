/**
 * Error Handler Utility
 *
 * 목적: 타입 안전한 에러 처리를 위한 헬퍼 함수
 * - `catch (error: any)` 패턴을 제거하기 위함
 * - 모든 에러를 `unknown`으로 처리 후 타입 가드
 */

/**
 * 에러 메시지 추출
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message);
  }
  return '알 수 없는 오류가 발생했습니다.';
}

/**
 * 에러 코드 추출
 */
export function getErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String(error.code);
  }
  return 'UNKNOWN';
}

/**
 * Firebase Auth 에러 처리
 */
export function getAuthErrorMessage(error: unknown): string {
  const message = getErrorMessage(error);
  const code = getErrorCode(error);

  // Firebase Auth 에러 코드 한글화
  const authErrorMessages: Record<string, string> = {
    'auth/user-not-found': '사용자를 찾을 수 없습니다.',
    'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
    'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
    'auth/invalid-email': '올바르지 않은 이메일 형식입니다.',
    'auth/user-disabled': '사용이 정지된 계정입니다.',
    'auth/too-many-requests': '너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.',
    'auth/network-request-failed': '네트워크 연결에 실패했습니다.',
  };

  return authErrorMessages[code] || message;
}

/**
 * Firestore 에러 처리
 */
export function getFirestoreErrorMessage(error: unknown): string {
  const message = getErrorMessage(error);
  const code = getErrorCode(error);

  // Firestore 에러 코드 한글화
  const firestoreErrorMessages: Record<string, string> = {
    'permission-denied': '접근 권한이 없습니다.',
    'not-found': '문서를 찾을 수 없습니다.',
    'already-exists': '이미 존재하는 문서입니다.',
    'unavailable': '서비스를 일시적으로 사용할 수 없습니다.',
    'deadline-exceeded': '요청 시간이 초과되었습니다.',
  };

  return firestoreErrorMessages[code] || message;
}

/**
 * 에러를 Error 객체로 변환
 */
export function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  
  const message = getErrorMessage(error);
  const code = getErrorCode(error);
  
  const newError = new Error(message);
  (newError as { code?: string }).code = code;
  return newError;
}

/**
 * 에러 로깅 (콘솔� 호환용)
 */
export function logError(context: string, error: unknown): void {
  const message = getErrorMessage(error);
  const code = getErrorCode(error);
  
  console.error(`[${context}] Error [${code}]:`, message);
  
  // 개발 환경에서만 스택 트레이스 출력
  if (process.env?.NODE_ENV === 'development' && error instanceof Error) {
    console.error('Stack trace:', error.stack);
  }
}

/**
 * 에러를 던지면서 로깅
 */
export function throwError(context: string, error: unknown): never {
  logError(context, error);
  throw toError(error);
}

/**
 * 사용자에게 표시할 에러 메시지 생성
 */
export function getUserFriendlyMessage(error: unknown): string {
  const message = getErrorMessage(error);
  
  // 기술적 메시지를 사용자 친화적으로 변환
  const userMessages: Record<string, string> = {
    'Network Error': '네트워크 연결을 확인해주세요.',
    'Failed to fetch': '서버 연결에 실패했습니다.',
  };

  return userMessages[message] || message;
}
