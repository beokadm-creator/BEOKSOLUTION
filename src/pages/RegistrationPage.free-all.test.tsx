import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { loadPaymentWidget } from '@tosspayments/payment-widget-sdk';
import RegistrationPage from './RegistrationPage';

const mockNavigate = jest.fn();
const mockSetLanguage = jest.fn();
const mockUpdateBasePrice = jest.fn();
const mockFetch = jest.fn();
const mockRequestPayment = jest.fn();
const mockRenderPaymentMethods = jest.fn(() => ({
  updateAmount: jest.fn(),
}));

const mockUseConference = jest.fn();
const mockUseAuth = jest.fn();
const mockUseRegistration = jest.fn();
const mockUseUserStore = jest.fn();
const mockUsePricing = jest.fn();

const joinFirestorePath = (...segments: unknown[]) => segments
  .filter((segment) => typeof segment === 'string')
  .join('/');

jest.mock('../firebase', () => ({
  db: {},
  auth: {
    currentUser: {
      uid: 'user-123',
      getIdToken: jest.fn(async () => 'test-id-token'),
    },
  },
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  Timestamp: {
    now: jest.fn(),
    fromDate: jest.fn((date: Date) => ({ toDate: () => date, toMillis: () => date.getTime() })),
  },
}));

jest.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'generated-uuid'),
}));

jest.mock('@tosspayments/payment-widget-sdk', () => ({
  loadPaymentWidget: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ slug: '2026spring' }),
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
  useLocation: () => ({
    state: null,
    pathname: '/2026spring/register',
    search: '',
  }),
}));

jest.mock('../hooks/useConference', () => ({
  useConference: (...args: unknown[]) => mockUseConference(...args),
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

jest.mock('../hooks/useRegistration', () => ({
  useRegistration: (...args: unknown[]) => mockUseRegistration(...args),
}));

jest.mock('../store/userStore', () => ({
  useUserStore: (...args: unknown[]) => mockUseUserStore(...args),
}));

jest.mock('../hooks/usePricing', () => ({
  usePricing: (...args: unknown[]) => mockUsePricing(...args),
}));

jest.mock('../components/eregi/AddonSelector', () => ({
  AddonSelector: () => null,
}));

jest.mock('../components/conference/wide-preview/WideFooterPreview', () => ({
  WideFooterPreview: () => null,
}));

jest.mock('../utils/userDataMapper', () => ({
  toFirestoreUserData: jest.fn((data: Record<string, unknown>) => data),
}));

describe('RegistrationPage FREE_ALL flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    Object.defineProperty(window, 'fetch', {
      configurable: true,
      writable: true,
      value: mockFetch,
    });
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: mockFetch,
    });

    mockUseConference.mockReturnValue({
      id: 'kap_2026spring',
      info: {
        societyId: 'kap',
        title: { ko: '테스트 학회', en: 'Test Conference' },
      },
      loading: false,
    });

    mockUseAuth.mockReturnValue({
      auth: {
        loading: false,
        user: null,
      },
    });

    mockUseRegistration.mockReturnValue(undefined);
    mockUseUserStore.mockReturnValue({ language: 'ko', setLanguage: mockSetLanguage });

    (doc as jest.Mock).mockImplementation((...segments: unknown[]) => joinFirestorePath(...segments));
    (collection as jest.Mock).mockImplementation((...segments: unknown[]) => joinFirestorePath(...segments));
    (setDoc as jest.Mock).mockResolvedValue(undefined);
    (createUserWithEmailAndPassword as jest.Mock).mockResolvedValue({ user: { uid: 'user-123' } });
    (loadPaymentWidget as jest.Mock).mockResolvedValue({
      renderPaymentMethods: mockRenderPaymentMethods,
      requestPayment: mockRequestPayment,
    });

    (getDoc as jest.Mock).mockImplementation((path: string) => {
      if (path === 'conferences/kap_2026spring/settings/registration') {
        return Promise.resolve({
          exists: () => true,
          data: () => ({
            paymentMode: 'FREE_ALL',
            periods: [],
            refundPolicy: '',
          }),
        });
      }

      if (path === 'societies/kap/settings/infrastructure') {
        return Promise.resolve({
          exists: () => true,
          data: () => ({
            payment: {
              domestic: {
                provider: 'toss',
                apiKey: 'test-client-key',
                isTestMode: true,
              },
            },
          }),
        });
      }

      if (path === 'societies/kap') {
        return Promise.resolve({
          exists: () => true,
          data: () => ({
            footerInfo: {},
            name: { ko: '대한학회' },
          }),
        });
      }

      throw new Error(`Unexpected getDoc path: ${path}`);
    });

    (getDocs as jest.Mock).mockResolvedValue({ docs: [], empty: true });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    Element.prototype.scrollIntoView = jest.fn();

    window.history.pushState({}, '', '/2026spring/register');

    jest.spyOn(Timestamp, 'now').mockReturnValue({ toMillis: () => 123456789 } as unknown as Timestamp);
  });

  const fillBasicInfoAndSave = async () => {
    const emailInput = await screen.findByPlaceholderText('email@example.com');

    fireEvent.change(emailInput, {
      target: { value: 'tester@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('비밀번호를 입력하세요'), {
      target: { value: 'secret123' },
    });
    fireEvent.change(screen.getByPlaceholderText('이름을 입력하세요'), {
      target: { value: '테스터' },
    });
    fireEvent.change(screen.getByPlaceholderText('소속을 입력하세요'), {
      target: { value: '서울병원' },
    });
    fireEvent.change(screen.getByPlaceholderText('010-1234-5678'), {
      target: { value: '010-1234-5678' },
    });

    fireEvent.click(screen.getByRole('button', { name: '기본 정보 저장' }));

    await screen.findByRole('button', { name: /등록 완료|결제하기/ });
  };

  it('submits through the free registration endpoint when FREE_ALL total is zero', async () => {
    mockUsePricing.mockReturnValue({
      basePrice: 0,
      totalPrice: 0,
      optionsTotal: 0,
      selectedOptions: [],
      toggleOption: jest.fn(),
      isOptionSelected: jest.fn(() => false),
      setBasePrice: mockUpdateBasePrice,
    });

    render(React.createElement(RegistrationPage));

    await fillBasicInfoAndSave();

    const paymentWidget = document.getElementById('payment-widget');
    expect(paymentWidget).toHaveClass('hidden');

    fireEvent.click(screen.getByRole('button', { name: '등록 완료' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const [url, request] = mockFetch.mock.calls[0] as [string, { body: string }];
    expect(url).toContain('processFreeRegistrationHttp');
    expect(JSON.parse(request.body)).toEqual(
      expect.objectContaining({
        confId: 'kap_2026spring',
        amount: 0,
        baseAmount: 0,
        optionsTotal: 0,
      }),
    );
    expect(mockRequestPayment).not.toHaveBeenCalled();
  });

  it('uses Toss payment when FREE_ALL has paid add-ons', async () => {
    mockUsePricing.mockReturnValue({
      basePrice: 0,
      totalPrice: 30000,
      optionsTotal: 30000,
      selectedOptions: [
        {
          option: {
            id: 'meal',
            name: { ko: '식사권' },
            price: 30000,
          },
          quantity: 1,
        },
      ],
      toggleOption: jest.fn(),
      isOptionSelected: jest.fn(() => true),
      setBasePrice: mockUpdateBasePrice,
    });

    render(React.createElement(RegistrationPage));

    await fillBasicInfoAndSave();

    await waitFor(() => {
      expect(loadPaymentWidget).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: '결제하기' }));

    await waitFor(() => {
      expect(mockRequestPayment).toHaveBeenCalledTimes(1);
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
