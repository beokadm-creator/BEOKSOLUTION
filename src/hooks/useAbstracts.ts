import * as XLSX from 'xlsx';
import { useState, useEffect } from 'react';
import { collection, addDoc, Timestamp, doc, updateDoc, arrayUnion, query, where, getDocs, orderBy, or } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import { Submission } from '../types/schema';
import toast from 'react-hot-toast';

export const useAbstracts = (conferenceId?: string, userId?: string, registrationId?: string) => {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
    const [loadingSubs, setLoadingSubs] = useState(false);

    const fetchMySubmissions = async () => {
        if (!userId && !registrationId) return;
        if (!conferenceId) return; // Early return if conferenceId is missing
        setLoadingSubs(true);
        try {
            const ref = collection(db, `conferences/${conferenceId}/submissions`);
            
            // Query with fallback logic: try userId first, then registrationId
            let snap;
            if (userId && registrationId) {
                // If both exist, query both and merge results
                const q1 = query(ref, where('userId', '==', userId));
                const q2 = query(ref, where('registrationId', '==', registrationId));
                const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
                
                // Merge results and remove duplicates
                const allDocs = new Map();
                snap1.docs.forEach(d => allDocs.set(d.id, d));
                snap2.docs.forEach(d => allDocs.set(d.id, d));
                snap = { docs: Array.from(allDocs.values()) };
            } else if (userId) {
                const q = query(ref, where('userId', '==', userId));
                snap = await getDocs(q);
            } else {
                const q = query(ref, where('registrationId', '==', registrationId));
                snap = await getDocs(q);
            }
            
            setMySubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));
        } catch (e: any) {
            console.error(e);
        } finally {
            setLoadingSubs(false);
        }
    };

    useEffect(() => {
        if (userId || registrationId) fetchMySubmissions();
    }, [conferenceId, userId, registrationId]);

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
        if (!userId && !registrationId) {
            setError('User not logged in');
            return false;
        }
        
        if (!conferenceId) {
            setError('Conference ID is missing');
            return false;
        }
        
        // [Task 2] Priority Logic & Mandatory submitterId
        const submitterId = userId || registrationId;
        const isMemberUser = !!userId;

        if (!submitterId) {
             setError('Submitter ID is missing');
             return false;
        }

        setUploading(true);
        setError(null);
        try {
            let fileUrl = '';
            const timestamp = Timestamp.now();

            // 1. Upload File (If provided)
            if (file) {
                // [Fix] Path: conferences/{confId}/abstracts/{submitterId}/{fileName}
                const storageRef = ref(storage, `conferences/${conferenceId}/abstracts/${submitterId}/${file.name}`);
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
                    userId: userId || null,
                    registrationId: registrationId || null,
                    submitterId, // Shadow UID for unified querying
                    isMemberUser, // [Task 3] Query Efficiency
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
        if (!conferenceId) return []; // Early return if conferenceId is missing
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
        } catch (e: any) {
            console.error(e);
            setError(e.message);
            return false;
        }
    };

    const deleteSubmission = async (submissionId: string) => {
        if (!userId && !registrationId) return false;
        if (!conferenceId) return false; // Early return if conferenceId is missing
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
        } catch (e: any) {
            console.error(e);
            setError(e.message);
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
                } catch (error: any) {
                    console.warn("File delete failed (might be already missing):", error);
                    // Fallback: Proceed to delete document even if file delete fails
                    // This ensures "Clean Delete" attempt but doesn't block doc removal on ghost files
                }
            }
            
            // 2. Delete doc
            const { deleteDoc } = await import('firebase/firestore'); 
            await deleteDoc(doc(db, `conferences/${conferenceId}/submissions/${submission.id}`));
            
            return true;
        } catch (e: any) {
            console.error("Admin delete failed:", e);
            setError(e.message);
            return false;
        }
    };

    return { uploading, error, submitAbstract, mySubmissions, loadingSubs, fetchAllSubmissions, judgeSubmission, deleteSubmission, deleteAbstractAsAdmin };
};
