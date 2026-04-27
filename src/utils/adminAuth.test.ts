import { isSuperAdmin, validateSuperAdminAccess } from './adminAuth';
import { SUPER_ADMIN_EMAILS } from '../constants/adminConstants';

const knownAdminEmail = SUPER_ADMIN_EMAILS[0];

describe('adminAuth', () => {
  describe('isSuperAdmin', () => {
    it('슈퍼 관리자 이메일이면 true를 반환한다', () => {
      expect(isSuperAdmin(knownAdminEmail)).toBe(true);
    });

    it('일반 사용자 이메일이면 false를 반환한다', () => {
      expect(isSuperAdmin('user@example.com')).toBe(false);
      expect(isSuperAdmin('admin@example.com')).toBe(false);
      expect(isSuperAdmin('test@test.com')).toBe(false);
    });

    it('null을 처리한다', () => {
      expect(isSuperAdmin(null)).toBe(false);
    });

    it('undefined를 처리한다', () => {
      expect(isSuperAdmin(undefined)).toBe(false);
    });

    it('빈 문자열을 처리한다', () => {
      expect(isSuperAdmin('')).toBe(false);
    });

    it('대소문자를 구분한다', () => {
      expect(isSuperAdmin(knownAdminEmail.toUpperCase())).toBe(false);
    });

    it('이메일 형식이 아닌 문자열도 처리한다', () => {
      expect(isSuperAdmin('not-an-email')).toBe(false);
    });
  });

  describe('validateSuperAdminAccess', () => {
    it('슈퍼 관리자 이메일로 접근을 허용한다', () => {
      expect(validateSuperAdminAccess(knownAdminEmail)).toBe(true);
    });

    it('일반 사용자 이메일은 접근을 거부한다', () => {
      expect(validateSuperAdminAccess('user@example.com')).toBe(false);
    });

    it('null이면 접근을 거부한다', () => {
      expect(validateSuperAdminAccess(null)).toBe(false);
    });

    it('undefined이면 접근을 거부한다', () => {
      expect(validateSuperAdminAccess(undefined)).toBe(false);
    });

    it('빈 문자열이면 접근을 거부한다', () => {
      expect(validateSuperAdminAccess('')).toBe(false);
    });
  });
});
