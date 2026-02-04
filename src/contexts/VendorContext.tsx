
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, ReactNode } from 'react';
import { useVendor } from '../hooks/useVendor';

// Define the shape of the context
// This should match what useVendor returns + any extra state
type UseVendorReturn = ReturnType<typeof useVendor>;

interface VendorContextType extends UseVendorReturn {
    isConsentGiven: boolean; // Maintained for backward compatibility or UI state
    setConsentGiven: (val: boolean) => void;
    societyId?: string; // Add societyId for compatibility
}

const VendorContext = createContext<VendorContextType | undefined>(undefined);

export const VendorProvider = ({ children, value }: { children: ReactNode; value: VendorContextType }) => {
  return <VendorContext.Provider value={value}>{children}</VendorContext.Provider>;
};

export const useVendorContext = () => {
  const context = useContext(VendorContext);
  if (!context) {
    throw new Error('useVendorContext must be used within a VendorProvider');
  }
  return context;
};
