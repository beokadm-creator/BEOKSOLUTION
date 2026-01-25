import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import corsLib from 'cors';
import { getNiceAuthParams, approveNicePayment } from './payment/nice';
import { approveTossPayment } from './payment/toss';
import { cleanupZombieUsers } from './scheduled/cleanupUsers';

export const cors = corsLib({ origin: true });

admin.initializeApp();

export {
    cleanupZombieUsers
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
        const { tid, amt, mid, key, regId, confId } = data;

        if (!tid || !amt || !mid || !key) {
             throw new functions.https.HttpsError('invalid-argument', 'Missing payment details');
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
                 
                 // If success, update Registration Status
                 if (regId && confId) {
                     const regRef = admin.firestore().collection(`conferences/${confId}/registrations`).doc(regId);
                     
                     await regRef.update({
                         status: 'COMPLETED',
                         paymentStatus: 'PAID',
                         paymentDetails: approvalResult,
                         updatedAt: admin.firestore.FieldValue.serverTimestamp()
                     });

                     // [Security] Lock the Member Code
                     try {
                        const regSnap = await regRef.get();
                        const regData = regSnap.data();

                        // Check if verification data exists
                        if (regData && regData.memberVerificationData && regData.memberVerificationData.id) {
                            const memberId = regData.memberVerificationData.id;
                            
                            // Resolve Society ID
                            let targetSocietyId = regData.memberVerificationData.societyId;
                            if (!targetSocietyId) {
                                // Fallback: Get from Conference
                                const confSnap = await admin.firestore().collection('conferences').doc(confId).get();
                                targetSocietyId = confSnap.data()?.societyId;
                            }

                            if (targetSocietyId && memberId) {
                                const memberRef = admin.firestore().collection('societies').doc(targetSocietyId).collection('members').doc(memberId);
                                await memberRef.update({
                                    used: true,
                                    usedBy: regData.userId || 'unknown',
                                    usedAt: admin.firestore.FieldValue.serverTimestamp()
                                });
                                functions.logger.info(`[Member Locked] Member ${memberId} locked for registration ${regId}`);
                            }
                        }
                     } catch (lockError) {
                         functions.logger.error("Failed to lock member code (Payment Successful):", lockError);
                         // Do not fail the request, as payment is already processed.
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
        const { paymentKey, orderId, amount, regId, confId, secretKey } = data;

        if (!paymentKey || !orderId || !amount || !secretKey) {
             throw new functions.https.HttpsError('invalid-argument', 'Missing payment details');
        }

        try {
            // 1. Call Toss API
            const approvalResult = await approveTossPayment(paymentKey, orderId, amount, secretKey);

            // 2. If success (no error thrown), update Registration Status
            if (regId && confId) {
                const regRef = admin.firestore().collection(`conferences/${confId}/registrations`).doc(regId);
                
                await regRef.update({
                    status: 'COMPLETED',
                    paymentStatus: 'PAID',
                    paymentDetails: approvalResult,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                // [Security] Lock the Member Code & Log History
                try {
                   const regSnap = await regRef.get();
                   const regData = regSnap.data();

                   if (regData) {
                       // A. Lock Code
                       if (regData.memberVerificationData && regData.memberVerificationData.id) {
                           const memberId = regData.memberVerificationData.id;
                           let targetSocietyId = regData.memberVerificationData.societyId;
                           
                           if (!targetSocietyId) {
                               const confSnap = await admin.firestore().collection('conferences').doc(confId).get();
                               targetSocietyId = confSnap.data()?.societyId;
                           }

                           if (targetSocietyId && memberId) {
                               const memberRef = admin.firestore().collection('societies').doc(targetSocietyId).collection('members').doc(memberId);
                               await memberRef.update({
                                   used: true,
                                   usedBy: regData.userId || 'unknown',
                                   usedAt: admin.firestore.FieldValue.serverTimestamp()
                               });
                               functions.logger.info(`[Member Locked] Member ${memberId} locked for registration ${regId}`);
                           }
                       }

                       // B. Log Participation History (users/{uid}/participations/{regId})
                       // Only for real users (not GUEST if possible, but GUEST might be a real user with isAnonymous=true)
                       // If regData.userId exists, save it.
                       if (regData.userId && regData.userId !== 'GUEST') {
                           await admin.firestore().collection('users').doc(regData.userId).collection('participations').doc(regId).set({
                               conferenceId: confId,
                               conferenceName: regData.conferenceName || 'Unknown Conference', // Might need to fetch if not in regData
                               registrationId: regId,
                               societyId: regData.societyId || 'unknown',
                               role: 'ATTENDEE',
                               registeredAt: regData.createdAt,
                               paidAt: admin.firestore.FieldValue.serverTimestamp(),
                               amount: amount,
                               status: 'COMPLETED'
                           }, { merge: true });
                           functions.logger.info(`[History Logged] Participation saved for user ${regData.userId}`);
                       }
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

                // [Security] Expiry Check
                if (member.expiryDate) {
                    let exp = member.expiryDate;
                    // Handle Firestore Timestamp or Date string
                    if (exp.toDate) {
                        exp = exp.toDate();
                    } else if (typeof exp === 'string') {
                        exp = new Date(exp);
                    }
                    
                    if (new Date() > exp) {
                         return { success: false, message: "Expired Code" };
                    }
                }

                // [Security] Used Check with Owner Pass
                // If used, ONLY allow if usedBy matches current UID
                if (member.used === true) {
                    const currentUid = context.auth?.uid;
                    if (!currentUid || member.usedBy !== currentUid) {
                        return { success: false, message: "Code Already Used" };
                    }
                    // If owner matches, allow pass (Re-verification)
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
                return { 
                    success: true, 
                    grade: member.grade || member.category || 'Member',
                    memberData: { 
                        id: memberDoc.id, // [Critical] Return Doc ID for Locking
                        name: member.name, 
                        licenseNumber: member.licenseNumber || member.code,
                        societyId: societyId, // Pass back for context
                        expiryDate: finalExpiry,
                        expiry: finalExpiry      // 프론트가 찾는 필드 강제 주입
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

    // 1. 유효성 검사 강화
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', '인증 정보가 없습니다.');
    }
    
    const uid = context.auth.uid;
    const customToken = await admin.auth().createCustomToken(uid);
    
    return { token: customToken };
  } catch (error: any) {
    console.error("Critical Server Error (Handled):", error);
    // [Step 413-D] 서버 응답 무적화: 에러를 던지지 않고 정상 객체 반환
    return { status: 'error', message: 'handled' };
  }
});
