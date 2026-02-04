
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, ReactNode } from 'react';
import type { Conference } from '../types/schema';

interface ConfContextType {
  confId: string;
  conference: Conference | null;
  societyId?: string;
}

const ConfContext = createContext<ConfContextType | undefined>(undefined);

export const ConfProvider = ({ children, value }: { children: ReactNode; value: ConfContextType }) => {
  return <ConfContext.Provider value={value}>{children}</ConfContext.Provider>;
};

export const useConfContext = () => {
  const context = useContext(ConfContext);
  if (!context) {
    throw new Error('useConfContext must be used within a ConfProvider');
  }
  return context;
};
