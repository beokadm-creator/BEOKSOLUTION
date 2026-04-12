/**
 * dateUtils 단위 테스트
 */

import { safeFormatDate, safeFormatDateTime } from './dateUtils';

const mockConsoleError = jest.fn();
(globalThis as any).console.error = mockConsoleError;

describe('safeFormatDate', () => {
    beforeEach(() => {
        mockConsoleError.mockClear();
    });

    describe('null/undefined 입력 처리', () => {
        it('null 입력은 빈 문자열을 반환한다', () => {
            expect(safeFormatDate(null)).toBe('');
        });

        it('undefined 입력은 빈 문자열을 반환한다', () => {
            expect(safeFormatDate(undefined)).toBe('');
        });

        it('빈 문자열은 빈 문자열을 반환한다', () => {
            expect(safeFormatDate('')).toBe('');
        });
    });

    describe('Date 객체 처리', () => {
        it('Date 객체를 포맷팅한다', () => {
            const date = new Date('2026-04-10');
            const result = safeFormatDate(date);
            expect(result).toBeTruthy();
            expect(result).toContain('2026');
        });

        it('Date 객체와 커스텀 locale로 포맷팅한다', () => {
            const date = new Date('2026-04-10');
            const result = safeFormatDate(date, 'en-US');
            expect(result).toBeTruthy();
        });

        it('Date 객체와 커스텀 options로 포맷팅한다', () => {
            const date = new Date('2026-04-10');
            const result = safeFormatDate(date, 'ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
            expect(result).toBeTruthy();
            expect(result).toContain('2026');
        });
    });

    describe('Firestore Timestamp 처리 (toDate() 메서드)', () => {
        it('toDate() 메서드가 있는 객체를 처리한다', () => {
            const mockTimestamp = {
                seconds: 1728576000,
                nanoseconds: 0,
                toDate: () => new Date('2024-10-10T00:00:00Z')
            };
            const result = safeFormatDate(mockTimestamp);
            expect(result).toBeTruthy();
            expect(result).toContain('2024');
        });

        it('toDate()가 Date를 반환하지 않을 경우 문자열로 변환한다', () => {
            const mockTimestamp = {
                toDate: () => 'invalid date'
            };
            const result = safeFormatDate(mockTimestamp);
            expect(result).toBe('invalid date');
        });
    });

    describe('seconds 필드가 있는 객체 처리', () => {
        it('seconds 필드가 있는 객체를 처리한다', () => {
            const dateWithSeconds = {
                seconds: 1728576000,
                nanoseconds: 0
            };
            const result = safeFormatDate(dateWithSeconds);
            expect(result).toBeTruthy();
            expect(result).toContain('2024');
        });

        it('seconds가 0인 경우를 처리한다', () => {
            const dateWithSeconds = { seconds: 0 };
            const result = safeFormatDate(dateWithSeconds);
            expect(result).toBeTruthy();
        });
    });

    describe('ISO 문자열 날짜 처리', () => {
        it('ISO 8601 문자열을 포맷팅한다', () => {
            const isoString = '2026-04-10T12:00:00Z';
            const result = safeFormatDate(isoString);
            expect(result).toBeTruthy();
            expect(result).toContain('2026');
        });

        it('YYYY-MM-DD 형식의 문자열을 포맷팅한다', () => {
            const dateString = '2026-04-10';
            const result = safeFormatDate(dateString);
            expect(result).toBeTruthy();
            expect(result).toContain('2026');
        });

        it('다른 날짜 문자열 형식을 처리한다', () => {
            const dateString = '04/10/2026';
            const result = safeFormatDate(dateString);
            expect(result).toBeTruthy();
        });
    });

    describe('유효하지 않은 문자열 처리', () => {
        it('유효하지 않은 문자열은 문자열 그대로 반환한다', () => {
            const invalidString = 'not a date';
            const result = safeFormatDate(invalidString);
            expect(result).toBe('not a date');
        });

        it('숫자는 timestamp로 처리하여 포맷팅한다', () => {
            const result = safeFormatDate(12345);
            expect(result).toBeTruthy();
            expect(result).toContain('1970');
        });

        it('객체는 문자열로 변환하여 반환한다', () => {
            const obj = { key: 'value' };
            const result = safeFormatDate(obj);
            expect(result).toBe('[object Object]');
        });
    });

    describe('커스텀 locale 지원', () => {
        it('en-US locale을 지원한다', () => {
            const date = new Date('2026-04-10');
            const result = safeFormatDate(date, 'en-US');
            expect(result).toBeTruthy();
        });

        it('ja-JP locale을 지원한다', () => {
            const date = new Date('2026-04-10');
            const result = safeFormatDate(date, 'ja-JP');
            expect(result).toBeTruthy();
        });

        it('de-DE locale을 지원한다', () => {
            const date = new Date('2026-04-10');
            const result = safeFormatDate(date, 'de-DE');
            expect(result).toBeTruthy();
        });
    });

    describe('커스텀 options 지원', () => {
        it('year만 표시하는 옵션을 지원한다', () => {
            const date = new Date('2026-04-10');
            const result = safeFormatDate(date, 'ko-KR', { year: 'numeric' });
            expect(result).toContain('2026');
        });

        it('month만 표시하는 옵션을 지원한다', () => {
            const date = new Date('2026-04-10');
            const result = safeFormatDate(date, 'ko-KR', { month: 'long' });
            expect(result).toBeTruthy();
        });

        it('weekday를 포함하는 옵션을 지원한다', () => {
            const date = new Date('2026-04-10');
            const result = safeFormatDate(date, 'ko-KR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            expect(result).toBeTruthy();
        });
    });

    describe('에러 처리', () => {
        it('에러 발생 시 console.error를 호출한다', () => {
            const errorObject = {
                get toDate() {
                    throw new Error('Test error');
                }
            };

            const result = safeFormatDate(errorObject);
            expect(mockConsoleError).toHaveBeenCalled();
            expect(result).toBe('');
        });

        it('toDate() 메서드에서 에러 발생 시 빈 문자열을 반환한다', () => {
            const errorObject = {
                toDate: () => {
                    throw new Error('toDate error');
                }
            };

            const result = safeFormatDate(errorObject);
            expect(mockConsoleError).toHaveBeenCalled();
            expect(result).toBe('');
        });
    });
});

describe('safeFormatDateTime', () => {
    beforeEach(() => {
        mockConsoleError.mockClear();
    });

    describe('null/undefined 입력 처리', () => {
        it('null 입력은 빈 문자열을 반환한다', () => {
            expect(safeFormatDateTime(null)).toBe('');
        });

        it('undefined 입력은 빈 문자열을 반환한다', () => {
            expect(safeFormatDateTime(undefined)).toBe('');
        });

        it('빈 문자열은 빈 문자열을 반환한다', () => {
            expect(safeFormatDateTime('')).toBe('');
        });
    });

    describe('Date 객체를 날짜+시간으로 포맷팅', () => {
        it('Date 객체를 날짜와 시간으로 포맷팅한다', () => {
            const date = new Date('2026-04-10T14:30:00');
            const result = safeFormatDateTime(date);
            expect(result).toBeTruthy();
            expect(result).toContain('2026');
            expect(result.length).toBeGreaterThan(10);
        });

        it('Date 객체와 커스텀 locale로 포맷팅한다', () => {
            const date = new Date('2026-04-10T14:30:00');
            const result = safeFormatDateTime(date, 'en-US');
            expect(result).toBeTruthy();
            expect(result).toContain('2026');
        });
    });

    describe('toDate() 메서드가 있는 객체 처리', () => {
        it('toDate() 메서드가 있는 객체를 처리한다', () => {
            const mockTimestamp = {
                seconds: 1728576000,
                nanoseconds: 0,
                toDate: () => new Date('2024-10-10T14:30:00Z')
            };
            const result = safeFormatDateTime(mockTimestamp);
            expect(result).toBeTruthy();
            expect(result).toContain('2024');
        });

        it('toDate()가 Date를 반환하지 않을 경우 문자열로 변환한다', () => {
            const mockTimestamp = {
                toDate: () => 'invalid date'
            };
            const result = safeFormatDateTime(mockTimestamp);
            expect(result).toBe('invalid date');
        });
    });

    describe('seconds 필드가 있는 객체 처리', () => {
        it('seconds 필드가 있는 객체를 처리한다', () => {
            const dateWithSeconds = {
                seconds: 1728576000,
                nanoseconds: 0
            };
            const result = safeFormatDateTime(dateWithSeconds);
            expect(result).toBeTruthy();
            expect(result).toContain('2024');
        });
    });

    describe('ISO 문자열 날짜 처리', () => {
        it('ISO 8601 문자열을 포맷팅한다', () => {
            const isoString = '2026-04-10T14:30:00Z';
            const result = safeFormatDateTime(isoString);
            expect(result).toBeTruthy();
            expect(result).toContain('2026');
            expect(result.length).toBeGreaterThan(10);
        });

        it('YYYY-MM-DD 형식의 문자열을 포맷팅한다', () => {
            const dateString = '2026-04-10';
            const result = safeFormatDateTime(dateString);
            expect(result).toBeTruthy();
            expect(result).toContain('2026');
        });
    });

    describe('기본 옵션 확인', () => {
        it('기본 옵션에 year, month, day가 포함된다', () => {
            const date = new Date('2026-04-10T14:30:00');
            const result = safeFormatDateTime(date);
            expect(result).toContain('2026');
        });

        it('기본 옵션에 hour, minute이 포함된다', () => {
            const date = new Date('2026-04-10T14:30:00');
            const result = safeFormatDateTime(date);
            const dateOnly = safeFormatDate(date);
            expect(result.length).toBeGreaterThanOrEqual(dateOnly.length);
        });

        it('커스텀 options로 기본 옵션을 덮어쓸 수 있다', () => {
            const date = new Date('2026-04-10T14:30:00');
            const result = safeFormatDateTime(date, 'ko-KR', { hour: 'numeric' });
            expect(result).toBeTruthy();
        });
    });

    describe('커스텀 locale 지원', () => {
        it('en-US locale을 지원한다', () => {
            const date = new Date('2026-04-10T14:30:00');
            const result = safeFormatDateTime(date, 'en-US');
            expect(result).toBeTruthy();
        });

        it('ja-JP locale을 지원한다', () => {
            const date = new Date('2026-04-10T14:30:00');
            const result = safeFormatDateTime(date, 'ja-JP');
            expect(result).toBeTruthy();
        });
    });

    describe('에러 처리', () => {
        it('에러 발생 시 console.error를 호출한다', () => {
            const errorObject = {
                get toDate() {
                    throw new Error('Test error');
                }
            };

            const result = safeFormatDateTime(errorObject);
            expect(mockConsoleError).toHaveBeenCalled();
            expect(result).toBe('');
        });

        it('toDate() 메서드에서 에러 발생 시 빈 문자열을 반환한다', () => {
            const errorObject = {
                toDate: () => {
                    throw new Error('toDate error');
                }
            };

            const result = safeFormatDateTime(errorObject);
            expect(mockConsoleError).toHaveBeenCalled();
            expect(result).toBe('');
        });
    });

    describe('유효하지 않은 문자열 처리', () => {
        it('유효하지 않은 문자열은 문자열 그대로 반환한다', () => {
            const invalidString = 'not a date';
            const result = safeFormatDateTime(invalidString);
            expect(result).toBe('not a date');
        });

        it('숫자는 timestamp로 처리하여 포맷팅한다', () => {
            const result = safeFormatDateTime(12345);
            expect(result).toBeTruthy();
            expect(result).toContain('1970');
        });
    });
});
