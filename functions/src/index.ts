 
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import cors from 'cors';
import { approveTossPayment, cancelTossPayment as cancelTossPaymentApi } from './payment/toss';
import { verifyPaymentAmount } from './utils/paymentVerifier'; // New import

import { onRegistrationCreated, onExternalAttendeeCreated, validateBadgePrepToken, issueDigitalBadge, resendBadgePrepToken, generateBadgePrepToken, sendBadgeNotification, bulkSendNotifications } from './badge/index';
import type { Conference as BadgeConference, Registration as BadgeRegistration } from './badge/index';
import { migrateRegistrationsForOptions, migrateRegistrationsForOptionsCallable } from './migrations/migrateRegistrationsForOptions';
import { monitorRegistrationIntegrity, monitorMemberCodeIntegrity } from './monitoring/dataIntegrity';
import { dailyErrorReport, weeklyPerformanceReport } from './monitoring/scheduledReports';
import { scheduledHealthCheck, manualHealthCheck } from './monitoring/scheduledHealthCheck';
import { resolveDataIntegrityAlert } from './monitoring/resolveAlert';
import { scheduledAutoCheckout, manualAutoCheckout } from './attendance/autoCheckout';
import { sendVendorAlimTalk } from './vendor/sendAlimTalk';
import { resolveVendorBadgeScan } from './vendor/resolveBadgeScan';
import { processVendorVisit } from './vendor/processVendorVisit';
import { logAuditEvent } from './audit/logAuditEvent';
import { withdrawConsent } from './vendor/withdrawConsent';
import { scheduledDataCleanup, manualDataCleanup } from './scheduled/dataCleanup';
import { requestStampReward } from './stampTour/requestStampReward';
import { adminDrawStampReward } from './stampTour/adminDrawStampReward';
import { runStampRewardLottery } from './stampTour/runStampRewardLottery';
import { issueCertificate, verifyCertificate, verifyCertificatePublic, revokeCertificate, logCertificateDownload, reissueCertificate } from './certificate/index';

export const corsHandler = cors({ origin: true });

admin.initializeApp();

export {
    onRegistrationCreated,
    onExternalAttendeeCreated,
    validateBadgePrepToken,
    issueDigitalBadge,
    resendBadgePrepToken,
    bulkSendNotifications,
    generateFirebaseAuthUserForExternalAttendee,
    migrateRegistrationsForOptions,
    migrateRegistrationsForOptionsCallable,
    monitorRegistrationIntegrity,
    monitorMemberCodeIntegrity,
    dailyErrorReport,
    weeklyPerformanceReport,
    scheduledHealthCheck,
    manualHealthCheck,
    resolveDataIntegrityAlert,
    scheduledAutoCheckout,
    manualAutoCheckout,
    sendVendorAlimTalk,
    resolveVendorBadgeScan,
    processVendorVisit,
    logAuditEvent,
    withdrawConsent,
    scheduledDataCleanup,
    manualDataCleanup,
    requestStampReward,
    adminDrawStampReward,
    runStampRewardLottery,
    issueCertificate,
    verifyCertificate,
    verifyCertificatePublic,
    revokeCertificate,
    logCertificateDownload,
    reissueCertificate
};

import { generateFirebaseAuthUserForExternalAttendee } from './auth/external';

// --------------------------------------------------------------------------
// PAYMENT: TOSS PAYMENTS
// --------------------------------------------------------------------------

// 1. Confirm TossPayment (HTTP Endpoint with CORS for custom domains)
export const confirmTossPaymentHttp = functions
    .runWith({
        enforceAppCheck: false, // Keep false as it might be used for external integrations/webhooks
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onRequest(async (req, res) => {
        return corsHandler(req, res, async () => {
            // Handle OPTIONS preflight request
            if (req.method === 'OPTIONS') {
                res.status(204).end();
                return;
            }

            // Only allow POST requests
            if (req.method !== 'POST') {
                res.status(405).json({ error: 'Method not allowed' });
                return;
            }

            const { paymentKey, orderId, amount, regId, confId, secretKey, userData, baseAmount, optionsTotal, selectedOptions } = req.body;

            if (!paymentKey || !orderId || !amount || !confId) { // Added confId to required check
                res.status(400).json({ error: 'Missing required parameters' });
                return;
            }

            // [Security] Verify Payment Amount against Database
            const verification = await verifyPaymentAmount(confId, userData?.tier, selectedOptions || [], Number(amount));
            if (!verification.isValid) {
                functions.logger.error(`[Security] HTTP Payment verification failed for ${regId}: ${verification.error}`);
                res.status(403).json({ error: verification.error || 'Payment amount verification failed' });
                return;
            }

            if (!userData) {
                res.status(400).json({ error: 'Missing user data for registration creation' });
                return;
            }

            // [Security] 繞벿살탮???繹먮굞夷??꾩렮維?: ???됰뎄 userId + ???됰뎄 ???덈뻿???????PAID ?繹먮굞夷?????깅さ嶺?嶺뚢뼰維??
            if (userData.userId && userData.userId !== 'GUEST' && confId) {
                const existingRegsSnap = await admin.firestore()
                    .collection(`conferences/${confId}/registrations`)
                    .where('userId', '==', userData.userId)
                    .where('status', '==', 'PAID')
                    .limit(1)
                    .get();
                if (!existingRegsSnap.empty) {
                    functions.logger.warn(`[DuplicateBlock-HTTP] userId=${userData.userId} already has PAID registration in ${confId}`);
                    res.status(409).json({ error: '이미 해당 학술대회에 등록이 완료된 계정입니다. 동일 계정으로 중복 등록은 불가합니다.' });
                    return;
                }
            }

            try {
                // [Modified] Fetch Secret Key from DB (Secure)
                const db = admin.firestore();
                const confSnap = await db.collection('conferences').doc(confId).get();
                const societyId = confSnap.data()?.societyId;

                let finalSecretKey = secretKey; // Fallback
                let finalStoreId: string | null = null;

                if (societyId) {
                    const infraSnap = await db.collection('societies').doc(societyId).collection('settings').doc('infrastructure').get();
                    if (infraSnap.exists) {
                        const infraData = infraSnap.data();
                        if (infraData?.payment?.domestic?.secretKey) {
                            finalSecretKey = infraData.payment.domestic.secretKey;
                            finalStoreId = infraData.payment.domestic.storeId || null;
                            functions.logger.info(`[TossPaymentHttp] Loaded Secure Key for ${societyId} (Starts with: ${finalSecretKey.substring(0, 5)}...) StoreId: ${finalStoreId}`);
                        }
                    }
                }

                if (!finalSecretKey) {
                    res.status(500).json({ error: 'Payment Secret Key configuration missing.' });
                    return;
                }

                // 1. Call Toss API
                const approvalResult: { method?: string; status?: string; virtualAccount?: Record<string, unknown> | null; [key: string]: unknown } = await approveTossPayment(paymentKey, orderId, amount, finalSecretKey, finalStoreId);

                // 2. If success (no error thrown), create Registration document
                if (regId && confId) {
                    const regRef = admin.firestore().collection(`conferences/${confId}/registrations`).doc(regId);

                    // Generate receipt number (simplified for now)
                    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
                    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();

                    // Get conference to resolve society ID
                    const confSnap = await admin.firestore().collection('conferences').doc(confId).get();
                    const societyId = confSnap.data()?.societyId;

                    // Determine payment method from approval result
                    const paymentMethod = (approvalResult?.method as string) || 'CARD';
                    const paymentStatus = approvalResult?.status; // 'DONE' or 'WAITING_FOR_DEPOSIT'

                    let status = 'PAID';
                    let dbPaymentStatus = 'PAID';

                    // [FIX-20250212] Virtual Account Handling
                    if (paymentStatus === 'WAITING_FOR_DEPOSIT') {
                        status = 'PENDING_PAYMENT';
                        dbPaymentStatus = 'WAITING_FOR_DEPOSIT';
                    }

                    // Create Registration document with PAID status
                    await regRef.set({
                        id: regId,
                        userId: userData.userId || 'GUEST',
                        userInfo: {
                            name: userData.name,
                            email: userData.email,
                            phone: userData.phone,
                            affiliation: userData.affiliation,
                            licenseNumber: userData.licenseNumber || ''
                        },
                        email: userData.email,
                        phone: userData.phone,
                        name: userData.name,
                        conferenceId: confId,
                        status: status,
                        paymentStatus: dbPaymentStatus,
                        paymentMethod: paymentMethod,
                        paymentKey: paymentKey,
                        orderId: orderId,
                        amount: amount,
                        baseAmount: baseAmount || amount,
                        optionsTotal: optionsTotal || 0,
                        options: selectedOptions || [],
                        tier: userData.tier || null,
                        categoryName: userData.categoryName || null,
                        memberVerificationData: null,
                        isAnonymous: userData.isAnonymous || false,
                        agreementDetails: {},
                        paymentDetails: approvalResult,
                        virtualAccount: approvalResult.virtualAccount || null,
                        receiptNumber: `${dateStr}-${rand}`,
                        confirmationQr: regId, // Use regId directly for InfoDesk scanning
                        badgeQr: null,
                        isCheckedIn: false,
                        checkInTime: null,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        paidAt: status === 'PAID' ? admin.firestore.FieldValue.serverTimestamp() : null
                    }, { merge: false });

                    // [Security] Lock the Member Code & Log History -> ONLY IF PAID
                    if (status === 'PAID') {
                        try {
                            // A. Lock Code
                            if (societyId && userData.memberVerificationData && userData.memberVerificationData.id) {
                                const memberId = userData.memberVerificationData.id;
                                const memberRef = admin.firestore().collection('societies').doc(societyId).collection('members').doc(memberId);
                                await memberRef.update({
                                    used: true,
                                    usedBy: userData.userId || 'unknown',
                                    usedAt: admin.firestore.FieldValue.serverTimestamp()
                                });
                                functions.logger.info(`[Member Locked] Member ${memberId} locked for registration ${regId}`);
                            }

                            // B. Create/Update User Document (users/{uid})
                            if (userData.userId && userData.userId !== 'GUEST') {
                                const userRef = admin.firestore().collection('users').doc(userData.userId);
                                const userSnap = await userRef.get();

                                if (!userSnap.exists) {
                                    // Create new user document (match signup field structure)
                                    await userRef.set({
                                        uid: userData.userId,
                                        email: userData.email,
                                        name: userData.name,
                                        phone: userData.phone,
                                        affiliation: userData.affiliation,
                                        organization: userData.affiliation, // Standard field
                                        licenseNumber: userData.licenseNumber || '',
                                        tier: userData.tier || 'NON_MEMBER',
                                        isAnonymous: false,
                                        isForeigner: false,
                                        country: 'KR',
                                        authStatus: {
                                            emailVerified: false,
                                            phoneVerified: false
                                        },
                                        simplePassword: null,
                                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                                    });
                                    functions.logger.info(`[User Created] User document created for ${userData.userId}`);
                                } else {
                                    // Update existing user document
                                    await userRef.update({
                                        email: userData.email,
                                        name: userData.name,
                                        phone: userData.phone,
                                        affiliation: userData.affiliation,
                                        organization: userData.affiliation,
                                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                                    });
                                    functions.logger.info(`[User Updated] User document updated for ${userData.userId}`);
                                }

                                // C. Log Participation History (users/{uid}/participations/{regId})
                                await admin.firestore().collection('users').doc(userData.userId).collection('participations').doc(regId).set({
                                    conferenceId: confId,
                                    conferenceName: '', // Will be populated later if needed
                                    registrationId: regId,
                                    societyId: societyId || 'unknown',
                                    role: 'ATTENDEE',
                                    registeredAt: admin.firestore.FieldValue.serverTimestamp(),
                                    paidAt: admin.firestore.FieldValue.serverTimestamp(),
                                    amount: amount,
                                    status: 'PAID'
                                }, { merge: true });
                                functions.logger.info(`[History Logged] Participation saved for user ${userData.userId}`);
                            }
                        } catch (postProcessError) {
                            functions.logger.error("Failed to post-process (Lock/History) for Toss Payment:", postProcessError);
                            // Non-blocking
                        }
                    } else {
                        functions.logger.info(`[Virtual Account] Registration created in PENDING state for ${regId}. Waiting for deposit.`);
                    }
                }

                // Return success response
                res.status(200).json({ success: true, data: approvalResult });

            } catch (error: unknown) {
                functions.logger.error("Error in confirmTossPaymentHttp:", error);
                const errorMessage = error instanceof Error ? error.message : 'Payment confirmation failed';
                res.status(500).json({ error: errorMessage });
            }
        });
    });


// --------------------------------------------------------------------------
// FREE REGISTRATION (0 KRW)
// --------------------------------------------------------------------------
export const processFreeRegistrationHttp = functions
    .runWith({
        enforceAppCheck: false,
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onRequest(async (req, res) => {
        return corsHandler(req, res, async () => {
            if (req.method === 'OPTIONS') {
                res.status(204).end();
                return;
            }

            if (req.method !== 'POST') {
                res.status(405).json({ error: 'Method not allowed' });
                return;
            }

            const { regId, confId, userData, amount, baseAmount, optionsTotal, selectedOptions } = req.body;

            if (!regId || !confId || !userData || amount === undefined) {
                res.status(400).json({ error: 'Missing required parameters' });
                return;
            }

            if (Number(amount) !== 0) {
                res.status(400).json({ error: 'Amount must be 0 for free registration' });
                return;
            }

            // [Security] Verify Payment Amount against Database
            const verification = await verifyPaymentAmount(confId, userData.tier, selectedOptions || [], Number(amount));
            if (!verification.isValid) {
                functions.logger.error(`[Security] Free Registration verification failed for ${regId}: ${verification.error}`);
                res.status(403).json({ error: verification.error || 'Payment amount verification failed' });
                return;
            }

            if (userData.userId && userData.userId !== 'GUEST' && confId) {
                const existingRegsSnap = await admin.firestore()
                    .collection(`conferences/${confId}/registrations`)
                    .where('userId', '==', userData.userId)
                    .where('status', '==', 'PAID')
                    .limit(1)
                    .get();
                if (!existingRegsSnap.empty) {
                    functions.logger.warn(`[DuplicateBlock-HTTP] userId=${userData.userId} already has PAID registration in ${confId}`);
                    res.status(409).json({ error: '이미 해당 학술대회에 등록이 완료된 계정입니다. 동일 계정으로 중복 등록은 불가합니다.' });
                    return;
                }
            }

            try {
                const db = admin.firestore();
                const regRef = db.collection(`conferences/${confId}/registrations`).doc(regId);
                const confSnap = await db.collection('conferences').doc(confId).get();
                const societyId = confSnap.data()?.societyId;

                const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
                const rand = Math.random().toString(36).substring(2, 6).toUpperCase();

                await regRef.set({
                    id: regId,
                    userId: userData.userId || 'GUEST',
                    userInfo: {
                        name: userData.name,
                        email: userData.email,
                        phone: userData.phone,
                        affiliation: userData.affiliation,
                        licenseNumber: userData.licenseNumber || ''
                    },
                    email: userData.email,
                    phone: userData.phone,
                    name: userData.name,
                    conferenceId: confId,
                    status: 'PAID',
                    paymentStatus: 'PAID',
                    paymentMethod: 'FREE',
                    paymentKey: 'FREE',
                    orderId: `FREE-${regId}`,
                    amount: 0,
                    baseAmount: baseAmount || 0,
                    optionsTotal: optionsTotal || 0,
                    options: selectedOptions || [],
                    tier: userData.tier || null,
                    categoryName: userData.categoryName || null,
                    memberVerificationData: null,
                    isAnonymous: userData.isAnonymous || false,
                    agreementDetails: {},
                    paymentDetails: { status: 'DONE', method: 'FREE' },
                    receiptNumber: `${dateStr}-${rand}`,
                    confirmationQr: regId,
                    badgeQr: null,
                    isCheckedIn: false,
                    checkInTime: null,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    paidAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: false });

                try {
                    if (societyId && userData.memberVerificationData && userData.memberVerificationData.id) {
                        const memberId = userData.memberVerificationData.id;
                        const memberRef = db.collection('societies').doc(societyId).collection('members').doc(memberId);
                        await memberRef.update({
                            used: true,
                            usedBy: userData.userId || 'unknown',
                            usedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }

                    if (userData.userId && userData.userId !== 'GUEST') {
                        const userRef = db.collection('users').doc(userData.userId);
                        const userSnap = await userRef.get();

                        if (!userSnap.exists) {
                            await userRef.set({
                                uid: userData.userId,
                                email: userData.email,
                                name: userData.name,
                                phone: userData.phone,
                                affiliation: userData.affiliation,
                                organization: userData.affiliation,
                                licenseNumber: userData.licenseNumber || '',
                                tier: userData.tier || 'NON_MEMBER',
                                isAnonymous: false,
                                isForeigner: false,
                                country: 'KR',
                                authStatus: { emailVerified: false, phoneVerified: false },
                                simplePassword: null,
                                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                                updatedAt: admin.firestore.FieldValue.serverTimestamp()
                            });
                        } else {
                            await userRef.update({
                                email: userData.email,
                                name: userData.name,
                                phone: userData.phone,
                                affiliation: userData.affiliation,
                                organization: userData.affiliation,
                                updatedAt: admin.firestore.FieldValue.serverTimestamp()
                            });
                        }

                        await db.collection('users').doc(userData.userId).collection('participations').doc(regId).set({
                            conferenceId: confId,
                            conferenceName: '', 
                            registrationId: regId,
                            societyId: societyId || 'unknown',
                            role: 'ATTENDEE',
                            registeredAt: admin.firestore.FieldValue.serverTimestamp(),
                            paidAt: admin.firestore.FieldValue.serverTimestamp(),
                            amount: 0,
                            status: 'PAID'
                        }, { merge: true });
                    }
                } catch (postProcessError) {
                    functions.logger.error("Failed to post-process for Free Registration:", postProcessError);
                }

                res.status(200).json({ success: true, data: { status: 'DONE', method: 'FREE' } });

            } catch (error: unknown) {
                functions.logger.error("Error in processFreeRegistrationHttp:", error);
                const errorMessage = error instanceof Error ? error.message : 'Registration failed';
                res.status(500).json({ error: errorMessage });
            }
        });
    });

// 4. Cancel TossPayment
export const cancelTossPayment = functions
    .runWith({
        enforceAppCheck: false,
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onCall(async (data, context) => {
        // Auth Check (Admin Only recommended, strictly speaking, but for now Check Context)
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
        }

        const { paymentKey, cancelReason, confId, regId } = data;

        if (!paymentKey || !cancelReason || !confId) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing paymentKey, cancelReason, or confId');
        }

        try {
            // [Secure Key Fetch]
            const db = admin.firestore();
            const confSnap = await db.collection('conferences').doc(confId).get();
            const societyId = confSnap.data()?.societyId;

            let finalSecretKey = '';

            if (societyId) {
                const infraSnap = await db.collection('societies').doc(societyId).collection('settings').doc('infrastructure').get();
                if (infraSnap.exists) {
                    const infraData = infraSnap.data();
                    if (infraData?.payment?.domestic?.secretKey) {
                        finalSecretKey = infraData.payment.domestic.secretKey;
                    }
                }
            }

            if (!finalSecretKey) {
                throw new functions.https.HttpsError('failed-precondition', 'Payment Secret Key configuration missing.');
            }

            // 1. Call Toss API
            // Imported from ./payment/toss.ts (need to update import if not already done)
            const cancelResult = await cancelTossPaymentApi(paymentKey, cancelReason, finalSecretKey) as unknown;
            const result = cancelResult as { status?: string; totalAmount?: number;[key: string]: unknown };

            // 2. Update DB Status (Cancel)
            if (regId && (result.status === 'CANCELED' || result.status === 'PARTIAL_CANCELED')) {
                const regRef = db.collection(`conferences/${confId}/registrations`).doc(regId);
                const regSnap = await regRef.get();
                const regData = regSnap.data();
                const userId = regData?.userId;

                await regRef.update({
                    status: 'CANCELED',
                    paymentStatus: 'CANCELED',
                    canceledAt: admin.firestore.FieldValue.serverTimestamp(),
                    cancelReason: cancelReason
                });

                // Update Participation if userId exists
                if (userId && userId !== 'GUEST') {
                    try {
                        const participationRef = db.collection('users').doc(userId).collection('participations').doc(regId);
                        await participationRef.update({
                            status: 'CANCELED',
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                        functions.logger.info(`[Participation Updated] Registration ${regId} canceled for user ${userId}`);
                    } catch (pError) {
                        functions.logger.error("Failed to update participation status:", pError);
                    }
                }

                // Add Log
                await regRef.collection('logs').add({
                    type: 'PAYMENT_CANCELED',
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    method: 'ADMIN_MANUAL_PG',
                    reason: cancelReason,
                    amount: result.totalAmount // Optional: Check actual result structure
                });
            }

            return { success: true, data: cancelResult };

        } catch (error: unknown) {
            functions.logger.error("Error in cancelTossPayment:", error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'; throw new functions.https.HttpsError('internal', errorMessage);
        }
    });


// 6. Get NHN Cloud AlimTalk Templates
import { getTemplates } from './utils/nhnAlimTalk';

export const getNhnAlimTalkTemplates = functions
    .runWith({
        enforceAppCheck: false,
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
        }

        const { senderKey, societyId } = data;

        if (!senderKey || !societyId) {
            throw new functions.https.HttpsError('invalid-argument', 'senderKey and societyId are required');
        }

        try {
            // NHN Cloud ??ㅻ쾹?????깆젧 (嶺뚮ㅄ維獄????깅뤂 ???됰뎄)
            const appKey = 'Ik6GEBC22p5Qliqk';
            const secretKey = 'ajFUrusk8I7tgBQdrztuQvcf6jgWWcme';

            // senderKey??Firestore??????브퀗???(???깅뤂????⑤챷逾?
            const db = admin.firestore();
            const infraSnap = await db
                .collection('societies')
                .doc(societyId)
                .collection('settings')
                .doc('infrastructure')
                .get();

            if (!infraSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'Infrastructure settings not found for this society');
            }

            const infraData = infraSnap.data();
            const nhnConfig = infraData?.notification?.nhnAlimTalk;
            const firestoreSenderKey = nhnConfig?.senderKey;

            // senderKey????貫?????逾ф쾬?롮구?????裕?Firestore ???깆젧 ????
            const finalSenderKey = senderKey || firestoreSenderKey;

            if (!finalSenderKey) {
                throw new functions.https.HttpsError('failed-precondition', 'NHN Cloud senderKey not configured. Please configure in Admin > Infrastructure settings.');
            }

            const result = await getTemplates(
                { appKey, secretKey },
                finalSenderKey
            );

            // Filter only APPROVED templates
            if (result.success && result.data?.templateListResponse?.templates) {
                const approvedTemplates = result.data.templateListResponse.templates.filter(
                    (template: unknown) => (template as { templateStatus?: string }).templateStatus === 'APR'
                );

                functions.logger.info(`[NHN Templates] Total: ${result.data.templateListResponse.templates.length}, Approved: ${approvedTemplates.length}`);

                return {
                    success: true,
                    data: {
                        ...result.data,
                        templateListResponse: {
                            ...result.data.templateListResponse,
                            templates: approvedTemplates
                        }
                    }
                };
            }

            return result;
        } catch (error: unknown) {
            functions.logger.error("Error in getNhnAlimTalkTemplates:", error);
            if (error instanceof functions.https.HttpsError) {
                throw error;
            }
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            throw new functions.https.HttpsError('internal', errorMessage);
        }
    });

// --------------------------------------------------------------------------
// CREATE / LINK ADMIN
// --------------------------------------------------------------------------
export const createSocietyAdminUser = functions
    .runWith({
        enforceAppCheck: false, // Disable AppCheck for debugging
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onCall(async (data, context) => {
        // 0. ENTRY LOG
        functions.logger.info(">>> FUNCTION HIT: createSocietyAdminUser", { structuredData: true });

        // 1. Guard: Check if requester is Authenticated
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
        }

        // Log the incoming data for debugging
        functions.logger.info("createSocietyAdminUser called by:", context.auth.uid, "with data:", data);

        const { email, password, name, societyId, forceLink } = data;

        // 2. Validation
        if (!email || !societyId) {
            functions.logger.error("Missing required fields:", { email, societyId });
            throw new functions.https.HttpsError('invalid-argument', 'Missing fields: email and societyId are required.');
        }

        // If creating new, password is required. If linking, maybe not.
        // But for simplicity, let's enforce password only if we are creating.

        let warning: string | null = null;
        let userRecord: admin.auth.UserRecord | undefined;

        try {
            // 3. Check if user exists
            try {
                userRecord = await admin.auth().getUserByEmail(email);
                functions.logger.info("User already exists:", email);

                // If user exists AND we didn't explicitly ask to link, FAIL.
                if (!forceLink) {
                    return {
                        success: false,
                        code: 'auth/email-already-exists',
                        message: 'User with this email already exists. Do you want to link them?',
                        existingUser: { email: userRecord.email, name: userRecord.displayName }
                    };
                }

            } catch (e: unknown) {
                if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === 'auth/user-not-found') {
                    // User does not exist -> Create
                    if (!password) {
                        throw new functions.https.HttpsError('invalid-argument', 'Password is required for new users.');
                    }
                    functions.logger.info("Creating new user:", email);
                    userRecord = await admin.auth().createUser({
                        email,
                        password,
                        displayName: name || 'Admin',
                    });
                } else {
                    functions.logger.error("Error fetching user:", e);
                    throw e;
                }
            }

            // 4. Set Custom Claims (Soft Fail)
            try {
                functions.logger.info("Setting custom claims for:", userRecord.uid);
                // Merge existing claims if any? For now, overwrite/add.
                const currentClaims = userRecord.customClaims || {};
                await admin.auth().setCustomUserClaims(userRecord.uid, { ...currentClaims, role: 'CONF_ADMIN', societyId });
            } catch (claimError: unknown) {
                const claimErrorMessage = claimError instanceof Error ? claimError.message : String(claimError);
                functions.logger.error("Claim Error (IAM/Permission Issue?):", claimErrorMessage);
                warning = `User created/linked, but custom claims failed: ${claimErrorMessage}`;
            }

            // 5. Update Firestore
            functions.logger.info("Updating society document:", societyId);
            await admin.firestore().doc(`societies/${societyId}/private/admin`).set({
                adminEmails: admin.firestore.FieldValue.arrayUnion(email)
            }, { merge: true });

            return { success: true, uid: userRecord.uid, warning };

        } catch (error: unknown) {
            functions.logger.error("Error in createSocietyAdminUser:", error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            throw new functions.https.HttpsError('internal', `Failed to create/link admin: ${errorMessage}`, error);
        }
    });

// --------------------------------------------------------------------------
// REMOVE ADMIN
// --------------------------------------------------------------------------
export const removeSocietyAdminUser = functions
    .runWith({
        enforceAppCheck: false,
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onCall(async (data, context) => {
        functions.logger.info(">>> FUNCTION HIT: removeSocietyAdminUser", { structuredData: true });

        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
        }

        const { email, societyId } = data;
        if (!email || !societyId) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing email or societyId');
        }

        try {
            // 1. Remove from Firestore
            await admin.firestore().doc(`societies/${societyId}/private/admin`).set({
                adminEmails: admin.firestore.FieldValue.arrayRemove(email)
            }, { merge: true });

            // 2. Try to remove claims (Optional but good practice)
            try {
                const userRecord = await admin.auth().getUserByEmail(email);
                // We should be careful not to wipe other claims if they belong to other societies?
                // But currently the system seems designed for 1 society per user or simple claims.
                // Let's just remove the role/societyId if they match.
                const currentClaims = userRecord.customClaims || {};
                if (currentClaims.societyId === societyId) {
                    await admin.auth().setCustomUserClaims(userRecord.uid, { ...currentClaims, role: null, societyId: null });
                }
            } catch (e) {
                functions.logger.warn("Could not remove claims (User might be deleted or IAM issue):", e);
            }

            return { success: true };
        } catch (error: unknown) {
            functions.logger.error("Error in removeSocietyAdminUser:", error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'; throw new functions.https.HttpsError('internal', errorMessage);
        }
    });

// --------------------------------------------------------------------------
// AUTH: SMS Verification (AlimTalk Placeholder)
// --------------------------------------------------------------------------
export const sendAuthCode = functions
    .runWith({
        enforceAppCheck: false,
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onCall(async (data, _context) => {
        const { phone, code } = data;

        if (!phone || !code) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing phone number or code');
        }

        // In a real implementation, this would call an SMS/AlimTalk provider API (e.g., Twilio, Solapi)
        // For now, we just log it as requested.
        functions.logger.info(`[SMS MOCK] Sending AlimTalk to ${phone}: [e-Regi] ?띠럾????곷데嶺뚯빘鍮뽬떋?????낅퉵?? #${code}`);

        return { success: true, message: "Code sent successfully (MOCK)" };
    });

// --------------------------------------------------------------------------
// [RESTORED] MEMBER VERIFICATION & EMAIL CHECK
// --------------------------------------------------------------------------

export const verifyMemberIdentity = functions
    .runWith({
        enforceAppCheck: false,
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onCall(async (data, context) => {
        const { societyId, name, code, lockNow } = data;

        if (!societyId || !name || !code) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing required fields (societyId, name, code)');
        }

        try {
            // Search in society's members collection
            // Path: societies/{societyId}/members/{memberId}
            const membersRef = admin.firestore().collection('societies').doc(societyId).collection('members');

            // Strategy: Check Name + (LicenseNumber OR Code)
            // [FIX] Handle 2-character names with space (e.g., "濚밸쮦? ?? vs "濚밸쮦???)
            const checkMember = async (queryName: string, queryCode: string) => {
                // 1. Try License Number
                let q = membersRef.where('name', '==', queryName).where('licenseNumber', '==', queryCode);
                let snap = await q.get();

                if (snap.empty) {
                    // 2. Try Code field
                    q = membersRef.where('name', '==', queryName).where('code', '==', queryCode);
                    snap = await q.get();
                }
                return snap;
            };

            // 1. Try Exact Match
            let snap = await checkMember(name, code);

            // 2. Try variations for 2-character names (common in legacy DBs)
            if (snap.empty) {
                const trimmedName = name.replace(/\s+/g, '');

                // Case A: User entered "濚밸쮦???, DB has "濚밸쮦? ??
                if (trimmedName.length === 2) {
                    const spacedName = `${trimmedName[0]} ${trimmedName[1]}`;
                    if (spacedName !== name) {
                        snap = await checkMember(spacedName, code);
                    }
                }

                // Case B: User entered "濚밸쮦? ??, DB has "濚밸쮦???
                if (snap.empty && name !== trimmedName) {
                    snap = await checkMember(trimmedName, code);
                }
            }

            if (!snap.empty) {
                const memberDoc = snap.docs[0];
                const member = memberDoc.data();

                // [Security] Used Check - One-Time Use Only
                // Once a code is used, it cannot be reused by anyone
                if (member.used === true) {
                    return { success: false, message: "Code Already Used" };
                }

                // [Security] Expiry Check - Return isExpired flag instead of failing
                // Expired members should be able to verify, but register at non-member price
                let isExpired = false;
                if (member.expiryDate) {
                    let exp = member.expiryDate;
                    // Handle Firestore Timestamp or Date string
                    if (typeof exp === 'object' && exp !== null && 'toDate' in exp && typeof exp.toDate === 'function') {
                        exp = exp.toDate();
                    } else if (typeof exp === 'string') {
                        exp = new Date(exp);
                    }

                    isExpired = new Date() > exp;
                }

                // [Security] Immediate Lock (for MyPage)
                if (lockNow === true && context.auth?.uid) {
                    await memberDoc.ref.update({
                        used: true,
                        usedBy: context.auth.uid,
                        usedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }

                const finalExpiry = member.expiryDate || member.expiry || null;

                // [FIX-DISCOUNT] Generate normalized price key for frontend matching
                const serverGrade = member.grade || member.category || 'Member';
                const priceKey = String(serverGrade)
                    .toLowerCase()
                    .replace(/\s+/g, '_');

                return {
                    success: true,
                    grade: serverGrade,
                    isExpired: isExpired, // ??[FIX] 嶺뚮씭??쭩???? ????뗥윜??怨뺣뼺?
                    memberData: {
                        id: memberDoc.id, // [Critical] Return Doc ID for Locking
                        name: member.name,
                        grade: serverGrade,              // ??[FIX] ?繹먭퍗???筌먲퐢沅??怨뺣뼺?
                        priceKey: priceKey,              // ??[FIX] ?筌????븐뼔彛??띠럾??????怨뺣뼺?
                        licenseNumber: member.licenseNumber || member.code,
                        societyId: societyId, // Pass back for context
                        expiryDate: finalExpiry,
                        expiry: finalExpiry              // ?熬곣뫁夷?筌? 嶺뚢돦堉???熬곣뫀援??띠룆踰???낅슣???
                    }
                };
            }

            return { success: false, message: "Member not found. Please check your name and license number." };

        } catch (e: unknown) {
            functions.logger.error("Verify Member Error:", e);
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred'; throw new functions.https.HttpsError('internal', errorMessage);
        }
    });

export const checkEmailExists = functions
    .runWith({
        enforceAppCheck: false,
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onCall(async (data, _context) => {
        const { email } = data;
        if (!email) return { exists: false };

        try {
            // 1. Check Auth
            try {
                await admin.auth().getUserByEmail(email);
                return { exists: true };
            } catch (authErr: unknown) {
                if (typeof authErr === 'object' && authErr !== null && 'code' in authErr && (authErr as { code: string }).code === 'auth/user-not-found') {
                    // 2. Check Firestore 'users' collection (Fallback)
                    const userSnap = await admin.firestore().collection('users').where('email', '==', email).limit(1).get();
                    return { exists: !userSnap.empty };
                }
                throw authErr;
            }
        } catch (e: unknown) {
            functions.logger.error("Email Check Error:", e);
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
            throw new functions.https.HttpsError('internal', errorMessage);
        }
    });

// --------------------------------------------------------------------------
// SUPER ADMIN: NUCLEAR DELETE (Auth + DB)
// --------------------------------------------------------------------------
export const deleteUserAccount = functions
    .runWith({
        enforceAppCheck: false,
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onCall(async (data, context) => {
        // 1. Security Check
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be logged in.');
        }

        // Check for Super Admin Claim or specific email (fallback)
        const isSuper = context.auth.token.super === true || context.auth.token.email === 'admin@eregi.com' || context.auth.token.email === 'super@eregi.com';

        const { uid } = data;
        if (!uid) {
            throw new functions.https.HttpsError('invalid-argument', 'UID is required');
        }

        functions.logger.warn(`[NUCLEAR DELETE] Initiated by ${context.auth.uid} (Super: ${isSuper}) for target ${uid}`);

        // 2. Auth Delete (Try-Catch for Robustness)
        try {
            await admin.auth().deleteUser(uid);
            functions.logger.info(`Auth user ${uid} deleted.`);
        } catch (error: unknown) {
            if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'auth/user-not-found') {
                functions.logger.warn(`Auth user ${uid} already missing. Skipping.`);
            } else {
                const errorMessage = error instanceof Error ? error.message : String(error);
                functions.logger.error(`Auth delete error: ${errorMessage}`);
                // Proceed to DB delete even if Auth delete fails
            }
        }

        // 3. Firestore DB Delete (Try-Catch)
        try {
            await admin.firestore().collection('users').doc(uid).delete();
            functions.logger.info(`Firestore doc ${uid} deleted.`);
        } catch (error: unknown) {
            functions.logger.error(`Firestore delete error: ${error}`);
            // Don't throw, just log. We want to return success to client to clear the list.
        }

        // 4. Always return success
        return { success: true };
    });

// --------------------------------------------------------------------------
// AUTH: Cross-Domain Token Minting (CORS Enabled - Nuclear Option)
// --------------------------------------------------------------------------

// [Step 512-D] In-memory Cache for CORS
let cachedAllowedOrigins: string[] = [];
let lastCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const getAllowedDomains = async (): Promise<string[]> => {
    // 1. Check Cache
    if (Date.now() - lastCacheTime < CACHE_DURATION && cachedAllowedOrigins.length > 0) {
        return cachedAllowedOrigins;
    }

    // 2. Fetch from DB
    try {
        const settingsRef = admin.firestore().doc('globalSettings/security');
        const settingsSnap = await settingsRef.get();

        if (settingsSnap.exists) {
            cachedAllowedOrigins = settingsSnap.data()?.allowedOrigins || [];
        } else {
            // Fallback / Auto-Seed
            cachedAllowedOrigins = ['*'];
            await settingsRef.set({ allowedOrigins: cachedAllowedOrigins }, { merge: true });
            functions.logger.warn("[Security] 'globalSettings/security' missing. Created default with ['*'].");
        }

        // [Step 512-D] Explicitly ensure Root Domain is allowed
        if (!cachedAllowedOrigins.includes('https://eregi.co.kr')) {
            cachedAllowedOrigins.push('https://eregi.co.kr');
        }

        lastCacheTime = Date.now();
        return cachedAllowedOrigins;
    } catch (e) {
        functions.logger.error("Failed to fetch allowed origins:", e);
        return ['*']; // Fail open or closed depending on policy. Here failing open for reliability.
    }
};

export const mintCrossDomainToken = functions
    .runWith({ ingressSettings: 'ALLOW_ALL' })
    .https.onCall(async (data, context) => {
        try {
            // 0. [Security Engine] CORS Policy Check
            const origin = context.rawRequest.headers.origin;

            // [Step 512-D] Use Cached Domain List
            const allowedOrigins = await getAllowedDomains();

            // Allow if '*' is present OR origin is in the list
            const isAllowed = allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin));

            if (!isAllowed) {
                functions.logger.warn(`[CORS Block] Origin ${origin} not in allowed list.`);
                throw new functions.https.HttpsError('permission-denied', 'CORS Policy: Origin not allowed');
            }

            // 1. ??ル쪇????롪틵????띠룆踰??(Hybrid: Context Auth OR ID Token Payload)
            let uid: string;

            if (context.auth) {
                // Case A: SDK already authenticated (e.g. refresh)
                uid = context.auth.uid;
            } else if (data.idToken) {
                // Case B: Hydration from Cookie (ID Token -> Custom Token)
                try {
                    const decodedToken = await admin.auth().verifyIdToken(data.idToken);
                    uid = decodedToken.uid;
                    functions.logger.info(`[Hydration] Verified ID Token for UID: ${uid}`);
                } catch (verifyErr: unknown) {
                    const verifyErrorMessage = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
                    functions.logger.warn(`[Hydration] Invalid ID Token:`, verifyErrorMessage);
                    throw new functions.https.HttpsError('unauthenticated', 'Invalid ID Token');
                }
            } else {
                throw new functions.https.HttpsError('unauthenticated', '?筌뤾쑴理??筌먲퐢沅뽪뤆?쎛 ??怨룸????덈펲.');
            }

            const customToken = await admin.auth().createCustomToken(uid, {
                crossDomain: true,
                mintedAt: Date.now()
            });

            functions.logger.info(`[Mint Success] Custom token created for UID: ${uid}`);
            return { token: customToken };
        } catch (error: unknown) {
            functions.logger.error("Mint Cross Domain Token Error:", error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            throw new functions.https.HttpsError('internal', errorMessage);
        }
    });

// --------------------------------------------------------------------------
// SECURITY: Admin Link Verification (HMAC + TTL)
// --------------------------------------------------------------------------
import * as crypto from 'crypto';

const LINK_SECRET = process.env.LINK_SECRET || 'eregi_v2_secure_link_key_2026';

export const verifyAccessLink = functions
    .runWith({ enforceAppCheck: false, ingressSettings: 'ALLOW_ALL' })
    .https.onCall(async (data, _context) => {
        const { token } = data;
        if (!token) throw new functions.https.HttpsError('invalid-argument', 'Token required');

        try {
            // Token format: payloadBase64.signature
            const parts = token.split('.');
            if (parts.length !== 2) throw new Error('Invalid token format');

            const [payloadB64, signature] = parts;

            // 1. Verify Signature
            const expectedSig = crypto.createHmac('sha256', LINK_SECRET).update(payloadB64).digest('hex');

            // Constant time comparison to prevent timing attacks (optional but good)
            if (expectedSig !== signature) {
                throw new Error('Invalid signature');
            }

            // 2. Decode Payload
            const payloadJson = Buffer.from(payloadB64, 'base64').toString();
            const payload = JSON.parse(payloadJson);

            // 3. Check Expiry
            if (payload.exp && Date.now() > payload.exp) {
                throw new Error('Token expired');
            }

            return { valid: true, payload };
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            functions.logger.warn(`[Security] Token Verification Failed: ${errorMessage}`);
            throw new functions.https.HttpsError('permission-denied', 'Invalid or expired token');
        }
    });

export const generateAccessLink = functions
    .runWith({ enforceAppCheck: false, ingressSettings: 'ALLOW_ALL' })
    .https.onCall(async (data, context) => {
        // [Security] Only authenticated users (Admins) can generate links
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required to generate links');
        }

        const { cid, role = 'OPERATOR', expiresIn = 3600 } = data; // Default 1 hour

        const payload = {
            cid,
            role,
            exp: Date.now() + (expiresIn * 1000),
            iat: Date.now(),
            generatedBy: context.auth.uid
        };

        const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64');
        const signature = crypto.createHmac('sha256', LINK_SECRET).update(payloadB64).digest('hex');
        const token = `${payloadB64}.${signature}`;

        return { token };
    });

// --------------------------------------------------------------------------
// GUEST REGISTRATION: Email & Password Management
// --------------------------------------------------------------------------

// Check if email exists in registrations (for non-members)
export const checkNonMemberEmailExists = functions
    .runWith({
        enforceAppCheck: false,
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onCall(async (data, _context) => {
        const { email, confId } = data;
        if (!email || !confId) {
            throw new functions.https.HttpsError('invalid-argument', 'email and confId are required');
        }

        try {
            // Check registrations collection
            const regRef = admin.firestore().collection(`conferences/${confId}/registrations`);
            const q = regRef.where('email', '==', email).limit(1);
            const snap = await q.get();

            if (!snap.empty) {
                const regData = snap.docs[0].data();
                return {
                    exists: true,
                    isCompleted: regData.paymentStatus === 'PAID',
                    hasPassword: !!regData.password,
                    registrationId: snap.docs[0].id
                };
            }

            return { exists: false };
        } catch (e: unknown) {
            functions.logger.error("Non-Member Email Check Error:", e);
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred'; throw new functions.https.HttpsError('internal', errorMessage);
        }
    });



// --------------------------------------------------------------------------
// MONITORING: Error Logging & Performance Tracking
// --------------------------------------------------------------------------

// Import email utilities
import { sendErrorAlertEmail } from './utils/email';

/**
 * Sampling Configuration for Monitoring
 * Adjust these values to control monitoring cost and performance
 */
const SAMPLING_RATE = Number(process.env.MONITORING_SAMPLING_RATE) || 0.1; // 10% default
const MAX_DAILY_WRITES = Number(process.env.MONITORING_MAX_DAILY_WRITES) || 10000; // Safety limit

/**
 * Check if monitoring should run based on sampling rate
 */
function shouldMonitor(): boolean {
    return Math.random() < SAMPLING_RATE;
}

/**
 * Check if daily write limit has been reached
 */
async function checkDailyWriteLimit(db: admin.firestore.Firestore, date: string): Promise<boolean> {
    const statsRef = db.doc(`logs/stats/${date}`);
    const statsDoc = await statsRef.get();

    if (!statsDoc.exists) {
        await statsRef.set({ writeCount: 1, lastUpdated: admin.firestore.Timestamp.now() });
        return false;
    }

    const data = statsDoc.data();
    if (data && data.writeCount >= MAX_DAILY_WRITES) {
        functions.logger.warn(`Daily write limit reached: ${data.writeCount}`);
        return true;
    }

    if (data) {
        await statsRef.update({ writeCount: data.writeCount + 1, lastUpdated: admin.firestore.Timestamp.now() });
    }
    return false;
}

/**
 * Log Error
 *
 * Logs client-side errors to Firestore for monitoring
 * Includes deduplication and automatic alerting for critical errors
 */
export const logError = functions
    .runWith({
        enforceAppCheck: false,
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onCall(async (data, _context) => {
        const { errorId, errorData } = data;

        if (!errorId || !errorData) {
            throw new functions.https.HttpsError('invalid-argument', 'errorId and errorData are required');
        }

        try {
            // Apply sampling
            if (!shouldMonitor()) {
                functions.logger.log(`[Sampling] Skipping error logging: ${errorId}`);
                return { success: true, sampled: true };
            }

            const db = admin.firestore();
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

            // Check daily write limit
            const limitReached = await checkDailyWriteLimit(db, today);
            if (limitReached) {
                functions.logger.warn(`[Limit] Daily write limit reached, skipping error logging`);
                return { success: true, limited: true };
            }

            const errorRef = db.doc(`logs/errors/${today}/${errorId}`);
            const errorDoc = await errorRef.get();

            const now = admin.firestore.Timestamp.now();
            const isFirstOccurrence = !errorDoc.exists;

            if (isFirstOccurrence) {
                // New error - create log entry
                await errorRef.set({
                    id: errorId,
                    timestamp: now,
                    firstSeenAt: now,
                    lastSeenAt: now,
                    occurrenceCount: 1,
                    resolved: false,
                    alertSent: false,
                    ...errorData
                });

                // Send alert for critical/high severity errors
                if (errorData.severity === 'CRITICAL' || errorData.severity === 'HIGH') {
                    try {
                        await sendErrorAlertEmail({
                            errorId,
                            message: errorData.message,
                            severity: errorData.severity,
                            category: errorData.category,
                            occurrenceCount: 1,
                            url: errorData.url,
                            userId: errorData.userId,
                        });
                        await errorRef.update({ alertSent: true });
                        functions.logger.log(`[Alert] Critical error detected: ${errorId}`);
                    } catch (emailError: unknown) {
                        const emailErrorMessage = emailError instanceof Error ? emailError.message : String(emailError);
                        functions.logger.error('[logError] Failed to send email alert:', emailErrorMessage);
                    }
                }
            } else {
                // Existing error - increment count
                const currentData = errorDoc.data();
                if (currentData) {
                    await errorRef.update({
                        lastSeenAt: now,
                        occurrenceCount: currentData.occurrenceCount + 1,
                    });
                }
            }

            return {
                success: true,
                errorId,
                isFirstOccurrence
            };
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
            functions.logger.error("[logError] Error logging failed:", errorMessage);
            throw new functions.https.HttpsError('internal', errorMessage);
        }
    });

/**
 * Log Performance
 *
 * Logs performance metrics to Firestore
 * Used for Web Vitals, API response times, page load times
 */
export const logPerformance = functions
    .runWith({
        enforceAppCheck: false,
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onCall(async (data, _context) => {
        const { metricName, value, unit = 'ms', threshold, context: metricContext } = data;

        if (!metricName || value === undefined) {
            throw new functions.https.HttpsError('invalid-argument', 'metricName and value are required');
        }

        try {
            // Apply sampling (performance is less critical, sample more aggressively)
            if (Math.random() > (SAMPLING_RATE * 0.5)) {
                return { success: true, sampled: true };
            }

            const db = admin.firestore();
            const today = new Date().toISOString().split('T')[0];

            // Check daily write limit
            const limitReached = await checkDailyWriteLimit(db, today);
            if (limitReached) {
                return { success: true, limited: true };
            }

            const metricId = `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const metricRef = db.doc(`logs/performance/${today}/${metricId}`);

            const isPoor = threshold && value > threshold;

            await metricRef.set({
                id: metricId,
                timestamp: admin.firestore.Timestamp.now(),
                metricName,
                value,
                unit,
                threshold,
                isPoor,
                ...metricContext
            });

            return {
                success: true,
                metricId,
                isPoor
            };
        } catch (e: unknown) {
            functions.logger.error("[logPerformance] Performance logging failed:", e);
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred'; throw new functions.https.HttpsError('internal', errorMessage);
        }
    });

/**
 * --------------------------------------------------------------------------
 * TOSS PAYMENTS WEBHOOK
 * --------------------------------------------------------------------------
 * Handles asynchronous payment notifications:
 * - Virtual Account Deposit Confirmation (WAITING_FOR_DEPOSIT -> DONE)
 * - Payment Cancellation (CANCELED)
 */
export const onTossWebhook = functions
    .runWith({
        enforceAppCheck: false,
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onRequest(async (req, res) => {
        // Log webhook payload
        functions.logger.info(">>> [Toss Webhook] Received:", req.body);

        try {
            let status = req.body.status;
            let orderId = req.body.orderId;
            let virtualAccount = req.body.virtualAccount;
            const eventType = req.body.eventType;

            // Handle new Toss Payments webhook format (PAYMENT_STATUS_CHANGED, etc)
            if (eventType && req.body.data) {
                status = req.body.data.status;
                orderId = req.body.data.orderId;
                virtualAccount = req.body.data.virtualAccount || virtualAccount;
            }

            if (!status || !orderId) {
                functions.logger.warn("[Toss Webhook] Missing status or orderId", { body: req.body });
                res.status(400).json({ message: "Missing required fields" });
                return;
            }

            const db = admin.firestore();

            // Find Registration Document by orderId
            // [FIX-20260310] Use iterative search across conferences to avoid FAILED_PRECONDITION (missing collection group index)
            functions.logger.info(`[Toss Webhook] Searching for orderId: ${orderId} in all conferences...`);
            let regDoc: admin.firestore.QueryDocumentSnapshot | null = null;

            // 1. Get List of all conferences
            const conferencesSnap = await db.collection('conferences').get();

            // 2. Iterate through each conference to find the matching registration
            for (const confDoc of conferencesSnap.docs) {
                const q = await confDoc.ref.collection('registrations')
                    .where('orderId', '==', orderId)
                    .limit(1)
                    .get();

                if (!q.empty) {
                    regDoc = q.docs[0];
                    break;
                }
            }

            if (!regDoc) {
                functions.logger.warn(`[Toss Webhook] Registration not found for orderId: ${orderId} after searching all conferences.`);
                // Return 200 to acknowledge webhook (prevent retry loop) even if not found
                res.status(200).json({ message: "Registration not found" });
                return;
            }
            const regData = regDoc.data();
            const regRef = regDoc.ref;
            const confId = regData.conferenceId;
            const userId = regData.userId; // e.g. 'GUEST' or uid

            functions.logger.info(`[Toss Webhook] Processing ${status} for Registration ${regRef.path}`);

            if (status === 'DONE') {
                // Payment Completed (Deposit Confirmed)
                if (regData.status === 'PAID') {
                    // Already Paid - Idempotent
                    functions.logger.info("[Toss Webhook] Already PAID. Skipping.");
                    res.status(200).json({ message: "Already processed" });
                    return;
                }

                const now = admin.firestore.Timestamp.now();

                // 1. Update Registration Status
                await regRef.update({
                    status: 'PAID',
                    paymentStatus: 'PAID',
                    paidAt: now,
                    updatedAt: now,
                    virtualAccount: virtualAccount || regData.virtualAccount || null
                });

                // 2. Lock Membership Code (if applicable)
                try {
                    // Need societyId from conference
                    const confSnap = await db.collection('conferences').doc(confId).get();
                    const conference = confSnap.data();
                    const societyId = conference?.societyId;

                    if (societyId && regData.memberVerificationData?.id) {
                        const memberId = regData.memberVerificationData.id;
                        await db.collection('societies').doc(societyId).collection('members').doc(memberId).update({
                            used: true,
                            usedBy: userId || 'unknown',
                            usedAt: now
                        });
                        functions.logger.info(`[Toss Webhook] Member Locked: ${memberId}`);
                    }

                    // 3. Update User Document & History (if not guest)
                    if (userId && userId !== 'GUEST') {
                        // User Document (Create/Update) logic simplified here
                        // Assuming user doc exists or was created during registration attempt.
                        // Here we just ensure participation record is updated to COMPLETED.

                        await db.collection('users').doc(userId).collection('participations').doc(regDoc.id).set({
                            conferenceId: confId,
                            conferenceName: '', // Optional
                            registrationId: regDoc.id,
                            societyId: societyId || 'unknown',
                            role: 'ATTENDEE',
                            registeredAt: regData.createdAt || now,
                            paidAt: now,
                            amount: regData.amount,
                            status: 'COMPLETED'
                        }, { merge: true });
                        functions.logger.info(`[Toss Webhook] User History Logged: ${userId}`);
                    }

                    // 4. Generate Badge Prep Token & Send AlimTalk
                    // Invoke badge logic manually since onCreate won't trigger for updates or was skipped for PENDING
                    try {
                        let token = regData.badgePrepToken; // Check legacy

                        // Check badge_tokens collection first
                        if (!token) {
                            const tokenQuery = await db.collection(`conferences/${confId}/badge_tokens`)
                                .where('registrationId', '==', regDoc.id)
                                .where('status', '==', 'ACTIVE')
                                .limit(1)
                                .get();

                            if (!tokenQuery.empty) {
                                token = tokenQuery.docs[0].id;
                            }
                        }

                        if (!token) {
                            // Generate New Token
                            const newToken = generateBadgePrepToken();

                            // Expiry Logic
                            let expiresAt: admin.firestore.Timestamp;
                            if (conference?.dates?.end) {
                                expiresAt = admin.firestore.Timestamp.fromMillis(
                                    conference.dates.end.toMillis() + (48 * 60 * 60 * 1000)
                                );
                            } else {
                                expiresAt = admin.firestore.Timestamp.fromMillis(
                                    now.toMillis() + (7 * 24 * 60 * 60 * 1000)
                                );
                            }

                            await db.collection(`conferences/${confId}/badge_tokens`).doc(newToken).set({
                                token: newToken,
                                registrationId: regDoc.id,
                                conferenceId: confId,
                                userId: userId || 'GUEST',
                                status: 'ACTIVE',
                                createdAt: now,
                                expiresAt
                            });

                            token = newToken;
                            functions.logger.info(`[Toss Webhook] Generated Badge Token: ${token}`);
                        }

                        // Send AlimTalk
                        // Re-fetch updated registration data to include payment info if needed
                        const updatedRegSnap = await regRef.get();
                        const updatedRegData = updatedRegSnap.data();

                        await sendBadgeNotification(db, { ...conference, id: confId } as BadgeConference, regDoc.id, updatedRegData as BadgeRegistration, token);
                        functions.logger.info("[Toss Webhook] AlimTalk Sent");

                    } catch (badgeError) {
                        functions.logger.error("[Toss Webhook] Badge/Notification Error:", badgeError);
                    }

                } catch (postProcessError) {
                    functions.logger.error("[Toss Webhook] Post-process Error:", postProcessError);
                }

                res.status(200).json({ success: true });

            } else if (status === 'CANCELED') {
                // Payment Canceled
                await regRef.update({
                    status: 'CANCELED',
                    paymentStatus: 'CANCELED',
                    canceledAt: admin.firestore.FieldValue.serverTimestamp(),
                    cancelReason: (req.body.data?.cancels?.[0]?.cancelReason || req.body.cancels?.[0]?.cancelReason || 'Webhook Cancellation')
                });

                // Add Log
                await regRef.collection('logs').add({
                    type: 'PAYMENT_CANCELED_WEBHOOK',
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    data: req.body
                });

                functions.logger.info(`[Toss Webhook] Registration ${regDoc.id} CANCELED`);
                res.status(200).json({ success: true });

            } else if (status === 'WAITING_FOR_DEPOSIT') {
                // Should have been handled by confirmTossPayment, but just in case
                // Update virtual account info if changed
                if (req.body.virtualAccount) {
                    await regRef.update({
                        virtualAccount: req.body.virtualAccount,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
                res.status(200).json({ success: true });
            } else if (status === 'EXPIRED') {
                // Virtual Account Payment Window Expired
                await regRef.update({
                    status: 'EXPIRED',
                    paymentStatus: 'CANCELED',
                    expiredAt: admin.firestore.FieldValue.serverTimestamp()
                });

                // Add Log
                await regRef.collection('logs').add({
                    type: 'PAYMENT_EXPIRED_WEBHOOK',
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    data: req.body
                });

                functions.logger.info(`[Toss Webhook] Registration ${regDoc.id} EXPIRED (Virtual Account)`);
                res.status(200).json({ success: true });
            } else {
                // Unknown status
                functions.logger.warn(`[Toss Webhook] Unknown status: ${status}`);
                res.status(200).json({ message: "Unknown status, ignored" });
            }

        } catch (error: unknown) {
            functions.logger.error("[Toss Webhook] Internal Error:", error);
            res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
        }
    });

// --------------------------------------------------------------------------
// HEALTH CHECK: System Status Endpoint (CORS Enabled)
// --------------------------------------------------------------------------
export const healthCheck = functions
    .runWith({
        enforceAppCheck: false,
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onRequest(async (req, res) => {
        // Handle CORS preflight
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }

        try {
            // Check Firestore connectivity
            const db = admin.firestore();
            await db.doc('system/health').get();

            const timestamp = new Date().toISOString();

            // Basic health check
            const healthStatus = {
                status: 'healthy',
                timestamp,
                version: '1.0.0',
                services: {
                    firestore: 'connected',
                    auth: 'available'
                }
            };

            functions.logger.info('[HealthCheck] System healthy');
            res.status(200).json(healthStatus);

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            functions.logger.error('[HealthCheck] System unhealthy:', errorMessage);

            res.status(503).json({
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: errorMessage
            });
        }
    });
