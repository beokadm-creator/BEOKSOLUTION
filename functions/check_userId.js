const admin = require('firebase-admin');

// Ensure we have project ID set (we can use the default or initialize directly)
if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'eregi-8fc1e' });
}

const db = admin.firestore();

async function checkRegistrations() {
    console.log('Fetching conferences...');
    const confs = await db.collection('conferences').get();

    let totalRegs = 0;
    let missingUserId = 0;
    let guestUserId = 0;

    for (const conf of confs.docs) {
        const confId = conf.id;
        const regs = await db.collection(`conferences/${confId}/registrations`).get();
        totalRegs += regs.size;

        for (const r of regs.docs) {
            const data = r.data();
            const orderId = r.id; // or data.orderId
            const name = data.name || data.userInfo?.name;
            const email = data.email || data.userInfo?.email;
            const uidMatch = (data.userId === 'HrFOQzgeVGW8PQ0hUOhSUAlywIX2' || data.orderId === 'KADD-20260227-POML');

            if (uidMatch) {
                console.log(`\nFound target registration in conf: ${confId}`);
                console.log(`Document ID: ${r.id}, Order ID: ${data.orderId}`);
                console.log(`Name: ${name}, Email: ${email}`);
                console.log(`UserId in doc: '${data.userId}'`);
                console.log(`Full doc keys: ${Object.keys(data).join(', ')}`);
                console.log(`userInfo:`, JSON.stringify(data.userInfo));
            }

            if (!data.userId) {
                missingUserId++;
                // console.log(`Missing userId in conf ${confId}, reg ${r.id}, name ${name}`);
            } else if (data.userId === 'GUEST') {
                guestUserId++;
            }
        }
    }

    console.log(`\nSummary:`);
    console.log(`Total Registrations checked: ${totalRegs}`);
    console.log(`Missing userId (!userId): ${missingUserId}`);
    console.log(`GUEST userId (userId === 'GUEST'): ${guestUserId}`);
}

checkRegistrations().catch(console.error);
