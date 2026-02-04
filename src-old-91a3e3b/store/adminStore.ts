import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Conference {
  id: string; // composite key: societyId_slug
  societyId: string;
  slug: string;
  title: {
    ko: string;
    en?: string;
  };
  dates: {
    start: unknown; // Timestamp
    end: unknown; // Timestamp
  };
  status: string;
}

interface AdminStore {
  // State
  selectedConferenceId: string | null;
  selectedConferenceSlug: string | null;
  selectedConferenceTitle: string | null; // Added
  selectedSocietyId: string | null;
  availableConferences: Conference[];
  inConferenceMode: boolean;
  
  // Actions
  selectConference: (conferenceId: string, slug: string, societyId: string, title?: string) => void;
  setAvailableConferences: (conferences: Conference[]) => void;
  clearSelection: () => void;
  autoSelectIfOnlyOne: () => void;
  enterConferenceMode: (conferenceId: string, slug: string, societyId: string, title?: string) => void;
  exitConferenceMode: () => void;
  setSocietyId: (id: string | null) => void;
}

export const useAdminStore = create<AdminStore>()(
  persist(
    (set, get) => ({
      // Initial state
      selectedConferenceId: null,
      selectedConferenceSlug: null,
      selectedConferenceTitle: null,
      selectedSocietyId: null,
      availableConferences: [],
      inConferenceMode: false,
      
      // Actions
      setSocietyId: (id: string | null) => {
        set({ selectedSocietyId: id });
      },
      selectConference: (conferenceId: string, slug: string, societyId: string, title?: string) => {
        set({
          selectedConferenceId: conferenceId,
          selectedConferenceSlug: slug,
          selectedConferenceTitle: title,
          selectedSocietyId: societyId,
          inConferenceMode: false,
        });
      },
      
      setAvailableConferences: (conferences: Conference[]) => {
        set({ availableConferences: conferences });
        
        // Auto-select if only one conference exists and no selection
        const currentState = get();
        if (conferences.length === 1 && !currentState.selectedConferenceId) {
          const conference = conferences[0];
          set({
            selectedConferenceId: conference.id,
            selectedConferenceSlug: conference.slug,
            selectedConferenceTitle: conference.title.ko,
            selectedSocietyId: conference.societyId,
          });
        }
      },
      
      clearSelection: () => {
        set({
          selectedConferenceId: null,
          selectedConferenceSlug: null,
          selectedConferenceTitle: null,
          selectedSocietyId: null,
          inConferenceMode: false,
        });
      },
      
      autoSelectIfOnlyOne: () => {
        const { availableConferences, selectedConferenceId } = get();
        if (availableConferences.length === 1 && !selectedConferenceId) {
          const conference = availableConferences[0];
          set({
            selectedConferenceId: conference.id,
            selectedConferenceSlug: conference.slug,
            selectedConferenceTitle: conference.title.ko,
            selectedSocietyId: conference.societyId,
          });
        }
      },
      
      enterConferenceMode: (conferenceId: string, slug: string, societyId: string, title?: string) => {
        set({
          selectedConferenceId: conferenceId,
          selectedConferenceSlug: slug,
          selectedConferenceTitle: title,
          selectedSocietyId: societyId,
          inConferenceMode: true,
        });
      },
      
      exitConferenceMode: () => {
        set({
          inConferenceMode: false,
        });
      },
    }),
    {
      name: 'admin-store-v3', // CHANGED NAME TO FORCE RESET
      partialize: (state) => ({
        selectedConferenceId: state.selectedConferenceId,
        selectedConferenceSlug: state.selectedConferenceSlug,
        selectedConferenceTitle: state.selectedConferenceTitle,
        selectedSocietyId: state.selectedSocietyId,
        inConferenceMode: state.inConferenceMode,
      }),
    }
  )
);
