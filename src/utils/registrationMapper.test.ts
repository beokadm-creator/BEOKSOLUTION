import { flattenRegistrationFields } from './registrationMapper';

describe('flattenRegistrationFields', () => {
  it('extracts all fields from nested userInfo', () => {
    const result = flattenRegistrationFields({
      userInfo: {
        name: '홍길동',
        email: 'hong@test.com',
        phone: '010-1234-5678',
        affiliation: '서울대학교',
        position: '교수',
        licenseNumber: 'LIC-001',
        grade: 'MEMBER',
      },
    });
    expect(result.userName).toBe('홍길동');
    expect(result.userEmail).toBe('hong@test.com');
    expect(result.userPhone).toBe('010-1234-5678');
    expect(result.affiliation).toBe('서울대학교');
    expect(result.position).toBe('교수');
    expect(result.licenseNumber).toBe('LIC-001');
    expect(result.tier).toBe('MEMBER');
  });

  it('extracts fields from root level when userInfo is absent', () => {
    const result = flattenRegistrationFields({
      userName: '김의사',
      userEmail: 'kim@hospital.com',
      userPhone: '010-9876-5432',
      affiliation: '분당서울대병원',
      position: '전임의',
      licenseNumber: 'LIC-002',
      tier: 'STUDENT',
    });
    expect(result.userName).toBe('김의사');
    expect(result.userEmail).toBe('kim@hospital.com');
    expect(result.affiliation).toBe('분당서울대병원');
    expect(result.position).toBe('전임의');
    expect(result.licenseNumber).toBe('LIC-002');
    expect(result.tier).toBe('STUDENT');
  });

  it('handles legacy field names (userOrg, organization, userAffiliation)', () => {
    const result = flattenRegistrationFields({
      userOrg: '레거시병원',
      userAffiliation: '레거시소속',
      license: 'LIC-OLD',
      userTier: 'NON_MEMBER',
      categoryName: 'VIP',
    });
    expect(result.affiliation).toBe('레거시병원');
    expect(result.licenseNumber).toBe('LIC-OLD');
    expect(result.tier).toBe('NON_MEMBER');
  });

  it('returns empty string for missing fields', () => {
    const result = flattenRegistrationFields({});
    expect(result.userName).toBe('');
    expect(result.userEmail).toBe('');
    expect(result.userPhone).toBe('');
    expect(result.affiliation).toBe('');
    expect(result.position).toBe('');
    expect(result.licenseNumber).toBe('');
    expect(result.tier).toBe('');
  });

  it('extracts position from root or userInfo', () => {
    expect(flattenRegistrationFields({ position: '교수' }).position).toBe('교수');
    expect(flattenRegistrationFields({ userInfo: { position: '전임의' } }).position).toBe('전임의');
    expect(flattenRegistrationFields({ position: '교수', userInfo: { position: '' } }).position).toBe('교수');
  });

  it('uses correct priority for affiliation fallback', () => {
    expect(flattenRegistrationFields({ affiliation: 'A', organization: 'B' }).affiliation).toBe('A');
    expect(flattenRegistrationFields({ organization: 'B', userOrg: 'C' }).affiliation).toBe('B');
    expect(flattenRegistrationFields({ userOrg: 'C', userAffiliation: 'D' }).affiliation).toBe('C');
    expect(flattenRegistrationFields({ userInfo: { affiliation: 'E' } }).affiliation).toBe('E');
  });

  it('uses correct priority for tier/grade fallback', () => {
    expect(flattenRegistrationFields({ tier: 'A' }).tier).toBe('A');
    expect(flattenRegistrationFields({ userTier: 'B' }).tier).toBe('B');
    expect(flattenRegistrationFields({ categoryName: 'C' }).tier).toBe('C');
    expect(flattenRegistrationFields({ userInfo: { grade: 'D' } }).tier).toBe('D');
  });

  it('always returns all 7 expected fields', () => {
    const result = flattenRegistrationFields({});
    const expectedKeys = ['userName', 'userEmail', 'userPhone', 'affiliation', 'position', 'licenseNumber', 'tier'];
    expectedKeys.forEach(key => {
      expect(result).toHaveProperty(key);
    });
  });

  it('handles mixed root-level and userInfo fields', () => {
    const result = flattenRegistrationFields({
      userName: '루트이름',
      userInfo: {
        email: '중첩이메일@test.com',
        affiliation: '중첩소속',
        position: '중첩직급',
      },
      position: '루트직급',
    });
    expect(result.userName).toBe('루트이름');
    expect(result.userEmail).toBe('중첩이메일@test.com');
    expect(result.affiliation).toBe('중첩소속');
    expect(result.position).toBe('루트직급');
  });

  it('uses correct priority for licenseNumber fallback', () => {
    expect(flattenRegistrationFields({ licenseNumber: 'L1' }).licenseNumber).toBe('L1');
    expect(flattenRegistrationFields({ license: 'L2' }).licenseNumber).toBe('L2');
    expect(flattenRegistrationFields({ userInfo: { licenseNumber: 'L3' } }).licenseNumber).toBe('L3');
    expect(flattenRegistrationFields({ userInfo: { licensenumber: 'L4' } }).licenseNumber).toBe('L4');
  });

  it('falls back to formData.licenseNumber for licenseNumber', () => {
    const result = flattenRegistrationFields({
      formData: { licenseNumber: 'FD-LIC' },
    });
    expect(result.licenseNumber).toBe('FD-LIC');
  });

  it('falls back to root userEmail when userInfo.email is empty', () => {
    const result = flattenRegistrationFields({
      userEmail: 'root@test.com',
      userInfo: { email: '' },
    });
    expect(result.userEmail).toBe('root@test.com');
  });

  it('falls back to docData.name when userName and userInfo.name are absent', () => {
    const result = flattenRegistrationFields({ name: '이름폴백' });
    expect(result.userName).toBe('이름폴백');
  });

  it('uses organization as affiliation fallback', () => {
    const result = flattenRegistrationFields({ organization: 'ORG-A' });
    expect(result.affiliation).toBe('ORG-A');
  });

  it('falls back to userInfo.organization for affiliation', () => {
    const result = flattenRegistrationFields({
      userInfo: { organization: 'UI-ORG' },
    });
    expect(result.affiliation).toBe('UI-ORG');
  });

  it('never returns undefined for any field', () => {
    const result = flattenRegistrationFields({});
    const keys = Object.keys(result);
    keys.forEach(key => {
      expect(result[key]).toBeDefined();
    });
  });

  it('uses categoryName as tier fallback', () => {
    expect(flattenRegistrationFields({ categoryName: '일반참가' }).tier).toBe('일반참가');
  });

  it('treats non-object userInfo as absent and uses root fields', () => {
    const result = flattenRegistrationFields({
      userInfo: 'not-an-object',
      userName: 'ROOT',
    });
    expect(result.userName).toBe('ROOT');
  });

  it('all mapper output keys are present in RootRegistration type', () => {
    const result = flattenRegistrationFields({
      userName: 'name',
      userEmail: 'email',
      userPhone: 'phone',
      affiliation: 'affil',
      position: 'pos',
      licenseNumber: 'lic',
      tier: 't',
    });

    const mapperKeys = Object.keys(result) as Array<keyof typeof result>;
    const rootRegistrationKeys = [
      'userName', 'userEmail', 'userPhone', 'affiliation',
      'position', 'licenseNumber', 'tier',
    ];

    mapperKeys.forEach(key => {
      expect(rootRegistrationKeys).toContain(key);
    });
  });
});
