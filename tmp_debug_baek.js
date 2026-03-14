
import admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
}

const db = admin.firestore();

async function checkUser() {
    const confId = 'kadd_2026spring';
    const email = 'bmah3566@naver.com';

    console.log(`Searching for user with email: ${email} in ${confId}`);

    // Search in registrations
    let regSnap = await db.collection(`conferences/${confId}/registrations`).where('email', '==', email).get();
    let isExternal = false;

    if (regSnap.empty) {
        // Try userEmail as well
        regSnap = await db.collection(`conferences/${confId}/registrations`).where('userEmail', '==', email).get();
    }

    if (regSnap.empty) {
        regSnap = await db.collection(`conferences/${confId}/external_attendees`).where('email', '==', email).get();
        isExternal = true;
    }

    if (regSnap.empty) {
        console.log('Registration not found');
        return;
    }

    const doc = regSnap.docs[0];
    const regId = doc.id;
    const regData = doc.data();

    console.log('--- Current Data ---');
    console.log(`ID: ${regId} (External: ${isExternal})`);
    console.log(`Name: ${regData.name || regData.userName || regData.userInfo?.name}`);
    console.log(`Attendance Status: ${regData.attendanceStatus}`);
    console.log(`Current Zone: ${regData.currentZone}`);
    console.log(`Total Minutes: ${regData.totalMinutes}`);
    console.log(`Last Check-In: ${regData.lastCheckIn?.toDate?.()?.toLocaleString() || regData.lastCheckIn}`);

    const collName = isExternal ? 'external_attendees' : 'registrations';
    const logsSnap = await db.collection(`conferences/${confId}/${collName}/${regId}/logs`).orderBy('timestamp', 'asc').get();

    console.log('\n--- Logs (All) ---');
    let runningTotal = 0;
    logsSnap.docs.forEach(logDoc => {
        const d = logDoc.data();
        if (d.type === 'EXIT') {
            runningTotal += (d.recognizedMinutes || 0);
        }
        console.log(`[${d.type}] At: ${d.timestamp?.toDate?.()?.toLocaleString() || d.timestamp}, Method: ${d.method}, Mins: ${d.recognizedMinutes || 0}, Running Total: ${runningTotal}, Raw Duration: ${d.rawDuration}`);
    });
}

checkUser().catch(console.error);
