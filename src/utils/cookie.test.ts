/**
 * cookie 테스트
 *
 * 목적: 쿠키 및 세션 관리 유틸리티 테스트
 * - setRootCookie: 도메인 레벨 쿠키 설정
 * - getRootCookie: 쿠키 값 조회
 * - removeRootCookie: 쿠키 삭제
 * - clearAllSessions: 모든 세션 클리어
 * - clearAuthSessions: 인증 세션 클리어
 * - clearNonMemberSessions: 비회원 세션 클리어
 */

// domainHelper 모킹 (import.meta.env 사용 문제 회피)
jest.mock('./domainHelper', () => ({
  DOMAIN_CONFIG: {
    BASE_DOMAIN: 'eregi.co.kr',
    IGNORED_SUBDOMAINS: ['www', 'admin', 'eregi'],
    IGNORED_SUFFIXES: ['.web.app', '.firebaseapp.com'],
    DEFAULT_SOCIETY: '',
  },
  extractSocietyFromHost: jest.fn(),
}));

// sessionStorage 모킹
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(global, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

// document.cookie 모킹 (jsdom의 도메인 제한 우회)
let cookieStore: Record<string, string> = {};
let rawCookieStrings: string[] = [];

const mockCookieGetter = () => {
  return Object.entries(cookieStore)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
};

const mockCookieSetter = (cookieString: string) => {
  rawCookieStrings.push(cookieString);

  const firstSemicolon = cookieString.indexOf(';');
  let nameValue: string;
  let remaining = '';

  if (firstSemicolon === -1) {
    nameValue = cookieString;
  } else {
    nameValue = cookieString.substring(0, firstSemicolon);
    remaining = cookieString.substring(firstSemicolon + 1);
  }

  const firstEqual = nameValue.indexOf('=');
  if (firstEqual === -1) return;

  const name = nameValue.substring(0, firstEqual).trim();
  const value = nameValue.substring(firstEqual + 1);

  const attrs: Record<string, string> = {};
  remaining.split(';').forEach(attr => {
    const [key, ...valParts] = attr.trim().split('=');
    attrs[key.toLowerCase()] = valParts.join('=');
  });

  if (attrs.expires && new Date(attrs.expires) < new Date()) {
    delete cookieStore[name];
  } else {
    cookieStore[name] = value;
  }
};

Object.defineProperty(document, 'cookie', {
  get: mockCookieGetter,
  set: mockCookieSetter,
  configurable: true,
});

import { setRootCookie, getRootCookie, removeRootCookie, SESSION_KEYS, clearAllSessions, clearAuthSessions, clearNonMemberSessions } from './cookie';

describe('cookie', () => {
  beforeEach(() => {
    cookieStore = {};
    rawCookieStrings = [];
    sessionStorageMock.getItem.mockClear();
    sessionStorageMock.setItem.mockClear();
    sessionStorageMock.removeItem.mockClear();
    sessionStorageMock.clear.mockClear();
  });

  describe('setRootCookie', () => {
    it('쿠키를 설정하면 document.cookie에서 읽을 수 있다', () => {
      setRootCookie('test_cookie', 'test_value', 7);

      const result = getRootCookie('test_cookie');
      expect(result).toBe('test_value');
    });

    it('기본 만료일은 7일이다', () => {
      setRootCookie('default_expiry', 'value');

      const rawCookie = rawCookieStrings.find(c => c.startsWith('default_expiry='));

      expect(rawCookie).toBeDefined();
      expect(rawCookie).toContain('max-age=604800');
    });

    it('커스텀 만료일을 설정할 수 있다', () => {
      setRootCookie('custom_expiry', 'value', 14);

      const rawCookie = rawCookieStrings.find(c => c.startsWith('custom_expiry='));

      expect(rawCookie).toBeDefined();
      expect(rawCookie).toContain('max-age=1209600');
    });

    it('쿠키에 올바른 속성이 포함된다', () => {
      setRootCookie('attr_test', 'value');

      const rawCookie = rawCookieStrings.find(c => c.startsWith('attr_test='));

      expect(rawCookie).toContain('path=/');
      expect(rawCookie).toContain('domain=.eregi.co.kr');
      expect(rawCookie).toContain('SameSite=None');
      expect(rawCookie).toContain('secure');
    });

    it('특수 문자가 포함된 값도 처리할 수 있다', () => {
      const specialValue = 'test:value/with-special_chars';
      setRootCookie('special_chars', specialValue);

      const result = getRootCookie('special_chars');
      expect(result).toBe(specialValue);
    });

    it('빈 문자열 값도 설정할 수 있다', () => {
      setRootCookie('empty_value', '');

      const result = getRootCookie('empty_value');
      expect(result).toBe('');
    });
  });

  describe('getRootCookie', () => {
    it('설정된 쿠키를 이름으로 읽을 수 있다', () => {
      document.cookie = 'test_cookie=test_value;path=/';

      const result = getRootCookie('test_cookie');
      expect(result).toBe('test_value');
    });

    it('존재하지 않는 쿠키는 null을 반환한다', () => {
      const result = getRootCookie('non_existent_cookie');
      expect(result).toBeNull();
    });

    it('여러 쿠키가 있어도 올바른 것을 찾는다', () => {
      document.cookie = 'cookie1=value1;path=/';
      document.cookie = 'cookie2=value2;path=/';
      document.cookie = 'cookie3=value3;path=/';

      expect(getRootCookie('cookie1')).toBe('value1');
      expect(getRootCookie('cookie2')).toBe('value2');
      expect(getRootCookie('cookie3')).toBe('value3');
    });

    it('쿠키 이름 앞 공백을 무시한다', () => {
      document.cookie = ' spaced_cookie=value;path=/';

      const result = getRootCookie('spaced_cookie');
      expect(result).toBe('value');
    });

    it('쿠키 값에 등호가 포함되어도 올바르게 파싱한다', () => {
      setRootCookie('complex_cookie', 'value=with=equals');

      const result = getRootCookie('complex_cookie');
      expect(result).toBe('value=with=equals');
    });

    it('빈 값도 반환할 수 있다', () => {
      document.cookie = 'empty_value=;path=/';

      const result = getRootCookie('empty_value');
      expect(result).toBe('');
    });

    it('세미콜론이 포함된 값도 처리한다', () => {
      setRootCookie('semicolon_value', 'value');

      const result = getRootCookie('semicolon_value');
      expect(result).toBe('value');
    });
  });

  describe('removeRootCookie', () => {
    it('쿠키를 삭제하면 getRootCookie가 null을 반환한다', () => {
      setRootCookie('to_delete', 'value');
      expect(getRootCookie('to_delete')).toBe('value');

      removeRootCookie('to_delete');
      expect(getRootCookie('to_delete')).toBeNull();
    });

    it('삭제할 쿠키가 없어도 에러가 발생하지 않는다', () => {
      expect(() => removeRootCookie('non_existent')).not.toThrow();
    });

    it('쿠키 삭제는 만료일을 과거로 설정한다', () => {
      setRootCookie('expire_test', 'value');
      removeRootCookie('expire_test');

      expect(getRootCookie('expire_test')).toBeNull();
    });
  });

  describe('clearAllSessions', () => {
    it('sessionStorage의 OPERATOR_TOKEN을 제거한다', () => {
      sessionStorageMock.getItem.mockReturnValue('some_token');

      clearAllSessions();

      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith(SESSION_KEYS.OPERATOR_TOKEN);
    });

    it('eregi_session 쿠키를 제거한다', () => {
      setRootCookie(SESSION_KEYS.MAIN_COOKIE, 'session_token');
      expect(getRootCookie(SESSION_KEYS.MAIN_COOKIE)).toBe('session_token');

      clearAllSessions();

      expect(getRootCookie(SESSION_KEYS.MAIN_COOKIE)).toBeNull();
    });
  });

  describe('clearAuthSessions', () => {
    it('eregi_session 쿠키만 제거한다', () => {
      setRootCookie(SESSION_KEYS.MAIN_COOKIE, 'auth_token');
      expect(getRootCookie(SESSION_KEYS.MAIN_COOKIE)).toBe('auth_token');

      clearAuthSessions();

      expect(getRootCookie(SESSION_KEYS.MAIN_COOKIE)).toBeNull();
    });

    it('sessionStorage는 건드리지 않는다', () => {
      clearAuthSessions();

      expect(sessionStorageMock.removeItem).not.toHaveBeenCalled();
    });
  });

  describe('clearNonMemberSessions', () => {
    it('sessionStorage의 NON_MEMBER를 제거한다', () => {
      sessionStorageMock.getItem.mockReturnValue('non_member_data');

      clearNonMemberSessions();

      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith(SESSION_KEYS.NON_MEMBER);
    });

    it('쿠키는 건드리지 않는다', () => {
      setRootCookie(SESSION_KEYS.MAIN_COOKIE, 'session_token');
      expect(getRootCookie(SESSION_KEYS.MAIN_COOKIE)).toBe('session_token');

      clearNonMemberSessions();

      expect(getRootCookie(SESSION_KEYS.MAIN_COOKIE)).toBe('session_token');
    });
  });

  describe('SESSION_KEYS 상수', () => {
    it('올바른 키 값을 가진다', () => {
      expect(SESSION_KEYS.OPERATOR_TOKEN).toBe('operatorToken');
      expect(SESSION_KEYS.MAIN_COOKIE).toBe('eregi_session');
      expect(SESSION_KEYS.NON_MEMBER).toBe('eregi_non_member_session');
    });
  });

  describe('integration tests', () => {
    it('전체 쿠키 라이프사이클을 테스트한다 (설정 → 읽기 → 삭제)', () => {
      setRootCookie('lifecycle', 'test_value', 7);
      expect(getRootCookie('lifecycle')).toBe('test_value');

      removeRootCookie('lifecycle');
      expect(getRootCookie('lifecycle')).toBeNull();
    });

    it('동시에 여러 쿠키를 관리할 수 있다', () => {
      setRootCookie('cookie1', 'value1');
      setRootCookie('cookie2', 'value2');
      setRootCookie('cookie3', 'value3');

      expect(getRootCookie('cookie1')).toBe('value1');
      expect(getRootCookie('cookie2')).toBe('value2');
      expect(getRootCookie('cookie3')).toBe('value3');

      removeRootCookie('cookie2');

      expect(getRootCookie('cookie1')).toBe('value1');
      expect(getRootCookie('cookie2')).toBeNull();
      expect(getRootCookie('cookie3')).toBe('value3');
    });

    it('같은 이름으로 덮어쓰기하면 새 값으로 대체된다', () => {
      setRootCookie('overwrite', 'old_value');
      expect(getRootCookie('overwrite')).toBe('old_value');

      setRootCookie('overwrite', 'new_value');
      expect(getRootCookie('overwrite')).toBe('new_value');
    });
  });
});
