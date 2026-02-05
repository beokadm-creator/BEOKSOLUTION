/**
 * userDataMapper 테스트
 *
 * 목적: 필드명 불일치 문제 해결 유틸리티 테스트
 * - phone/phoneNumber 통합
 * - organization/affiliation 통합
 * - name/userName/displayName 통합
 */

import { normalizeUserData, extractPhone, extractOrganization, extractName, toFirestoreUserData, mergeUserData } from './userDataMapper';
import type { ConferenceUser } from '../types/schema';

describe('userDataMapper', () => {
  describe('normalizeUserData', () => {
    it('빈 객체를 처리한다', () => {
      const result = normalizeUserData({});

      expect(result).toEqual({
        id: '',
        uid: '',
        name: '',
        email: '',
        phone: '',
        organization: '',
        licenseNumber: '',
        tier: 'NON_MEMBER',
        country: 'KR',
        isForeigner: false,
        authStatus: {
          emailVerified: false,
          phoneVerified: false,
        },
        affiliations: undefined,
        createdAt: null,
        updatedAt: null,
      });
    });

    it('phone 필드를 우선한다 (phone > phoneNumber)', () => {
      const result = normalizeUserData({
        phone: '010-1234-5678',
        phoneNumber: '010-9999-9999',
      });

      expect(result.phone).toBe('010-1234-5678');
    });

    it('phoneNumber를 대안으로 사용한다', () => {
      const result = normalizeUserData({
        phoneNumber: '010-9999-9999',
      });

      expect(result.phone).toBe('010-9999-9999');
    });

    it('organization 필드를 우선한다 (organization > affiliation > org)', () => {
      const result = normalizeUserData({
        organization: '병원 A',
        affiliation: '병원 B',
        org: '병원 C',
      });

      expect(result.organization).toBe('병원 A');
    });

    it('affiliation을 대안으로 사용한다', () => {
      const result = normalizeUserData({
        affiliation: '병원 B',
      });

      expect(result.organization).toBe('병원 B');
    });

    it('org을 최후 대안으로 사용한다', () => {
      const result = normalizeUserData({
        org: '병원 C',
      });

      expect(result.organization).toBe('병원 C');
    });

    it('name 필드를 우선한다 (name > userName > displayName)', () => {
      const result = normalizeUserData({
        name: '홍길동',
        userName: '김길동',
        displayName: '이길동',
      });

      expect(result.name).toBe('홍길동');
    });

    it('id는 raw.id를 우선한다 (id > uid > userId)', () => {
      const result = normalizeUserData({
        uid: 'uid-123',
        id: 'id-456',
        userId: 'userid-789',
      });

      expect(result.id).toBe('id-456'); // id 필드는 raw.id 우선
      expect(result.uid).toBe('uid-123'); // uid 필드는 raw.uid 우선
    });

    it('tier를 MEMBER로 변환한다', () => {
      const result = normalizeUserData({
        tier: 'MEMBER',
      });

      expect(result.tier).toBe('MEMBER');
    });

    it('기본 tier를 NON_MEMBER로 설정한다', () => {
      const result = normalizeUserData({});

      expect(result.tier).toBe('NON_MEMBER');
    });

    it('authStatus를 보존한다', () => {
      const result = normalizeUserData({
        authStatus: {
          emailVerified: true,
          phoneVerified: true,
        },
      });

      expect(result.authStatus).toEqual({
        emailVerified: true,
        phoneVerified: true,
      });
    });

    it('기본 authStatus를 생성한다', () => {
      const result = normalizeUserData({});

      expect(result.authStatus).toEqual({
        emailVerified: false,
        phoneVerified: false,
      });
    });
  });

  describe('extractPhone', () => {
    it('phone을 추출한다', () => {
      const result = extractPhone({ phone: '010-1234-5678' });
      expect(result).toBe('010-1234-5678');
    });

    it('phoneNumber를 대안으로 추출한다', () => {
      const result = extractPhone({ phoneNumber: '010-9999-9999' });
      expect(result).toBe('010-9999-9999');
    });

    it('빈 문자열을 반환한다 (모두 없음)', () => {
      const result = extractPhone({});
      expect(result).toBe('');
    });
  });

  describe('extractOrganization', () => {
    it('organization을 추출한다', () => {
      const result = extractOrganization({ organization: '병원 A' });
      expect(result).toBe('병원 A');
    });

    it('affiliation을 대안으로 추출한다', () => {
      const result = extractOrganization({ affiliation: '병원 B' });
      expect(result).toBe('병원 B');
    });

    it('org를 최후 대안으로 추출한다', () => {
      const result = extractOrganization({ org: '병원 C' });
      expect(result).toBe('병원 C');
    });

    it('빈 문자열을 반환한다 (모두 없음)', () => {
      const result = extractOrganization({});
      expect(result).toBe('');
    });
  });

  describe('extractName', () => {
    it('name을 추출한다', () => {
      const result = extractName({ name: '홍길동' });
      expect(result).toBe('홍길동');
    });

    it('userName을 대안으로 추출한다', () => {
      const result = extractName({ userName: '김길동' });
      expect(result).toBe('김길동');
    });

    it('displayName을 최후 대안으로 추출한다', () => {
      const result = extractName({ displayName: '이길동' });
      expect(result).toBe('이길동');
    });

    it('빈 문자열을 반환한다 (모두 없음)', () => {
      const result = extractName({});
      expect(result).toBe('');
    });
  });

  describe('toFirestoreUserData', () => {
    it('ConferenceUser를 Firestore-safe 데이터로 변환한다', () => {
      const input: Partial<ConferenceUser> = {
        id: 'user-123',
        name: '홍길동',
        email: 'test@example.com',
        phone: '010-1234-5678',
        organization: '병원 A',
        tier: 'MEMBER',
        country: 'KR',
        isForeigner: false,
        authStatus: {
          emailVerified: true,
          phoneVerified: true,
        },
      };

      const result = toFirestoreUserData(input);

      expect(result).toEqual({
        name: '홍길동',
        email: 'test@example.com',
        phone: '010-1234-5678',
        organization: '병원 A',
        licenseNumber: '',
        tier: 'MEMBER',
        country: 'KR',
        isForeigner: false,
        authStatus: {
          emailVerified: true,
          phoneVerified: true,
        },
        affiliations: {},
        updatedAt: expect.any(Date),
      });
    });

    it('기본값을 채운다', () => {
      const result = toFirestoreUserData({});

      expect(result).toEqual({
        name: '',
        email: '',
        phone: '',
        organization: '',
        licenseNumber: '',
        tier: 'NON_MEMBER',
        country: 'KR',
        isForeigner: false,
        authStatus: {
          emailVerified: false,
          phoneVerified: false,
        },
        affiliations: {},
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('mergeUserData', () => {
    it('여러 소스를 병합한다 (나중 소스가 우선)', () => {
      const source1 = {
        name: '홍길동',
        email: 'hong@example.com',
        phone: '010-1111-1111',
      };

      const source2 = {
        name: '김길동', // 덮어씀
        organization: '병원 A',
      };

      const source3 = {
        organization: '병원 B', // 덮어씀
        tier: 'MEMBER',
      };

      const result = mergeUserData(source1, source2, source3);

      expect(result).toEqual({
        id: '',
        uid: '',
        name: '김길동',
        email: 'hong@example.com',
        phone: '010-1111-1111',
        organization: '병원 B',
        licenseNumber: '',
        tier: 'MEMBER',
        country: 'KR',
        isForeigner: false,
        authStatus: {
          emailVerified: false,
          phoneVerified: false,
        },
        affiliations: undefined,
        createdAt: null,
        updatedAt: null,
      });
    });

    it('빈 배열을 처리한다', () => {
      const result = mergeUserData();

      expect(result).toEqual({
        id: '',
        uid: '',
        name: '',
        email: '',
        phone: '',
        organization: '',
        licenseNumber: '',
        tier: 'NON_MEMBER',
        country: 'KR',
        isForeigner: false,
        authStatus: {
          emailVerified: false,
          phoneVerified: false,
        },
        affiliations: undefined,
        createdAt: null,
        updatedAt: null,
      });
    });
  });
});
