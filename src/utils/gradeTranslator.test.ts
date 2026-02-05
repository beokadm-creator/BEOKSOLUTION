/**
 * gradeTranslator 테스트
 *
 * 목적: 학회 등급 번역 유틸리티 테스트
 * - getGradeName: 등급 이름 반환 (현재는 identity 함수)
 */

import { getGradeName, GRADE_MAPPINGS } from './gradeTranslator';

describe('gradeTranslator', () => {
  describe('GRADE_MAPPINGS', () => {
    it('빈 객체로 시작한다', () => {
      expect(GRADE_MAPPINGS).toEqual({});
    });

    it('런타임에 등급 매핑을 추가할 수 있다', () => {
      // 런타임에 등급 매핑 추가 가능
      GRADE_MAPPINGS['정회원'] = 'Regular Member';
      expect(GRADE_MAPPINGS['정회원']).toBe('Regular Member');

      // 테스트 후 정리
      delete GRADE_MAPPINGS['정회원'];
    });
  });

  describe('getGradeName', () => {
    it('입력을 그대로 반환한다 (identity 함수)', () => {
      expect(getGradeName('정회원')).toBe('정회원');
      expect(getGradeName('준회원')).toBe('준회원');
      expect(getGradeName('Regular Member')).toBe('Regular Member');
    });

    it('빈 문자열을 처리한다', () => {
      expect(getGradeName('')).toBe('');
    });

    it('특수 문자를 포함한 등급도 처리한다', () => {
      expect(getGradeName('준비회원(예비)')).toBe('준비회원(예비)');
      expect(getGradeName('명예회원')).toBe('명예회원');
    });

    it('deprecated 함수지만 여전히 작동한다', () => {
      // 이 함수는 deprecated지만 하위 호환성을 위해 유지됨
      const result = getGradeName('테스트 등급');
      expect(result).toBe('테스트 등급');
    });

    it('한글 등급을 처리한다', () => {
      expect(getGradeName('정회원')).toBe('정회원');
      expect(getGradeName('준회원')).toBe('준회원');
      expect(getGradeName('준비회원')).toBe('준비회원');
    });

    it('영어 등급을 처리한다', () => {
      expect(getGradeName('Regular Member')).toBe('Regular Member');
      expect(getGradeName('Associate Member')).toBe('Associate Member');
    });

    it('혼합 등급을 처리한다', () => {
      expect(getGradeName('정회원 (Regular)')).toBe('정회원 (Regular)');
    });
  });
});
