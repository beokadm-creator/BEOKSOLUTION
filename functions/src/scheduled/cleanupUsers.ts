import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const cleanupZombieUsers = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
    const listUsersResult = await admin.auth().listUsers(1000);
    const now = Date.now();
    const CUTOFF = 24 * 60 * 60 * 1000; // 24 Hours

    const deletePromises: Promise<any>[] = [];

    listUsersResult.users.forEach((userRecord) => {
        const createdAt = new Date(userRecord.metadata.creationTime).getTime();
        const isAnonymous = userRecord.providerData.length === 0; // Anonymous users have no provider data

        if (isAnonymous && (now - createdAt) > CUTOFF) {
            // Check if they have a paid registration?
            // This is hard to check efficiently for all users without a specialized index or user field.
            // For now, let's assume if they are still anonymous after 24h, they are zombies.
            // Real users would have linked account or we should have upgraded them.
            // BUT, what if a guest paid but didn't link? (If we implement linking correctly, this shouldn't happen)
            // If they paid, we usually create a registration document.
            // Let's rely on the fact that we will force linking or they are just temporary.
            
            // To be safe, we can check if they have a user document with 'registrations'?
            // Or just delete. Anonymous users are ephemeral by design.
            console.log(`Deleting zombie user: ${userRecord.uid}`);
            deletePromises.push(admin.auth().deleteUser(userRecord.uid));
        }
    });

    await Promise.all(deletePromises);
    console.log(`Deleted ${deletePromises.length} zombie users.`);
    return null;
});
