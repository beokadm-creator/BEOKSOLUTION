import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { ConferenceOption } from '../types/schema';

interface UseConferenceOptionsResult {
  options: ConferenceOption[];
  loading: boolean;
  error: string | null;
  fetchOptions: () => Promise<void>;
  createOption: (option: Omit<ConferenceOption, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateOption: (id: string, updates: Partial<ConferenceOption>) => Promise<void>;
  deleteOption: (id: string) => Promise<void>;
  toggleActive: (id: string, currentState: boolean) => Promise<void>;
}

export const useConferenceOptions = (conferenceId?: string): UseConferenceOptionsResult => {
  const [options, setOptions] = useState<ConferenceOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all options for a conference
  const fetchOptions = useCallback(async () => {
    if (!conferenceId) {
      setOptions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const q = query(
        collection(db, `conferences/${conferenceId}/conference_options`),
        where('isActive', '==', true),
        orderBy('sortOrder', 'asc')
      );

      const snapshot = await getDocs(q);
      const optionsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ConferenceOption[];

      setOptions(optionsData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch options';
      setError(errorMessage);
      console.error('[useConferenceOptions] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [conferenceId]);

  // Create a new option
  const createOption = async (
    optionData: Omit<ConferenceOption, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    if (!conferenceId) {
      throw new Error('Conference ID is required');
    }

    try {
      const docRef = await addDoc(
        collection(db, `conferences/${conferenceId}/conference_options`),
        {
          ...optionData,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }
      );

      // Refresh options after creation
      await fetchOptions();
      return docRef.id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create option';
      setError(errorMessage);
      console.error('[useConferenceOptions] Create error:', err);
      throw err;
    }
  };

  // Update an existing option
  const updateOption = async (id: string, updates: Partial<ConferenceOption>) => {
    if (!conferenceId) {
      throw new Error('Conference ID is required');
    }

    try {
      const docRef = doc(db, `conferences/${conferenceId}/conference_options`, id);

      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });

      // Refresh options after update
      await fetchOptions();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update option';
      setError(errorMessage);
      console.error('[useConferenceOptions] Update error:', err);
      throw err;
    }
  };

  // Delete an option
  const deleteOption = async (id: string) => {
    if (!conferenceId) {
      throw new Error('Conference ID is required');
    }

    try {
      const docRef = doc(db, `conferences/${conferenceId}/conference_options`, id);
      await deleteDoc(docRef);

      // Refresh options after deletion
      await fetchOptions();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete option';
      setError(errorMessage);
      console.error('[useConferenceOptions] Delete error:', err);
      throw err;
    }
  };

  // Toggle active status
  const toggleActive = async (id: string, currentState: boolean) => {
    await updateOption(id, { isActive: !currentState });
  };

  // Initial fetch
  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  return {
    options,
    loading,
    error,
    fetchOptions,
    createOption,
    updateOption,
    deleteOption,
    toggleActive,
  };
};
