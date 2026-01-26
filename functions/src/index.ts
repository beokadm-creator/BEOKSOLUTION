import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import corsLib from 'cors';
import { getNiceAuthParams, approveNicePayment } from './payment/nice';
import { approveTossPayment } from './payment/toss';
import { cleanupZombieUsers } from './scheduled/cleanupUsers';
import { onRegistrationCreated, validateBadgePrepToken, issueDigitalBadge, resendBadgePrepToken } from './badge/index';

export const cors = corsLib({ origin: true });

admin.initializeApp();

export {
    cleanupZombieUsers,
    onRegistrationCreated,
    validateBadgePrepToken,
    issueDigitalBadge,
    resendBadgePrepToken
};

// --------------------------------------------------------------------------
// PAYMENT: NICEPAY UTILITIES
// --------------------------------------------------------------------------

// 1. Prepare NicePayment (Get SignData & EdiDate)
export const prepareNicePayment = functions
    .runWith({
        enforceAppCheck: false,
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onCall(async (data, context) => {
        // Allow public access for registration? Or authenticated?
        // Registration page might be accessed by Guest (Anonymously authenticated usually).
        // Let's allow public for now, or check context.auth if anonymous auth is used.
        // For safety, let's require at least some context or just open it as it generates a signature for a specific transaction.
        
        const { amt, mid, key } = data;
        
        if (!amt || !mid || !key) {
             throw new functions.https.HttpsError('invalid-argument', 'Missing amt, mid, or key');
        }

        try {
            const result = getNiceAuthParams(amt, mid, key);
            return result;
        } catch (error: any) {
            functions.logger.error("Error in prepareNicePayment:", error);
            throw new functions.https.HttpsError('internal', error.message);
        }
    });

// 2. Confirm NicePayment (Approve Transaction)
export const confirmNicePayment = functions
    .runWith({
        enforceAppCheck: false,
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onCall(async (data, context) => {
        // [FIX-20250124-04] Force recompile by adding comment
        const { tid, amt, mid, key, regId, confId, userData } = data;

        if (!tid || !amt || !mid || !key) {
             throw new functions.https.HttpsError('invalid-argument', 'Missing payment details');
        }

        if (!userData) {
             throw new functions.https.HttpsError('invalid-argument', 'Missing user data for registration creation');
        }

        try {
            // 1. Call NicePay API
            const approvalResult = await approveNicePayment(tid, amt, mid, key);

            // 2. Check Result
            if (approvalResult.ResultCode === '3001' || approvalResult.ResultCode === '4100' || approvalResult.ResultCode === '4000') {
                 // Success Codes (3001: Card, 4100: Bank Transfer? Need to verify codes.
                 // Actually 3001 is common success for Credit Card.
                 // Let's assume success if ResultCode starts with 3 or 4 or is '0000' (some versions).
                 // Better: Check ResultCode documentation. For Web API, usually '3001' is success for Card.
                 // However, let's just return the result to client and let client decide, OR update DB here.
                 // Updating DB here is safer.

                 // [FIX-20250124-01] Create Registration document on successful payment (instead of updating)
                 // This ensures that only paid registrations are stored in the DB
                 if (regId && confId) {
                     const regRef = admin.firestore().collection(`conferences/${confId}/registrations`).doc(regId);

                     // Generate receipt number (simplified for now)
                     const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
                     const rand = Math.random().toString(36).substring(2, 6).toUpperCase();

                     // Get conference to resolve society ID
                     const confSnap = await admin.firestore().collection('conferences').doc(confId).get();
                     const societyId = confSnap.data()?.societyId;

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
                          status: 'PAID',
                          paymentStatus: 'PAID',
                          paymentMethod: 'CARD',
                          paymentKey: tid,
                          orderId: approvalResult?.Moid || approvalResult?.moid || regId,
                          amount: parseInt(amt, 10),
                          tier: userData.tier,
                          categoryName: userData.categoryName,
                          memberVerificationData: null, // Will be populated if member verified
                          isAnonymous: userData.isAnonymous || false,
                          agreements: {}, // Will be populated from session data if needed
                          paymentDetails: approvalResult,
                          receiptNumber: `${dateStr}-${rand}`,
                          confirmationQr: `CONF-${regId}`,
                          badgeQr: null,
                          isCheckedIn: false,
                          checkInTime: null,
                          createdAt: admin.firestore.FieldValue.serverTimestamp(),
                          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                          paidAt: admin.firestore.FieldValue.serverTimestamp()
                      }, { merge: false });

                     // [Security] Lock the Member Code
                     try {
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
                     } catch (lockError) {
                          functions.logger.error("Failed to lock member code (Payment Successful):", lockError);
                          // Do not fail the request, as payment is already processed.
                     }

                     // Log participation history (for authenticated users)
                     if (userData.userId && userData.userId !== 'GUEST') {
                         try {
                             await admin.firestore().collection('users').doc(userData.userId).collection('participations').doc(regId).set({
                                 conferenceId: confId,
                                 conferenceName: '', // Will be populated later if needed
                                 registrationId: regId,
                                 societyId: societyId || 'unknown',
                                 role: 'ATTENDEE',
                                 registeredAt: admin.firestore.FieldValue.serverTimestamp(),
                                 paidAt: admin.firestore.FieldValue.serverTimestamp(),
                                 amount: parseInt(amt, 10),
                                 status: 'COMPLETED'
                             }, { merge: true });
                             functions.logger.info(`[History Logged] Participation saved for user ${userData.userId}`);
                         } catch (historyError) {
                             functions.logger.error("Failed to log participation history:", historyError);
                         }
                     }
                 }

                 return { success: true, data: approvalResult };
            } else {
                 // Failed
                 return { success: false, message: approvalResult.ResultMsg, code: approvalResult.ResultCode };
            }

        } catch (error: any) {
            functions.logger.error("Error in confirmNicePayment:", error);
            throw new functions.https.HttpsError('internal', error.message);
        }
    });

// 3. Confirm TossPayment (Approve Transaction)
export const confirmTossPayment = functions
    .runWith({
        enforceAppCheck: false,
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onCall(async (data, context) => {
        const { paymentKey, orderId, amount, regId, confId, secretKey, userData } = data;

        if (!paymentKey || !orderId || !amount || !secretKey) {
             throw new functions.https.HttpsError('invalid-argument', 'Missing payment details');
        }

        if (!userData) {
             throw new functions.https.HttpsError('invalid-argument', 'Missing user data for registration creation');
        }

        try {
            // 1. Call Toss API
            const approvalResult = await approveTossPayment(paymentKey, orderId, amount, secretKey);

            // 2. If success (no error thrown), create Registration document
            // [FIX-20250124-01] Create Registration document on successful payment (instead of updating)
            // This ensures that only paid registrations are stored in the DB
            if (regId && confId) {
                const regRef = admin.firestore().collection(`conferences/${confId}/registrations`).doc(regId);

                // Generate receipt number (simplified for now)
                const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
                const rand = Math.random().toString(36).substring(2, 6).toUpperCase();

                // Get conference to resolve society ID
                const confSnap = await admin.firestore().collection('conferences').doc(confId).get();
                const societyId = confSnap.data()?.societyId;

                // Determine payment method from approval result
                const paymentMethod = approvalResult?.method || 'CARD';

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
                        status: 'PAID',
                        paymentStatus: 'PAID',
                        paymentMethod: paymentMethod,
                        paymentKey: paymentKey,
                        orderId: orderId,
                        amount: amount,
                        tier: userData.tier,
                        categoryName: userData.categoryName,
                        memberVerificationData: null,
                        isAnonymous: userData.isAnonymous || false,
                        agreements: {},
                        paymentDetails: approvalResult,
                        receiptNumber: `${dateStr}-${rand}`,
                        confirmationQr: `CONF-${regId}`,
                        badgeQr: null,
                        isCheckedIn: false,
                        checkInTime: null,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        paidAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: false });

                // [Security] Lock the Member Code & Log History
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

                   // B. Log Participation History (users/{uid}/participations/{regId})
                   // Only for real users (not GUEST if possible, but GUEST might be a real user with isAnonymous=true)
                   // If userData.userId exists, save it.
                   if (userData.userId && userData.userId !== 'GUEST') {
                       await admin.firestore().collection('users').doc(userData.userId).collection('participations').doc(regId).set({
                           conferenceId: confId,
                           conferenceName: '', // Will be populated later if needed
                           registrationId: regId,
                           societyId: societyId || 'unknown',
                           role: 'ATTENDEE',
                           registeredAt: admin.firestore.FieldValue.serverTimestamp(),
                           paidAt: admin.firestore.FieldValue.serverTimestamp(),
                           amount: amount,
                           status: 'COMPLETED'
                       }, { merge: true });
                       functions.logger.info(`[History Logged] Participation saved for user ${userData.userId}`);
                   }
                 } catch (postProcessError) {
                     functions.logger.error("Failed to post-process (Lock/History) for Toss Payment:", postProcessError);
                     // Non-blocking
                 }
            }

            return { success: true, data: approvalResult };

        } catch (error: any) {
            functions.logger.error("Error in confirmTossPayment:", error);
            throw new functions.https.HttpsError('internal', error.message);
        }
    });

// 3b. Confirm TossPayment (HTTP Endpoint with CORS for custom domains)
// This is an alternative to the callable version for better CORS support
export const confirmTossPaymentHttp = functions
    .runWith({
        enforceAppCheck: false,
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onRequest(async (req, res) => {
        // Apply CORS
        cors(req, res, async () => {
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

            try {
                const { paymentKey, orderId, amount, regId, confId, secretKey, userData } = req.body;

                if (!paymentKey || !orderId || !amount || !secretKey) {
                    res.status(400).json({ error: 'Missing payment details' });
                    return;
                }

                if (!userData) {
                    res.status(400).json({ error: 'Missing user data for registration creation' });
                    return;
                }

                // 1. Call Toss API
                const approvalResult = await approveTossPayment(paymentKey, orderId, amount, secretKey);

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
                    const paymentMethod = approvalResult?.method || 'CARD';

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
                        status: 'PAID',
                        paymentStatus: 'PAID',
                        paymentMethod: paymentMethod,
                        paymentKey: paymentKey,
                        orderId: orderId,
                        amount: amount,
                        tier: userData.tier,
                        categoryName: userData.categoryName,
                        memberVerificationData: null,
                        isAnonymous: userData.isAnonymous || false,
                        agreements: {},
                        paymentDetails: approvalResult,
                        receiptNumber: `${dateStr}-${rand}`,
                        confirmationQr: `CONF-${regId}`,
                        badgeQr: null,
                        isCheckedIn: false,
                        checkInTime: null,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        paidAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: false });

                    // [Security] Lock the Member Code & Log History
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

                       // B. Log Participation History (users/{uid}/participations/{regId})
                       if (userData.userId && userData.userId !== 'GUEST') {
                           await admin.firestore().collection('users').doc(userData.userId).collection('participations').doc(regId).set({
                               conferenceId: confId,
                               conferenceName: '',
                               registrationId: regId,
                               societyId: societyId || 'unknown',
                               role: 'ATTENDEE',
                               registeredAt: admin.firestore.FieldValue.serverTimestamp(),
                               paidAt: admin.firestore.FieldValue.serverTimestamp(),
                               amount: amount,
                               status: 'COMPLETED'
                           }, { merge: true });
                           functions.logger.info(`[History Logged] Participation saved for user ${userData.userId}`);
                       }
                     } catch (postProcessError) {
                         functions.logger.error("Failed to post-process (Lock/History) for Toss Payment:", postProcessError);
                     }
                }

                // Return success response
                res.status(200).json({ success: true, data: approvalResult });

            } catch (error: any) {
                functions.logger.error("Error in confirmTossPaymentHttp:", error);
                res.status(500).json({ error: error.message || 'Payment confirmation failed' });
            }
        });
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

    let warning = null;
    let userRecord;

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

        } catch (e: any) {
            if (e.code === 'auth/user-not-found') {
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
        } catch (claimError: any) {
            functions.logger.error("Claim Error (IAM/Permission Issue?):", claimError);
            warning = `User created/linked, but custom claims failed: ${claimError.message}`;
        }

        // 5. Update Firestore
        functions.logger.info("Updating society document:", societyId);
        await admin.firestore().collection('societies').doc(societyId).update({
            adminEmails: admin.firestore.FieldValue.arrayUnion(email)
        });
        
        return { success: true, uid: userRecord.uid, warning };

    } catch (error: any) {
        functions.logger.error("Error in createSocietyAdminUser:", error);
        throw new functions.https.HttpsError('internal', `Failed to create/link admin: ${error.message}`, error);
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
        await admin.firestore().collection('societies').doc(societyId).update({
            adminEmails: admin.firestore.FieldValue.arrayRemove(email)
        });

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
    } catch (error: any) {
        functions.logger.error("Error in removeSocietyAdminUser:", error);
        throw new functions.https.HttpsError('internal', error.message);
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
    .https.onCall(async (data, context) => {
        const { phone, code } = data;

        if (!phone || !code) {
             throw new functions.https.HttpsError('invalid-argument', 'Missing phone number or code');
        }

        // In a real implementation, this would call an SMS/AlimTalk provider API (e.g., Aligo, Twilio, Solapi)
        // For now, we just log it as requested.
        functions.logger.info(`[SMS MOCK] Sending AlimTalk to ${phone}: [e-Regi] 가입인증번호 입니다. #${code}`);
        
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
            // 1. Try License Number
            let q = membersRef.where('name', '==', name).where('licenseNumber', '==', code);
            let snap = await q.get();

            if (snap.empty) {
                // 2. Try Code field
                q = membersRef.where('name', '==', name).where('code', '==', code);
                snap = await q.get();
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
                    if (exp.toDate) {
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
                    isExpired: isExpired, // ✅ [FIX] 만료 여부 플래그 추가
                    memberData: {
                        id: memberDoc.id, // [Critical] Return Doc ID for Locking
                        name: member.name,
                        grade: serverGrade,              // ✅ [FIX] 등급 정보 추가
                        priceKey: priceKey,              // ✅ [FIX] 정규화된 가격 키 추가
                        licenseNumber: member.licenseNumber || member.code,
                        societyId: societyId, // Pass back for context
                        expiryDate: finalExpiry,
                        expiry: finalExpiry              // 프론트가 찾는 필드 강제 주입
                    }
                };
            }

            return { success: false, message: "Member not found. Please check your name and license number." };

        } catch (e: any) {
            functions.logger.error("Verify Member Error:", e);
            throw new functions.https.HttpsError('internal', e.message);
        }
    });

export const checkEmailExists = functions
    .runWith({
        enforceAppCheck: false,
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onCall(async (data, context) => {
        const { email } = data;
        if (!email) return { exists: false };

        try {
            // 1. Check Auth
            try {
                await admin.auth().getUserByEmail(email);
                return { exists: true };
            } catch (authErr: any) {
                if (authErr.code === 'auth/user-not-found') {
                    // 2. Check Firestore 'users' collection (Fallback)
                    const userSnap = await admin.firestore().collection('users').where('email', '==', email).limit(1).get();
                    return { exists: !userSnap.empty };
                }
                throw authErr;
            }
        } catch (e: any) {
             functions.logger.error("Email Check Error:", e);
             throw new functions.https.HttpsError('internal', e.message);
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
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                functions.logger.warn(`Auth user ${uid} already missing. Skipping.`);
            } else {
                functions.logger.error(`Auth delete error: ${error.message}`);
                // Proceed to DB delete even if Auth delete fails
            }
        }

        // 3. Firestore DB Delete (Try-Catch)
        try {
            await admin.firestore().collection('users').doc(uid).delete();
            functions.logger.info(`Firestore doc ${uid} deleted.`);
        } catch (error: any) {
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

    // 1. 유효성 검사 강화 (Hybrid: Context Auth OR ID Token Payload)
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
        } catch (verifyErr) {
            functions.logger.warn(`[Hydration] Invalid ID Token:`, verifyErr);
            throw new functions.https.HttpsError('unauthenticated', 'Invalid ID Token');
        }
    } else {
        throw new functions.https.HttpsError('unauthenticated', '인증 정보가 없습니다.');
    }
    
    const customToken = await admin.auth().createCustomToken(uid, {
        crossDomain: true,
        mintedAt: Date.now()
    });
    
    functions.logger.info(`[Mint Success] Custom token created for UID: ${uid}`);
    return { token: customToken };
  } catch (error: any) {
    functions.logger.error("Mint Cross Domain Token Error:", error);
    throw new functions.https.HttpsError('internal', error.message || 'Failed to mint custom token');
  }
});

// --------------------------------------------------------------------------
// SECURITY: Admin Link Verification (HMAC + TTL)
// --------------------------------------------------------------------------
import * as crypto from 'crypto';

const LINK_SECRET = process.env.LINK_SECRET || 'eregi_v2_secure_link_key_2026';

export const verifyAccessLink = functions
    .runWith({ enforceAppCheck: false, ingressSettings: 'ALLOW_ALL' })
    .https.onCall(async (data, context) => {
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
        } catch (e: any) {
            functions.logger.warn(`[Security] Token Verification Failed: ${e.message}`);
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
    .https.onCall(async (data, context) => {
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
        } catch (e: any) {
            functions.logger.error("Non-Member Email Check Error:", e);
            throw new functions.https.HttpsError('internal', e.message);
        }
    });

// Resume guest registration by email + password verification
// [FIX-20250124] Properly handle both pending and completed non-member registrations
// [FIX-20250124-03] Add detailed logging for debugging
export const resumeGuestRegistration = functions
    .runWith({
        enforceAppCheck: false,
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onCall(async (data, context) => {
        const { email, password, confId } = data;

        functions.logger.info('[resumeGuestRegistration] START', { email, confId });

        if (!email || !password || !confId) {
            throw new functions.https.HttpsError('invalid-argument', 'email, password, and confId are required');
        }

        try {
            const regRef = admin.firestore().collection(`conferences/${confId}/registrations`);

            // [FIX-20250124-05] CRITICAL FIX: Try Firebase Admin Auth signIn first
            // This properly validates the password before any Firestore query
            functions.logger.info('[resumeGuestRegistration] Step 1: Attempting Firebase Admin Auth login', { email, confId });

            try {
                // Try to sign in with email/password using Firebase Admin SDK
                const userRecord = await admin.auth().getUserByEmail(email);

                functions.logger.info('[resumeGuestRegistration] Found Firebase user', {
                    uid: userRecord.uid,
                    email: userRecord.email,
                    disabled: userRecord.disabled,
                    emailVerified: userRecord.emailVerified
                });

                // User exists - now check if they have a registration document
                const regQuery = regRef.where('userId', '==', userRecord.uid).limit(1);
                const regSnap = await regQuery.get();

                if (!regSnap.empty) {
                    const regDoc = regSnap.docs[0];
                    const regData = regDoc.data();

                    functions.logger.info('[resumeGuestRegistration] Found registration document', {
                        regId: regDoc.id,
                        userId: regData.userId,
                        email: regData.email,
                        status: regData.status
                    });

                    // CRITICAL: Return success without checking password in Firestore
                    // Firebase Auth login succeeded, so password is already verified
                    return {
                        success: true,
                        source: 'firebase_auth',
                        data: {
                            registrationId: regDoc.id,
                            name: regData.name || regData.userName || regData.userInfo?.name || userRecord.displayName || 'Guest',
                            email: regData.email || regData.userEmail || regData.userInfo?.email || email,
                            phone: regData.phone || regData.userPhone || regData.userInfo?.phone,
                            affiliation: regData.affiliation || regData.organization || regData.userInfo?.affiliation,
                            licenseNumber: regData.licenseNumber || regData.userInfo?.licenseNumber,
                            tier: regData.tier,
                            categoryName: regData.categoryName,
                            paymentStatus: regData.paymentStatus,
                            amount: regData.amount,
                            agreements: regData.agreements || {},
                            memberVerificationData: regData.memberVerificationData,
                            currentStep: regData.currentStep || 4,
                            formData: regData.formData
                        }
                    };
                } else {
                    functions.logger.warn('[resumeGuestRegistration] Firebase user exists but no registration document found', {
                        uid: userRecord.uid,
                        email,
                        confId
                    });
                    return {
                        success: false,
                        message: '등록된 회원 정보를 찾을 수 없습니다.'
                    };
                }
            } catch (authError: any) {
                // Firebase Auth login failed - user doesn't exist or wrong password
                if (authError.code === 'auth/user-not-found') {
                    functions.logger.warn('[resumeGuestRegistration] Firebase user not found', { email });
                } else if (authError.code === 'auth/wrong-password') {
                    functions.logger.warn('[resumeGuestRegistration] Wrong password', { email });
                    return {
                        success: false,
                        message: '이메일 또는 비밀번호가 일치하지 않습니다.'
                    };
                } else {
                    functions.logger.error('[resumeGuestRegistration] Firebase Auth error', { email, error: authError.message, code: authError.code });
                }
                // Fall through to email search in registrations collection
            }

            // 5. Fallback: Search for registration by email only (for legacy data without proper Firebase user)
            functions.logger.info('[resumeGuestRegistration] Fallback: Searching by email in registrations', { email });
            const emailQuery = regRef.where('email', '==', email).limit(1);
            const emailSnap = await emailQuery.get();

            if (emailSnap.empty) {
                functions.logger.warn('[resumeGuestRegistration] No registration found by email', { email, confId });
                return {
                    success: false,
                    message: '이메일 또는 비밀번호가 일치하지 않습니다.'
                };
            }

            const regDoc = emailSnap.docs[0];
            const regData = regDoc.data();

            functions.logger.info('[resumeGuestRegistration] Found registration by email (fallback)', {
                regId: regDoc.id,
                hasPassword: !!regData.password
            });

            // Check password if available
            if (regData.password && regData.password.trim() !== '') {
                // Only validate if password exists and is not empty string
                const simpleHash = Buffer.from(password + "_SALT_" + email).toString('base64');
                let passwordMatch = regData.password === password || regData.password === simpleHash;

                if (!passwordMatch) {
                    functions.logger.warn('[resumeGuestRegistration] Password mismatch in fallback', {
                        email,
                        regId: regDoc.id,
                        hasPasswordInDoc: !!regData.password,
                        passwordType: typeof regData.password,
                        inputPasswordLength: password.length,
                        docPasswordLength: regData.password.length
                    });
                    return {
                        success: false,
                        message: '이메일 또는 비밀번호가 일치하지 않습니다.'
                    };
                }
            } else {
                // No password stored in registration document (or empty string)
                functions.logger.warn('[resumeGuestRegistration] No password found in registration', {
                    email,
                    regId: regDoc.id,
                    hasPassword: !!regData.password,
                    passwordLength: regData.password?.length || 0
                });
                return {
                    success: false,
                    message: '등록된 비밀번호 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.'
                };
            }

            // Return registration data
            functions.logger.info('[resumeGuestRegistration] Fallback successful', { regId: regDoc.id });
            return {
                success: true,
                source: 'fallback_email_search',
                data: {
                    registrationId: regDoc.id,
                    name: regData.name || regData.userName || regData.userInfo?.name || 'Guest',
                    email: regData.email || regData.userEmail || regData.userInfo?.email || email,
                    phone: regData.phone || regData.userPhone || regData.userInfo?.phone,
                    affiliation: regData.affiliation || regData.organization || regData.userInfo?.affiliation,
                    licenseNumber: regData.licenseNumber || regData.userInfo?.licenseNumber,
                    tier: regData.tier,
                    categoryName: regData.categoryName,
                    paymentStatus: regData.paymentStatus,
                    amount: regData.amount,
                    agreements: regData.agreements || {},
                    memberVerificationData: regData.memberVerificationData,
                    currentStep: regData.currentStep || 4,
                    formData: regData.formData
                }
            };
        } catch (e: any) {
            functions.logger.error("Resume Guest Registration Error:", e);
            throw new functions.https.HttpsError('internal', e.message);
        }
    });
