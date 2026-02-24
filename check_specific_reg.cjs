const admin = require('firebase-admin');

if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: 'eregi-8fc1e'
    });
}

const db = admin.firestore();

async function checkSpecificRegistration(confId, regId) {
    console.log(`Checking registration ${regId} for conference ${confId}...`);
    const regRef = db.collection(`conferences/${confId}/registrations`).doc(regId);
    const snap = await regRef.get();

    if (!snap.exists) {
        console.log('❌ Registration not found.');
    } else {
        const data = snap.data();
        console.log('✅ Found Registration');
        console.log('Status:', data.status);
        console.log('Amount:', data.amount);
        console.log('BaseAmount:', data.baseAmount);
        console.log('OptionsTotal:', data.optionsTotal);
        console.log('Options field exists:', 'options' in data);
        console.log('SelectedOptions field exists:', 'selectedOptions' in data);
        console.log('Options content:', JSON.stringify(data.options, null, 2));
        console.log('SelectedOptions content:', JSON.stringify(data.selectedOptions, null, 2));
        console.log('Full document keys:', Object.keys(data));
    }
}

checkSpecificRegistration('kadd_2026spring', 'RqxUFdAos60G65ICC5Kq').catch(console.error);
