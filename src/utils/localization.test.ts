/**
 * localization 테스트
 *
 * 목적: 다국어 텍스트 처리 유틸리티 테스트
 * - getText: LocalizedText에서 언어별 텍스트 추출
 */

import { getText, Language } from './localization';
import type { LocalizedText } from '../types/schema';

describe('localization', () => {
  describe('getText', () => {
    it('undefined를 처리한다 (빈 문자열 반환)', () => {
      const result = getText(undefined, 'ko');
      expect(result).toBe('');
    });

    it('null을 처리한다 (빈 문자열 반환)', () => {
      const result = getText(null as unknown as LocalizedText, 'ko');
      expect(result).toBe('');
    });

    it('한국어만 있는 경우 한국어를 반환한다', () => {
      const text: LocalizedText = { ko: '안녕하세요' };
      const result = getText(text, 'ko');
      expect(result).toBe('안녕하세요');
    });

    it('영어만 있는 경우 한국어 요청 시 undefined를 반환한다 (ko가 없음)', () => {
      const text = { en: 'Hello', ko: undefined } as LocalizedText;
      const result = getText(text, 'ko');
      expect(result).toBeUndefined(); // ko가 undefined면 undefined 반환
    });

    it('영어 요청 시 영어를 반환한다', () => {
      const text: LocalizedText = { ko: '안녕하세요', en: 'Hello' };
      const result = getText(text, 'en');
      expect(result).toBe('Hello');
    });

    it('한국어 요청 시 한국어를 반환한다', () => {
      const text: LocalizedText = { ko: '안녕하세요', en: 'Hello' };
      const result = getText(text, 'ko');
      expect(result).toBe('안녕하세요');
    });

    it('빈 문자열도 처리한다', () => {
      const text: LocalizedText = { ko: '', en: '' };
      const result = getText(text, 'ko');
      expect(result).toBe('');
    });

    it('영어가 없으면 한국어를 반환한다 (영어 요청)', () => {
      const text: LocalizedText = { ko: '안녕하세요', en: '' };
      const result = getText(text, 'en');
      expect(result).toBe('안녕하세요'); // fallback to ko
    });

    it('Language 타입을 사용한다', () => {
      const text: LocalizedText = { ko: '안녕하세요', en: 'Hello' };
      const lang: Language = 'en';
      const result = getText(text, lang);
      expect(result).toBe('Hello');
    });
  });
});
