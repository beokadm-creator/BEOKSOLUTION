/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getRemoteConfig, getValue, fetchAndActivate, RemoteConfig } from 'firebase/remote-config';
import { useAuth } from '../hooks/useAuth';

// Feature flag type definitions
interface FeatureFlags {
  optional_addons_enabled: boolean;
  optional_addons_rollout_percentage: number;
  [key: string]: boolean | number;
}

interface FeatureFlagContextValue {
  flags: FeatureFlags;
  isLoading: boolean;
  error: string | null;
  isEnabled: (flagName: string) => boolean;
  getRolloutPercentage: (flagName: string) => number;
  isUserInRollout: (flagName: string, userId?: string) => boolean;
}

const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null);

interface FeatureFlagProviderProps {
  children: ReactNode;
}

// Simple hash function for consistent user-based rollout
function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export function FeatureFlagProvider({ children }: FeatureFlagProviderProps) {
  const [flags, setFlags] = useState<FeatureFlags>({
    optional_addons_enabled: false,
    optional_addons_rollout_percentage: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Store remote config instance for potential future use (e.g., manual refresh)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [remoteConfig, setRemoteConfig] = useState<RemoteConfig | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initializeRemoteConfig = async () => {
      try {
        // Initialize Remote Config
        // Note: Firebase app is already initialized in src/firebase.ts
        // We need to import it to get the app instance
        const { default: app } = await import('../firebase');
        const rc = getRemoteConfig(app);

        // Settings for development
        rc.settings = {
          minimumFetchIntervalMillis: 60000, // 1 minute for dev
          fetchTimeoutMillis: 60000,
        };

        // Default values (fallback if Remote Config fetch fails)
        rc.defaultConfig = {
          optional_addons_enabled: false,
          optional_addons_rollout_percentage: 0,
        };

        // Store remote config instance for later use (if needed)
        setRemoteConfig(rc);

        // Fetch and activate
        await fetchAndActivate(rc);

        if (!isMounted) return;

        // Get flag values
        const addonsEnabled = getValue(rc, 'optional_addons_enabled').asBoolean();
        const rolloutPercentage = getValue(rc, 'optional_addons_rollout_percentage').asNumber();

        setFlags({
          optional_addons_enabled: addonsEnabled,
          optional_addons_rollout_percentage: rolloutPercentage,
        });

        setError(null);
      } catch (err) {
        console.error('[FeatureFlag] Remote Config fetch failed:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load feature flags');
          // Keep defaults on error
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeRemoteConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  // Check if a flag is enabled (boolean)
  const isEnabled = (flagName: string): boolean => {
    const value = flags[flagName];
    return typeof value === 'boolean' ? value : false;
  };

  // Get rollout percentage for a flag
  const getRolloutPercentage = (flagName: string): number => {
    const percentageFlag = `${flagName}_rollout_percentage`;
    const value = flags[percentageFlag];
    return typeof value === 'number' ? value : 0;
  };

  // Check if user is in rollout based on hash-based bucketing
  const isUserInRollout = (flagName: string, userId?: string): boolean => {
    if (!userId) return false;

    const percentage = getRolloutPercentage(flagName);
    if (percentage >= 100) return true;
    if (percentage <= 0) return false;

    const userHash = hashUserId(userId);
    const bucket = userHash % 100;
    return bucket < percentage;
  };

  const contextValue: FeatureFlagContextValue = {
    flags,
    isLoading,
    error,
    isEnabled,
    getRolloutPercentage,
    isUserInRollout,
  };

  return (
    <FeatureFlagContext.Provider value={contextValue}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags(): FeatureFlagContextValue {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within FeatureFlagProvider');
  }
  return context;
}

// Conference-specific feature flag hook
export function useConferenceFeatureFlag(flagName: string, conferenceId?: string) {
  const { isEnabled, getRolloutPercentage, isUserInRollout } = useFeatureFlags();
  const authState = useAuth();

  // Create conference-specific flag name
  const conferenceFlag = conferenceId ? `${flagName}_${conferenceId}` : flagName;

  // Check if flag is enabled globally or for this conference
  const globalEnabled = isEnabled(flagName);
  const conferenceEnabled = isEnabled(conferenceFlag);

  // Check rollout - authState.auth.user contains the user data
  const userUid = authState?.auth?.user?.uid;
  const isUserIncluded = userUid ? isUserInRollout(flagName, userUid) : false;

  return {
    enabled: globalEnabled || conferenceEnabled,
    rolloutPercentage: getRolloutPercentage(flagName),
    isUserIncluded,
  };
}
