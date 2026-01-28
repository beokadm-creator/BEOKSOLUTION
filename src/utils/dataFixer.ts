import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Submission, Registration } from '../types/schema';

export const fixBrokenSubmissions = async (conferenceId: string) => {
    console.log(`Starting data fix for conference: ${conferenceId}`);
    
    try {
        // 1. Fetch all submissions
        const submissionsRef = collection(db, `conferences/${conferenceId}/submissions`);
        const subSnap = await getDocs(submissionsRef);
        const submissions = subSnap.docs.map(d => ({ id: d.id, ...d.data() } as Submission));

        // 2. Fetch all registrations (for lookup)
        const registrationsRef = collection(db, `conferences/${conferenceId}/registrations`);
        const regSnap = await getDocs(registrationsRef);
        const registrations = regSnap.docs.map(d => ({ id: d.id, ...d.data() } as Registration));

        let fixedCount = 0;
        const batch = writeBatch(db);
        const logs: string[] = [];

        for (const sub of submissions) {
            // Check if broken: No userId and No registrationId (or missing submitterId)
            const isBroken = !sub.userId && !sub.registrationId;
            const isMissingSubmitterId = !sub.submitterId;

            // Also check if submitterId exists but is not in the interface (legacy data)
            
            if (!isBroken && !isMissingSubmitterId && typeof sub.isMemberUser !== 'undefined') continue;

            // Target: Non-member submissions that lost their link
            // Strategy: Match by author email or name
            const authorEmail = sub.authors.find(a => a.isPresenter)?.email || sub.authors[0]?.email;
            const authorName = sub.authors.find(a => a.isPresenter)?.name || sub.authors[0]?.name;

            if (!authorEmail || !authorName) {
                logs.push(`[Skip] Submission ${sub.id}: No author email or name found.`);
                continue;
            }

            // Find matching registration
            // Try to match by Email AND Name (Strong Match)
            const matchedReg = registrations.find(r => {
                 // Use intersection type to handle potential legacy fields without 'as any'
                 const reg = r as Registration & { email?: string; name?: string };
                 const regEmail = reg.email || reg.userEmail;
                 const regName = reg.name || reg.userName;
                 
                 return regEmail === authorEmail && regName === authorName; 
            });

            const updateData: Partial<Submission> = {};
            let needsUpdate = false;

            if (matchedReg) {
                if (!sub.registrationId && !sub.userId) {
                    updateData.registrationId = matchedReg.id;
                    needsUpdate = true;
                    logs.push(`[Link] Submission ${sub.id} -> Reg ${matchedReg.id} (Email: ${authorEmail}, Name: ${authorName})`);
                }
            }

            // Ensure submitterId is populated
            if (!sub.submitterId) {
                const newSubmitterId = sub.userId || updateData.registrationId || sub.registrationId;
                if (newSubmitterId) {
                    updateData.submitterId = newSubmitterId;
                    needsUpdate = true;
                }
            }

            // Ensure isMemberUser is populated
            if (typeof sub.isMemberUser === 'undefined') {
                updateData.isMemberUser = !!sub.userId;
                needsUpdate = true;
            }

            if (needsUpdate) {
                const subRef = doc(db, `conferences/${conferenceId}/submissions/${sub.id}`);
                batch.update(subRef, updateData);
                fixedCount++;
            }
        }

        if (fixedCount > 0) {
            await batch.commit();
            console.log(`Successfully fixed ${fixedCount} submissions.`);
        } else {
            console.log("No submissions needed fixing.");
        }
        
        return { success: true, fixedCount, logs };

    } catch (error) {
        console.error("Data fix failed:", error);
        return { success: false, error };
    }
};
