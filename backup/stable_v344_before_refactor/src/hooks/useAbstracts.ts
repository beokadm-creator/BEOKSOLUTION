import { useState, useEffect } from 'react';
import { collection, addDoc, Timestamp, doc, updateDoc, arrayUnion, query, where, getDocs, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import { Submission } from '../types/schema';

export const useAbstracts = (conferenceId: string, userId?: string) => {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
    const [loadingSubs, setLoadingSubs] = useState(false);

    const fetchMySubmissions = async () => {
        if (!userId) return;
        setLoadingSubs(true);
        try {
            const ref = collection(db, `conferences/${conferenceId}/submissions`);
            const q = query(ref, where('userId', '==', userId)); // Need to ensure userId is saved in doc
            const snap = await getDocs(q);
            setMySubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));
        } catch (e: any) {
            console.error(e);
        } finally {
            setLoadingSubs(false);
        }
    };

    useEffect(() => {
        if (userId) fetchMySubmissions();
    }, [conferenceId, userId]);

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
        setUploading(true);
        setError(null);
        try {
            let fileUrl = '';
            const timestamp = Timestamp.now();

            // 1. Upload File (If provided)
            if (file) {
                // [Fix] Path: conferences/{confId}/abstracts/{userId}/{fileName}
                const storageRef = ref(storage, `conferences/${conferenceId}/abstracts/${userId}/${file.name}`);
                const snapshot = await uploadBytes(storageRef, file);
                fileUrl = await getDownloadURL(snapshot.ref);
            }

            if (submissionId) {
                // Update existing
                const subRef = doc(db, `conferences/${conferenceId}/submissions/${submissionId}`);
                
                const updateData: any = {
                    ...data,
                    updatedAt: timestamp,
                    status: 'submitted', // Reset status on update? Or keep? Prompt says 'submitted'.
                    history: arrayUnion({
                        status: 'UPDATED',
                        timestamp: timestamp,
                        comment: 'User updated submission'
                    })
                };
                
                if (fileUrl) {
                    updateData.fileUrl = fileUrl;
                }

                await updateDoc(subRef, updateData);
            } else {
                if (!fileUrl) throw new Error("File is required for new submission");

                // Create new
                const subRef = collection(db, `conferences/${conferenceId}/submissions`);
                await addDoc(subRef, {
                    userId, // Important for querying
                    ...data,
                    fileUrl,
                    status: 'submitted',
                    submittedAt: timestamp, // [New]
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
        } catch (err: any) {
            console.error(err);
            setError(err.message);
            setUploading(false);
            return false;
        }
    };

    const fetchAllSubmissions = async () => {
        try {
            const ref = collection(db, `conferences/${conferenceId}/submissions`);
            const q = query(ref, orderBy('submittedAt', 'desc'));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission));
        } catch (e: any) {
            console.error(e);
            return [];
        }
    };

    const judgeSubmission = async (
        id: string,
        result: 'accepted_oral' | 'accepted_poster' | 'rejected',
        comment?: string
    ) => {
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
        } catch (e: any) {
            console.error(e);
            setError(e.message);
            return false;
        }
    };

    const deleteSubmission = async (submissionId: string) => {
        if (!userId) return false;
        if (!confirm('Are you sure you want to cancel this submission?')) return false;

        try {
            const sub = mySubmissions.find(s => s.id === submissionId);
            if (sub && sub.reviewStatus && sub.reviewStatus !== 'submitted') {
                alert('Cannot delete reviewed submission');
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
        } catch (e: any) {
            console.error(e);
            setError(e.message);
            return false;
        }
    };

    return { uploading, error, submitAbstract, mySubmissions, loadingSubs, fetchAllSubmissions, judgeSubmission, deleteSubmission };
};
