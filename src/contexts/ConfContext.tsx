
import React, { createContext, useContext, ReactNode } from 'react';

interface ConfContextType {
  confId: string;
  conference: any; // Replace with proper Conference type
  societyId?: string; // Add societyId for compatibility
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
