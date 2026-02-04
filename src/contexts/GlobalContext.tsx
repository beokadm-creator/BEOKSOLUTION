
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, ReactNode } from 'react';
import type { ConferenceUser } from '../types/schema';

interface GlobalContextType {
  isSuperAdmin: boolean;
  user: ConferenceUser | null;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export const GlobalProvider = ({ children, value }: { children: ReactNode; value: GlobalContextType }) => {
  return <GlobalContext.Provider value={value}>{children}</GlobalContext.Provider>;
};

export const useGlobal = () => {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error('useGlobal must be used within a GlobalProvider');
  }
  return context;
};
