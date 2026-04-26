/**
 * useConference Hook Tests
 *
 * Purpose: Test conference data loading from Firestore, multi-tenant routing,
 * cache behavior, and error handling.
 *
 * Testing Strategy:
 * - Mock Firebase Firestore operations (doc, getDoc, collection, getDocs, query, where, limit)
 * - Mock react-router-dom useParams
 * - Test conference data loading via Firestore paths
 * - Test conference not found case
 * - Test permission denied error handling
 * - Test timeout handling
 * - Test reserved route handling (admin, login)
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useConference, clearConferenceCache } from './useConference';
import { doc, getDoc, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { useParams } from 'react-router-dom';

jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  doc: jest.fn(),
  getDoc: jest.fn(),
  collection: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  limit: jest.fn(),
}));

jest.mock('../firebase', () => ({
  db: {},
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockReturnValue({ slug: '2026spring', cid: undefined }),
}));

describe('useConference', () => {
  const createMockDocRef = (...args: unknown[]) => ({
    path: typeof args[1] === 'string' ? args.slice(1).join('/') : '',
    type: 'document',
  });

  const mockConferenceDoc = {
    id: 'kap_2026spring',
    exists: jest.fn(() => true),
    data: jest.fn(() => ({
      title: { ko: 'KAP 2026 Spring', en: 'KAP 2026 Spring' },
      dates: { start: Timestamp.now(), end: Timestamp.now() },
      slug: '2026spring',
      societyId: 'kap',
      bannerUrl: 'https://example.com/banner.jpg',
      venueName: 'Test Venue',
      venueAddress: '123 Test St',
      subTitle: 'Annual Conference',
    })),
  };

  const mockInfoDoc = {
    exists: jest.fn(() => true),
    data: jest.fn(() => ({
      welcomeMessage: 'Welcome!',
      badgeLayout: { width: 400, height: 600, elements: [] },
      receiptConfig: { issuerName: 'KAP', stampUrl: '', nextSerialNo: 1 },
    })),
  };

  const mockBasicDoc = {
    exists: jest.fn(() => true),
    data: jest.fn(() => ({
      venueName: 'Test Venue',
      venueAddress: '123 Test St',
      welcomeMessage: 'Welcome!',
    })),
  };

  const mockIdentityDoc = {
    exists: jest.fn(() => true),
    data: jest.fn(() => ({
      subTitle: 'Annual Conference',
    })),
  };

  const mockVisualDoc = {
    exists: jest.fn(() => true),
    data: jest.fn(() => ({
      mainBannerUrl: 'https://example.com/banner.jpg',
      posterUrl: 'https://example.com/poster.jpg',
    })),
  };

  const createMockEmptySnap = () => ({
    exists: jest.fn(() => false),
  });

  const createMockCollectionSnap = (docs: unknown[] = []) => ({
    docs,
    empty: docs.length === 0,
  });

  const setupSuccessfulFetch = (extraGetDocs: unknown[][] = []) => {
    const mockPagesSnap = createMockCollectionSnap([]);
    const mockAgendasSnap = createMockCollectionSnap([]);
    const mockSpeakersSnap = createMockCollectionSnap([]);
    const mockSponsorsSnap = createMockCollectionSnap([]);
    const mockRegSettings = createMockEmptySnap();

    (getDoc as jest.Mock)
      .mockResolvedValueOnce(mockConferenceDoc)
      .mockResolvedValueOnce(mockInfoDoc)
      .mockResolvedValueOnce(mockBasicDoc)
      .mockResolvedValueOnce(mockIdentityDoc)
      .mockResolvedValueOnce(mockVisualDoc)
      .mockResolvedValueOnce(mockRegSettings);
    (getDocs as jest.Mock)
      .mockResolvedValueOnce(mockPagesSnap)
      .mockResolvedValueOnce(mockAgendasSnap)
      .mockResolvedValueOnce(mockSpeakersSnap)
      .mockResolvedValueOnce(mockSponsorsSnap);
    for (const snap of extraGetDocs) {
      (getDocs as jest.Mock).mockResolvedValueOnce(createMockCollectionSnap(snap));
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearConferenceCache();

    (doc as jest.Mock).mockImplementation(createMockDocRef);
    (collection as jest.Mock).mockReturnValue({ type: 'collection' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initial state', () => {
    it('should initialize with loading=true and no data', () => {
      (getDoc as jest.Mock).mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useConference('test-slug'));

      expect(result.current.loading).toBe(true);
      expect(result.current.info).toBeNull();
      expect(result.current.id).toBeNull();
      expect(result.current.pages).toEqual([]);
    });
  });

  describe('conference data loading', () => {
    it('should load conference data from Firestore', async () => {
      setupSuccessfulFetch();

      const { result } = renderHook(() => useConference('test-slug'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.id).toBe('kap_2026spring');
      expect(result.current.info).toBeTruthy();
      expect(result.current.error).toBeNull();
    });

    it('should load registration periods (pricing) from settings', async () => {
      const mockRegSettings = {
        exists: jest.fn(() => true),
        data: jest.fn(() => ({
          periods: [
            { id: 'early', name: 'Early Bird', startDate: Timestamp.now(), endDate: Timestamp.now(), prices: { MEMBER: 50000, NON_MEMBER: 70000 } },
            { id: 'regular', name: 'Regular', startDate: Timestamp.now(), endDate: Timestamp.now(), prices: { MEMBER: 70000, NON_MEMBER: 90000 } },
          ],
        })),
      };

      (getDoc as jest.Mock)
        .mockResolvedValueOnce(mockConferenceDoc)
        .mockResolvedValueOnce(mockInfoDoc)
        .mockResolvedValueOnce(mockBasicDoc)
        .mockResolvedValueOnce(mockIdentityDoc)
        .mockResolvedValueOnce(mockVisualDoc)
        .mockResolvedValueOnce(mockRegSettings);
      (getDocs as jest.Mock).mockResolvedValue(createMockCollectionSnap([]));

      const { result } = renderHook(() => useConference('test-slug'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.pricing.length).toBe(2);
      expect(result.current.pricing[0].id).toBe('early');
    });

    it('should handle empty pricing gracefully', async () => {
      setupSuccessfulFetch();

      const { result } = renderHook(() => useConference('test-slug'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.pricing).toEqual([]);
    });
  });

  describe('conference not found', () => {
    it('should set error when conference is not found', async () => {
      const notFoundDoc = { exists: jest.fn(() => false) };
      const mockEmptyQuery = createMockCollectionSnap([]);

      (getDoc as jest.Mock)
        .mockResolvedValueOnce(notFoundDoc)
        .mockResolvedValueOnce(notFoundDoc)
        .mockResolvedValueOnce(notFoundDoc);
      (getDocs as jest.Mock).mockResolvedValueOnce(mockEmptyQuery);

      const { result } = renderHook(() => useConference('nonexistent-slug'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Conference not found');
      expect(result.current.id).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle permission denied errors gracefully', async () => {
      const notFoundDoc = { exists: jest.fn(() => false) };
      (getDoc as jest.Mock).mockResolvedValue(notFoundDoc);
      const permError = new Error('permission-denied');
      (permError as unknown as Record<string, string>).code = 'permission-denied';
      (getDocs as jest.Mock).mockRejectedValue(permError);

      const { result } = renderHook(() => useConference('test-slug'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Permission denied. Some data may not be available.');
    });

    it('should handle Firestore fetch errors via query fallback', async () => {
      const notFoundDoc = { exists: jest.fn(() => false) };
      (getDoc as jest.Mock).mockResolvedValue(notFoundDoc);
      (getDocs as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useConference('test-slug'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
    });
  });

  describe('timeout handling', () => {
    it('should set timeout error after 10 seconds', async () => {
      jest.useFakeTimers();
      (getDoc as jest.Mock).mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useConference('test-slug'));

      expect(result.current.loading).toBe(true);

      await act(async () => {
        jest.advanceTimersByTime(10000);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toContain('Timeout');
      jest.useRealTimers();
    });
  });

  describe('reserved routes', () => {
    it('should not fetch for admin route', async () => {
      const { result } = renderHook(() => useConference('admin'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(getDoc).not.toHaveBeenCalled();
    });

    it('should not fetch for login route', async () => {
      const { result } = renderHook(() => useConference('login'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(getDoc).not.toHaveBeenCalled();
    });
  });

  describe('no slug', () => {
    it('should set loading=false when no slug provided', async () => {
      (useParams as jest.Mock).mockReturnValue({ slug: undefined, cid: undefined });

      const { result } = renderHook(() => useConference(undefined));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('caching', () => {
    it('should use cached data on second render', async () => {
      setupSuccessfulFetch();

      const { result, unmount } = renderHook(() => useConference('cached-slug'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      unmount();

      (getDocs as jest.Mock).mockResolvedValue(createMockCollectionSnap([]));

      const { result: result2 } = renderHook(() => useConference('cached-slug'));

      await waitFor(() => {
        expect(result2.current.loading).toBe(false);
      });

      expect(result2.current.id).toBe('kap_2026spring');
    });

    it('should clear cache with clearConferenceCache', () => {
      clearConferenceCache();
      clearConferenceCache('test-slug');
      clearConferenceCache('test-slug', 'kap');
    });
  });

  describe('subcollections', () => {
    it('should load agendas from subcollection', async () => {
      const mockAgenda = { id: 'agenda-1', data: () => ({ title: 'Opening', startTime: '09:00', endTime: '10:00' }) };

      (getDoc as jest.Mock)
        .mockResolvedValueOnce(mockConferenceDoc)
        .mockResolvedValueOnce(mockInfoDoc)
        .mockResolvedValueOnce(mockBasicDoc)
        .mockResolvedValueOnce(mockIdentityDoc)
        .mockResolvedValueOnce(mockVisualDoc)
        .mockResolvedValueOnce(createMockEmptySnap());
      (getDocs as jest.Mock)
        .mockResolvedValueOnce(createMockCollectionSnap([]))
        .mockResolvedValueOnce(createMockCollectionSnap([mockAgenda]))
        .mockResolvedValueOnce(createMockCollectionSnap([]))
        .mockResolvedValueOnce(createMockCollectionSnap([]));

      const { result } = renderHook(() => useConference('test-slug'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.agendas.length).toBe(1);
      expect(result.current.agendas[0].id).toBe('agenda-1');
    });

    it('should load speakers from subcollection', async () => {
      const mockSpeaker = { id: 'speaker-1', data: () => ({ name: 'Dr. Kim', affiliation: 'Test Univ' }) };

      (getDoc as jest.Mock)
        .mockResolvedValueOnce(mockConferenceDoc)
        .mockResolvedValueOnce(mockInfoDoc)
        .mockResolvedValueOnce(mockBasicDoc)
        .mockResolvedValueOnce(mockIdentityDoc)
        .mockResolvedValueOnce(mockVisualDoc)
        .mockResolvedValueOnce(createMockEmptySnap());
      (getDocs as jest.Mock)
        .mockResolvedValueOnce(createMockCollectionSnap([]))
        .mockResolvedValueOnce(createMockCollectionSnap([]))
        .mockResolvedValueOnce(createMockCollectionSnap([mockSpeaker]))
        .mockResolvedValueOnce(createMockCollectionSnap([]));

      const { result } = renderHook(() => useConference('test-slug'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.speakers.length).toBe(1);
      expect(result.current.speakers[0].id).toBe('speaker-1');
    });
  });
});
