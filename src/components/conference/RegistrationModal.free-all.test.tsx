import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { doc, getDoc } from 'firebase/firestore';
import { MemoryRouter } from 'react-router-dom';
import { RegistrationModal } from './RegistrationModal';

const mockNavigate = jest.fn();
const mockReact = React;

jest.mock('../../firebase', () => ({
  db: {},
  auth: {},
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('./LegalAgreementModal', () => ({
  __esModule: true,
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    return isOpen ? mockReact.createElement(
      'div',
      null,
      mockReact.createElement('h2', null, '이용약관 동의'),
      mockReact.createElement('button', { type: 'button', onClick: onClose }, '취소'),
    ) : null;
  },
}));

jest.mock('../../hooks/useConference', () => ({
  useConference: jest.fn(() => ({
    info: null,
    pricing: [],
    loading: false,
  })),
}));

jest.mock('../../hooks/useMemberVerification', () => ({
  useMemberVerification: jest.fn(() => ({
    verifyMember: jest.fn(),
    loading: false,
  })),
}));

jest.mock('../../hooks/useSocietyGrades', () => ({
  useSocietyGrades: jest.fn(() => ({
    getGradeLabel: jest.fn(),
    getGradeCodeByName: jest.fn(),
    gradesList: [],
  })),
}));

describe('RegistrationModal FREE_ALL flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (doc as jest.Mock).mockImplementation((...segments: string[]) => segments.join('/'));
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ paymentMode: 'FREE_ALL' }),
    });
  });

  it('opens terms modal when FREE_ALL is active', async () => {
    const onClose = jest.fn();

    render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(RegistrationModal, {
          isOpen: true,
          onClose,
          societyId: 'kap',
          societyName: 'KAP',
          confId: 'kap_2026spring',
        }),
      ),
    );

    // Wait for the modal state to change to free-all and open terms modal
    await waitFor(() => {
      // It shouldn't close automatically anymore
      expect(onClose).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('closes the whole registration flow when FREE_ALL terms are cancelled', async () => {
    const onClose = jest.fn();

    render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(RegistrationModal, {
          isOpen: true,
          onClose,
          societyId: 'kap',
          societyName: 'KAP',
          confId: 'kap_2026spring',
        }),
      ),
    );

    await waitFor(() => {
      expect(screen.getByText('이용약관 동의')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('취소')[0]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
