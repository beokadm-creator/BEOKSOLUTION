import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const runRecovery = async (conferenceId: string, dryRun: boolean = true) => {
    console.log(`🚀 Starting Data Recovery for Conference: ${conferenceId} (DryRun: ${dryRun})`);
    
    try {
        const regRef = collection(db, 'conferences', conferenceId, 'registrations');
        const snapshot = await getDocs(regRef);
        
        let processed = 0;
        let fixed = 0;
        let orphans = 0;
        let skipped = 0;
        
        // Note: Batches have 500 op limit. For large sets, process in chunks.
        // For simplicity in this urgent patch, we might do individual updates if > 500, or just handle first 500.
        // Let's stick to individual updates for safety/logging unless volume is huge.
        
        for (const d of snapshot.docs) {
            const data = d.data();
            const rId = d.id;
            
            // Check if userName is missing or empty
            if (!data.userName || data.userName.trim() === '') {
                console.log(`⚠️ Found incomplete registration: ${rId} (User: ${data.userId})`);
                
                if (!data.userId) {
                    console.error(`❌ Registration ${rId} has NO userId. Marking for deletion.`);
                    orphans++;
                    if (!dryRun) {
                        // Option 1: Delete
                        // await deleteDoc(d.ref); 
                        // Option 2: Mark INVALID (Safer)
                        await updateDoc(d.ref, { status: 'INVALID_NO_USERID' });
                        console.log(`   -> Marked INVALID`);
                    }
                    continue;
                }

                // Fetch User
                const userRef = doc(db, 'users', data.userId);
                const userSnap = await getDoc(userRef);
                
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    console.log(`   ✅ Found User: ${userData.name} (${userData.email})`);
                    
                    fixed++;
                    if (!dryRun) {
                        await updateDoc(d.ref, {
                            userName: userData.name || 'Unknown',
                            userEmail: userData.email || '',
                            userPhone: userData.phone || '',
                            // Add other fields if needed
                        });
                        console.log(`   -> Updated Registration`);
                    }
                } else {
                    console.error(`❌ User ${data.userId} not found for Reg ${rId}. Orphan.`);
                    orphans++;
                    if (!dryRun) {
                        await updateDoc(d.ref, { status: 'INVALID_ORPHAN_USER' });
                        console.log(`   -> Marked INVALID`);
                    }
                }
            } else {
                skipped++;
            }
            processed++;
        }
        
        console.log('==========================================');
        console.log(`🏁 Recovery Complete.`);
        console.log(`Total Scanned: ${processed}`);
        console.log(`Skipped (Valid): ${skipped}`);
        console.log(`Fixed/To-Fix: ${fixed}`);
        console.log(`Orphans/Invalid: ${orphans}`);
        console.log('==========================================');
        
        return { processed, fixed, orphans, skipped };
        
    } catch (e) {
        console.error("Recovery Failed:", e);
        throw e;
    }
};
