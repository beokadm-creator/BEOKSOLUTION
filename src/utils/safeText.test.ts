/**
 * safeText 테스트
 *
 * 목적: 안전한 텍스트 변환 유틸리티 테스트
 * - 모든 타입을 안전하게 문자열로 변환
 * - XSS 방지를 위한 정제
 */

import { safeText } from './safeText';
import type { LocalizedText } from '../types/schema';

describe('safeText', () => {
  describe('null/undefined 처리', () => {
    it('null을 빈 문자열로 변환한다', () => {
      expect(safeText(null)).toBe('');
    });

    it('undefined를 빈 문자열로 변환한다', () => {
      expect(safeText(undefined)).toBe('');
    });
  });

  describe('기본 타입 처리', () => {
    it('문자열을 그대로 반환한다', () => {
      expect(safeText('안녕하세요')).toBe('안녕하세요');
      expect(safeText('Hello')).toBe('Hello');
      expect(safeText('')).toBe('');
    });

    it('숫자를 문자열로 변환한다', () => {
      expect(safeText(123)).toBe('123');
      expect(safeText(0)).toBe('0');
      expect(safeText(-456)).toBe('-456');
      expect(safeText(3.14)).toBe('3.14');
    });

    it('불리언을 문자열로 변환한다', () => {
      expect(safeText(true)).toBe('true');
      expect(safeText(false)).toBe('false');
    });
  });

  describe('객체 처리', () => {
    it('LocalizedText {ko, en}에서 ko를 우선 반환한다', () => {
      const text: LocalizedText = { ko: '안녕하세요', en: 'Hello' };
      expect(safeText(text)).toBe('안녕하세요');
    });

    it('ko가 없으면 en을 반환한다', () => {
      const text: LocalizedText = { en: 'Hello' } as LocalizedText;
      expect(safeText(text)).toBe('Hello');
    });

    it('ko, en이 없으면 title을 반환한다', () => {
      const obj = { title: '제목' };
      expect(safeText(obj)).toBe('제목');
    });

    it('모든 필드가 없으면 JSON 문자열을 반환한다', () => {
      const obj = { other: 'value' };
      expect(safeText(obj)).toBe('{"other":"value"}');
    });

    it('빈 객체를 처리한다', () => {
      expect(safeText({})).toBe('{}');
    });

    it('중첩 객체를 JSON으로 변환한다', () => {
      const obj = { nested: { value: 123 } };
      expect(safeText(obj)).toBe('{"nested":{"value":123}}');
    });
  });

  describe('배열 처리', () => {
    it('배열을 JSON 문자열로 변환한다', () => {
      expect(safeText([1, 2, 3])).toBe('[1,2,3]');
    });

    it('빈 배열을 처리한다', () => {
      expect(safeText([])).toBe('[]');
    });

    it('객체 배열을 JSON으로 변환한다', () => {
      const arr = [{ id: 1 }, { id: 2 }];
      expect(safeText(arr)).toBe('[{"id":1},{"id":2}]');
    });
  });

  describe('특수 값 처리', () => {
    it('Symbol을 문자열로 변환한다', () => {
      const sym = Symbol('test');
      expect(safeText(sym)).toBe('Symbol(test)');
    });

    it('함수를 문자열로 변환한다', () => {
      const fn = () => {};
      const result = safeText(fn);
      expect(result).toContain('() =>');
      expect(result).toContain('{ }');
    });

    it('Date 객체를 JSON으로 변환한다', () => {
      const date = new Date('2024-01-01');
      const result = safeText(date);
      expect(result).toContain('2024-01-01');
    });
  });

  describe('XSS 방지 (기본 동작 확인)', () => {
    it('스크립트 태그를 포함한 문자열을 그대로 반환한다 (에스케이프는 호출자 책임)', () => {
      // safeText는 변환만 수행하며, 에스케이프는 하지 않음
      const malicious = '<script>alert("XSS")</script>';
      expect(safeText(malicious)).toBe(malicious);
    });

    it('HTML 엔티티를 포함한 문자열을 그대로 반환한다', () => {
      const html = '<div>Hello</div>';
      expect(safeText(html)).toBe(html);
    });
  });

  describe('한글 처리', () => {
    it('한글 문자열을 올바르게 처리한다', () => {
      expect(safeText('한글 테스트')).toBe('한글 테스트');
    });

    it('한글 포함 객체를 JSON으로 변환한다', () => {
      const obj = { message: '안녕하세요' };
      expect(safeText(obj)).toBe('{"message":"안녕하세요"}');
    });
  });

  describe('숫자 형식', () => {
    it('큰 숫자를 처리한다', () => {
      expect(safeText(1000000)).toBe('1000000');
    });

    it('소수점을 처리한다', () => {
      expect(safeText(0.001)).toBe('0.001');
    });

    it('지수 표기법을 처리한다', () => {
      expect(safeText(1e10)).toBe('10000000000');
    });
  });
});
