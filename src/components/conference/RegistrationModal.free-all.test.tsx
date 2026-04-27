import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { doc, getDoc } from 'firebase/firestore';
import { MemoryRouter } from 'react-router-dom';
import { RegistrationModal } from './RegistrationModal';

const mockNavigate = jest.fn();

jest.mock('../../firebase', () => ({
  db: {},
  auth: {},
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
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
});
