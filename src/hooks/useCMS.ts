import { useState } from 'react';
import { doc, updateDoc, collection, addDoc, deleteDoc, Timestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ConferenceInfo, Page, Agenda, Speaker, RegistrationSettings } from '../types/schema';

export const useCMS = (conferenceId: string) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 1. Basic Info
    const updateInfo = async (info: Partial<ConferenceInfo>) => {
        setLoading(true);
        try {
            const ref = doc(db, `conferences/${conferenceId}/info/general`);
            await updateDoc(ref, info);
            setLoading(false);
            return true;
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            setError(errorMessage);
            setLoading(false);
            return false;
        }
    };

    // 2. Registration Settings
    const updateRegSettings = async (settings: RegistrationSettings) => {
        setLoading(true);
        try {
            const ref = doc(db, `conferences/${conferenceId}/settings/registration_periods`);
            await setDoc(ref, settings); // Use set to create if not exists
            setLoading(false);
            return true;
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            setError(errorMessage);
            setLoading(false);
            return false;
        }
    };

    // 3. Pages
    const savePage = async (page: Omit<Page, 'id' | 'updatedAt'>, id?: string) => {
        setLoading(true);
        try {
            const data = { ...page, updatedAt: Timestamp.now() };
            if (id) {
                await updateDoc(doc(db, `conferences/${conferenceId}/pages/${id}`), data);
            } else {
                await addDoc(collection(db, `conferences/${conferenceId}/pages`), data);
            }
            setLoading(false);
            return true;
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            setError(errorMessage);
            setLoading(false);
            return false;
        }
    };

    const deletePage = async (id: string) => {
        try {
            await deleteDoc(doc(db, `conferences/${conferenceId}/pages/${id}`));
            return true;
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            setError(errorMessage);
            return false;
        }
    };

    // 4. Agendas & Speakers
    const saveAgenda = async (agenda: Omit<Agenda, 'id'>, id?: string) => {
        setLoading(true);
        try {
            if (id) {
                await updateDoc(doc(db, `conferences/${conferenceId}/agendas/${id}`), agenda);
            } else {
                await addDoc(collection(db, `conferences/${conferenceId}/agendas`), agenda);
            }
            setLoading(false);
            return true;
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            setError(message);
            setLoading(false);
            return false;
        }
    };

     const saveSpeaker = async (speaker: Omit<Speaker, 'id'>, id?: string) => {
        setLoading(true);
        try {
            if (id) {
                await updateDoc(doc(db, `conferences/${conferenceId}/speakers/${id}`), speaker);
            } else {
                await addDoc(collection(db, `conferences/${conferenceId}/speakers`), speaker);
            }
            setLoading(false);
            return true;
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            setError(message);
            setLoading(false);
            return false;
        }
    };

    const deleteAgenda = async (id: string) => {
        setLoading(true);
        try {
            await deleteDoc(doc(db, `conferences/${conferenceId}/agendas/${id}`));
            setLoading(false);
            return true;
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            setError(message);
            setLoading(false);
            return false;
        }
    };

    const deleteSpeaker = async (id: string) => {
        setLoading(true);
        try {
            await deleteDoc(doc(db, `conferences/${conferenceId}/speakers/${id}`));
            setLoading(false);
            return true;
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            setError(message);
            setLoading(false);
            return false;
        }
    };

    return { 
        loading, 
        error, 
        updateInfo, 
        updateRegSettings, 
        savePage, 
        deletePage, 
        saveAgenda,
        saveSpeaker,
        deleteAgenda,
        deleteSpeaker
    };
};
