/**
 * pathHelper 테스트
 *
 * 목적: 경로 생성 유틸리티 테스트
 * - getSocietyAdminPath: 학회 관리자 경로 생성 (서브도메인 최적화)
 */

import { getSocietyAdminPath } from './pathHelper';

describe('pathHelper', () => {
  describe('getSocietyAdminPath', () => {
    it('서브도메인이 일치하면 SID를 생략한다', () => {
      const result = getSocietyAdminPath('kap', 'content', 'kap');
      expect(result).toBe('/admin/society/content');
    });

    it('서브도메인이 일치하면 SID를 생략한다 (슬래시 포함 subPath)', () => {
      const result = getSocietyAdminPath('kap', '/content', 'kap');
      expect(result).toBe('/admin/society/content');
    });

    it('서브도메인이 다르면 SID를 포함한다', () => {
      const result = getSocietyAdminPath('kap', 'content', 'kadd');
      expect(result).toBe('/admin/society/kap/content');
    });

    it('서브도메인이 null이면 SID를 포함한다', () => {
      const result = getSocietyAdminPath('kap', 'content', null);
      expect(result).toBe('/admin/society/kap/content');
    });

    it('여러 경로 계층을 처리한다', () => {
      const result = getSocietyAdminPath('kap', 'members/list', 'kap');
      expect(result).toBe('/admin/society/members/list');
    });

    it('중첩 경로를 처리한다', () => {
      const result = getSocietyAdminPath('kap', 'infra/settings', 'kadd');
      expect(result).toBe('/admin/society/kap/infra/settings');
    });

    it('루트 경로를 처리한다', () => {
      const result = getSocietyAdminPath('kap', '', 'kap');
      expect(result).toBe('/admin/society/');
    });

    it('빈 subPath를 처리한다', () => {
      const result = getSocietyAdminPath('kap', '', 'kadd');
      expect(result).toBe('/admin/society/kap/');
    });

    it('연속 슬래시를 방지한다', () => {
      const result = getSocietyAdminPath('kap', '/content', 'kap');
      expect(result).toBe('/admin/society/content');
      expect(result).not.toContain('//');
    });

    it('다양한 society ID를 처리한다', () => {
      expect(getSocietyAdminPath('kadd', 'members', 'kadd')).toBe('/admin/society/members');
      expect(getSocietyAdminPath('kaid', 'content', 'kap')).toBe('/admin/society/kaid/content');
    });

    it('트레일링 슬래시를 처리한다', () => {
      const result = getSocietyAdminPath('kap', 'content/', 'kap');
      expect(result).toBe('/admin/society/content/');
    });

    it('대소문자를 구분한다', () => {
      const result = getSocietyAdminPath('KAP', 'content', 'kap');
      expect(result).toBe('/admin/society/KAP/content'); // SID는 대소문자 구분
    });
  });
});
