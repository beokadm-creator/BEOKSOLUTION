
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, ReactNode } from 'react';
import { DEFAULT_SOCIETY_FEATURES } from '../constants/defaults';
import type { Society } from '../types/schema';

interface SocietyContextType {
  societyId: string;
  society: Society | null;
  features: typeof DEFAULT_SOCIETY_FEATURES;
}

const SocietyContext = createContext<SocietyContextType | undefined>(undefined);

export const SocietyProvider = ({ children, value }: { children: ReactNode; value: SocietyContextType }) => {
  return <SocietyContext.Provider value={value}>{children}</SocietyContext.Provider>;
};

export const useSocietyContext = () => {
  const context = useContext(SocietyContext);
  if (!context) {
    throw new Error('useSocietyContext must be used within a SocietyProvider');
  }
  return context;
};
