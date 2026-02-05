/**
 * errorHandler 테스트
 *
 * 목적: 타입 안전한 에러 처리 유틸리티 테스트
 */

import {
  getErrorMessage,
  getErrorCode,
  getAuthErrorMessage,
  getFirestoreErrorMessage,
  toError,
  logError,
  throwError,
  getUserFriendlyMessage,
} from './errorHandler';

describe('errorHandler', () => {
  describe('getErrorMessage', () => {
    it('Error 객체에서 메시지를 추출한다', () => {
      const error = new Error('Test error');
      expect(getErrorMessage(error)).toBe('Test error');
    });

    it('문자열을 그대로 반환한다', () => {
      expect(getErrorMessage('String error')).toBe('String error');
    });

    it('객체의 message 속성을 추출한다', () => {
      const error = { message: 'Object error' };
      expect(getErrorMessage(error)).toBe('Object error');
    });

    it('null을 처리한다', () => {
      expect(getErrorMessage(null)).toBe('알 수 없는 오류가 발생했습니다.');
    });

    it('undefined를 처리한다', () => {
      expect(getErrorMessage(undefined)).toBe('알 수 없는 오류가 발생했습니다.');
    });

    it('숫자를 처리한다', () => {
      expect(getErrorMessage(123)).toBe('알 수 없는 오류가 발생했습니다.');
    });

    it('빈 문자열을 처리한다', () => {
      expect(getErrorMessage('')).toBe('');
    });
  });

  describe('getErrorCode', () => {
    it('객체의 code 속성을 추출한다', () => {
      const error = { code: 'ERR-001' };
      expect(getErrorCode(error)).toBe('ERR-001');
    });

    it('Error 객체의 code를 추출한다', () => {
      const error = new Error('Test');
      (error as Error & { code?: string }).code = 'ERR-002';
      expect(getErrorCode(error)).toBe('ERR-002');
    });

    it('code가 없으면 UNKNOWN을 반환한다', () => {
      expect(getErrorCode(new Error('Test'))).toBe('UNKNOWN');
      expect(getErrorCode('string')).toBe('UNKNOWN');
      expect(getErrorCode(null)).toBe('UNKNOWN');
    });
  });

  describe('getAuthErrorMessage', () => {
    it('Firebase Auth 에러를 한글로 변환한다', () => {
      const error = { code: 'auth/user-not-found' };
      expect(getAuthErrorMessage(error)).toBe('사용자를 찾을 수 없습니다.');
    });

    it('잘못된 비밀번호 에러를 변환한다', () => {
      const error = { code: 'auth/wrong-password' };
      expect(getAuthErrorMessage(error)).toBe('비밀번호가 올바르지 않습니다.');
    });

    it('알 수 없는 인증 에러는 원본 메시지 반환', () => {
      const error = new Error('Custom auth error');
      expect(getAuthErrorMessage(error)).toBe('Custom auth error');
    });
  });

  describe('getFirestoreErrorMessage', () => {
    it('permission-denied를 한글로 변환한다', () => {
      const error = { code: 'permission-denied' };
      expect(getFirestoreErrorMessage(error)).toBe('접근 권한이 없습니다.');
    });

    it('not-found를 한글로 변환한다', () => {
      const error = { code: 'not-found' };
      expect(getFirestoreErrorMessage(error)).toBe('문서를 찾을 수 없습니다.');
    });

    it('알 수 없는 Firestore 에러는 원본 메시지 반환', () => {
      const error = new Error('Custom Firestore error');
      expect(getFirestoreErrorMessage(error)).toBe('Custom Firestore error');
    });
  });

  describe('toError', () => {
    it('Error 객체를 그대로 반환한다', () => {
      const original = new Error('Test');
      const result = toError(original);
      
      expect(result).toBe(original);
    });

    it('문자열을 Error 객체로 변환한다', () => {
      const result = toError('String error');
      
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('String error');
    });

    it('객체를 Error 객체로 변환하고 code를 보존한다', () => {
      const error = { message: 'Test', code: 'ERR-001' };
      const result = toError(error);
      
      expect(result.message).toBe('Test');
      expect((result as Error & { code?: string }).code).toBe('ERR-001');
    });

    it('null을 Error로 변환한다', () => {
      const result = toError(null);
      
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('알 수 없는 오류가 발생했습니다.');
    });
  });

  describe('logError', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('에러를 콘솔에 로깅한다', () => {
      const error = new Error('Test error');
      logError('TestContext', error);
      
      expect(console.error).toHaveBeenCalledWith(
        '[TestContext] Error [UNKNOWN]:',
        'Test error'
      );
    });

    it('code가 포함된 에러를 로깅한다', () => {
      const error = { message: 'Test', code: 'ERR-001' };
      logError('TestContext', error);
      
      expect(console.error).toHaveBeenCalledWith(
        '[TestContext] Error [ERR-001]:',
        'Test'
      );
    });

    it('개발 환경에서 스택 트레이스를 출력한다', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Test');
      error.stack = 'Test stack trace';
      
      logError('TestContext', error);
      
      expect(console.error).toHaveBeenCalledWith('Stack trace:', 'Test stack trace');
      
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('throwError', () => {
    it('에러를 던지면서 로깅한다', () => {
      expect(() => {
        throwError('TestContext', new Error('Test error'));
      }).toThrow('Test error');
    });

    it('문자열도 던질 수 있다', () => {
      expect(() => {
        throwError('TestContext', 'String error');
      }).toThrow('String error');
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('기술적 메시지를 사용자 친화적으로 변환한다', () => {
      const error = new Error('Network Error');
      expect(getUserFriendlyMessage(error)).toBe('네트워크 연결을 확인해주세요.');
    });

    it('Failed to fetch를 변환한다', () => {
      const error = new Error('Failed to fetch');
      expect(getUserFriendlyMessage(error)).toBe('서버 연결에 실패했습니다.');
    });

    it('일반 메시지는 그대로 반환한다', () => {
      const error = new Error('일반 에러');
      expect(getUserFriendlyMessage(error)).toBe('일반 에러');
    });
  });
});
