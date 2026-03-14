
import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Use service account if available, or ADC
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
}

const db = admin.firestore();

async function debugUser() {
    const confId = 'kadd_2026spring';
    const token = 'TKN-PeeDXTJFF2ZKXbuIPebX5cbu8Jx9Cx2W';

    console.log(`Checking token: ${token} in ${confId}`);

    const tokenSnap = await db.collection(`conferences/${confId}/badge_tokens`).doc(token).get();
    if (!tokenSnap.exists) {
        console.log('Token not found');
        return;
    }

    const tokenData = tokenSnap.data();
    const regId = tokenData.registrationId;
    console.log(`Registration ID: ${regId}`);

    // Check both collections
    let regSnap = await db.collection(`conferences/${confId}/registrations`).doc(regId).get();
    let isExternal = false;
    if (!regSnap.exists) {
        regSnap = await db.collection(`conferences/${confId}/external_attendees`).doc(regId).get();
        isExternal = true;
    }

    if (!regSnap.exists) {
        console.log('Registration not found');
        return;
    }

    const regData = regSnap.data();
    console.log('--- Current Data ---');
    console.log(`Name: ${regData.name || regData.userName || regData.userInfo?.name}`);
    console.log(`Attendance Status: ${regData.attendanceStatus}`);
    console.log(`Current Zone: ${regData.currentZone}`);
    console.log(`Total Minutes: ${regData.totalMinutes}`);
    console.log(`Last Check-In: ${regData.lastCheckIn?.toDate?.()?.toLocaleString() || regData.lastCheckIn}`);
    console.log(`Is Completed: ${regData.isCompleted}`);

    const collName = isExternal ? 'external_attendees' : 'registrations';
    const logsSnap = await db.collection(`conferences/${confId}/${collName}/${regId}/logs`).orderBy('timestamp', 'desc').get();

    console.log('\n--- Logs (Recent 20) ---');
    logsSnap.docs.slice(0, 20).forEach(doc => {
        const d = doc.data();
        console.log(`[${d.type}] At: ${d.timestamp?.toDate?.()?.toLocaleString() || d.timestamp}, Zone: ${d.zoneId}, Mins: ${d.recognizedMinutes || 0}, Total: ${d.accumulatedTotal || 0}`);
    });
}

debugUser().catch(console.error);
