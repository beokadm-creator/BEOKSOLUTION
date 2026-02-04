import { Timestamp } from 'firebase/firestore';
import { RegistrationSettings, UserTier } from '../types/schema';

export const getApplicablePrice = (
  settings: RegistrationSettings, 
  userTier: UserTier
): number => {
  const now = Timestamp.now();
  
  // Find active period
  const activePeriod = settings.periods.find(p => 
    now.seconds >= p.startDate.seconds && now.seconds <= p.endDate.seconds
  );

  if (!activePeriod) {
      // If no period is active, maybe fallback to ONSITE or throw error
      // For now, return -1 or throw
      console.warn("No active registration period found.");
      return 0; // Or handle as "Registration Closed"
  }

  const price = activePeriod.prices[userTier];
  return price !== undefined ? price : 0; // If tier not found in prices, assume free or 0? Or error.
};
