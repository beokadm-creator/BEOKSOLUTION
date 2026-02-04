import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Language = 'ko' | 'en';

interface UserState {
  language: Language;
  setLanguage: (lang: Language) => void;
  // Guest mode flag (if needed globally, otherwise handled in routing)
  isGuest: boolean;
  setGuest: (isGuest: boolean) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      language: 'ko',
      setLanguage: (lang) => set({ language: lang }),
      isGuest: false,
      setGuest: (isGuest) => set({ isGuest }),
    }),
    {
      name: 'user-storage',
    }
  )
);
