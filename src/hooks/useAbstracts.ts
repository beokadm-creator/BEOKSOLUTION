import { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, Timestamp, doc, updateDoc, arrayUnion, query, where, getDocs, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import { Submission } from '../types/schema';
import toast from 'react-hot-toast';

export const useAbstracts = (conferenceId?: string, userId?: string) => {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
    const [loadingSubs, setLoadingSubs] = useState(false);

    const fetchMySubmissions = useCallback(async () => {
        if (!userId) return;
        if (!conferenceId) return;
        setLoadingSubs(true);
        try {
            const ref = collection(db, `conferences/${conferenceId}/submissions`);
            const q = query(ref, where('userId', '==', userId));
            const snap = await getDocs(q);
            setMySubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));
        } catch (e: unknown) {
            console.error(e);
        } finally {
            setLoadingSubs(false);
        }
    }, [conferenceId, userId]);

    useEffect(() => {
        if (userId) fetchMySubmissions();
    }, [fetchMySubmissions, userId]);

    const submitAbstract = async (
        data: {
            title: { ko: string; en: string };
            field: string;
            type: string;
            authors: { name: string; email: string; affiliation: string; isPresenter: boolean; isFirstAuthor: boolean }[];
        },
        file: File | null,
        submissionId?: string
    ) => {
        if (!userId) {
            setError('User not logged in');
            return false;
        }

        if (!conferenceId) {
            setError('Conference ID is missing');
            return false;
        }

        setUploading(true);
        setError(null);
        try {
            let fileUrl = '';
            const timestamp = Timestamp.now();

            // 1. Upload File (If provided)
            if (file) {
                // Path: conferences/{confId}/abstracts/{userId}/{fileName}
                const storageRef = ref(storage, `conferences/${conferenceId}/abstracts/${userId}/${file.name}`);
                const snapshot = await uploadBytes(storageRef, file);
                fileUrl = await getDownloadURL(snapshot.ref);
            }

            if (submissionId) {
                // Update existing
                const subRef = doc(db, `conferences/${conferenceId}/submissions/${submissionId}`);

                const historyEntry = {
                    status: 'UPDATED' as const,
                    timestamp: timestamp,
                    comment: 'User updated submission' as const
                };

                const updateData: {
                    title: { ko: string; en: string };
                    field: string;
                    type: string;
                    authors: { name: string; email: string; affiliation: string; isPresenter: boolean; isFirstAuthor: boolean }[];
                    updatedAt: Timestamp;
                    status: string;
                    history: typeof historyEntry[];
                    fileUrl?: string;
                } = {
                    ...data,
                    updatedAt: timestamp,
                    status: 'submitted',
                    history: [historyEntry]
                };

                if (fileUrl) {
                    updateData.fileUrl = fileUrl;
                }

                await updateDoc(subRef, {
                    ...updateData,
                    history: arrayUnion(historyEntry)
                });
            } else {
                if (!fileUrl) throw new Error("File is required for new submission");

                // Create new
                const subRef = collection(db, `conferences/${conferenceId}/submissions`);
                await addDoc(subRef, {
                    userId,
                    submitterId: userId,
                    isMemberUser: true,
                    ...data,
                    fileUrl,
                    status: 'submitted',
                    submittedAt: timestamp,
                    history: [{
                        status: 'submitted',
                        timestamp: timestamp,
                        comment: 'Initial submission'
                    }],
                    createdAt: timestamp,
                    updatedAt: timestamp
                });
            }

            setUploading(false);
            fetchMySubmissions(); // Refresh list
            return true;
        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error(error);
            setError(error.message);
            setUploading(false);
            return false;
        }
    };

    const fetchAllSubmissions = async () => {
        if (!conferenceId) return []; // Early return if conferenceId is missing
        try {
            const ref = collection(db, `conferences/${conferenceId}/submissions`);
            const q = query(ref, orderBy('submittedAt', 'desc'));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission));
        } catch (e: unknown) {
            console.error(e);
            return [];
        }
    };

    const judgeSubmission = async (
        id: string,
        result: 'accepted_oral' | 'accepted_poster' | 'rejected',
        comment?: string
    ) => {
        if (!conferenceId) return false; // Early return if conferenceId is missing
        try {
            const ref = doc(db, `conferences/${conferenceId}/submissions/${id}`);
            await updateDoc(ref, {
                reviewStatus: result,
                presentationType: result === 'accepted_oral' ? 'Oral' : (result === 'accepted_poster' ? 'Poster' : undefined),
                reviewerComment: comment,
                reviewedAt: Timestamp.now(),
                history: arrayUnion({
                    status: result,
                    timestamp: Timestamp.now(),
                    comment: comment || `Judged as ${result}`
                })
            });
            return true;
        } catch (e: unknown) {
            console.error(e);
            setError(e instanceof Error ? e.message : 'Unknown error');
            return false;
        }
    };

    const deleteSubmission = async (submissionId: string) => {
        if (!userId) return false;
        if (!conferenceId) return false;
        if (!confirm('Are you sure you want to cancel this submission?')) return false;

        try {
            const sub = mySubmissions.find(s => s.id === submissionId);
            if (sub && sub.reviewStatus && sub.reviewStatus !== 'submitted') {
                toast.error('Cannot delete reviewed submission');
                return false;
            }
            
            // 1. Delete file from Storage
            if (sub?.fileUrl) {
                try {
                    const fileRef = ref(storage, sub.fileUrl);
                    await deleteObject(fileRef);
                } catch (error) {
                    console.warn("File delete failed (might be already missing):", error);
                }
            }
            
            // Delete doc
            const { deleteDoc } = await import('firebase/firestore'); 
            await deleteDoc(doc(db, `conferences/${conferenceId}/submissions/${submissionId}`));
            
            setMySubmissions(prev => prev.filter(s => s.id !== submissionId));
            return true;
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : 'Unknown error');
            return false;
        }
    };

    const deleteAbstractAsAdmin = async (submission: Submission) => {
        if (!conferenceId) {
            setError('Conference ID is missing');
            return false;
        }
        try {
            // 1. Delete file from Storage
            if (submission.fileUrl) {
                try {
                    const fileRef = ref(storage, submission.fileUrl);
                    await deleteObject(fileRef);
                } catch (error: unknown) {
                    console.warn("File delete failed (might be already missing):", error);
                    // Fallback: Proceed to delete document even if file delete fails
                    // This ensures "Clean Delete" attempt but doesn't block doc removal on ghost files
                }
            }
            
            // 2. Delete doc
            const { deleteDoc } = await import('firebase/firestore'); 
            await deleteDoc(doc(db, `conferences/${conferenceId}/submissions/${submission.id}`));
            
            return true;
        } catch (e) {
            console.error("Admin delete failed:", e);
            setError(e instanceof Error ? e.message : 'Unknown error');
            return false;
        }
    };

    return { uploading, error, submitAbstract, mySubmissions, loadingSubs, fetchAllSubmissions, judgeSubmission, deleteSubmission, deleteAbstractAsAdmin };
};
