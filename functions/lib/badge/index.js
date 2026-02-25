"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onExternalAttendeeCreated = exports.resendBadgePrepToken = exports.issueDigitalBadge = exports.validateBadgePrepToken = exports.onRegistrationCreated = void 0;
exports.generateBadgePrepToken = generateBadgePrepToken;
exports.sendBadgeNotification = sendBadgeNotification;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const date_fns_1 = require("date-fns");
const locale_1 = require("date-fns/locale");
const nhnAlimTalk_1 = require("../utils/nhnAlimTalk");
/**
 * Generate a secure random token for badge prep
 */
function generateBadgePrepToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = 'TKN-';
    for (let i = 0; i < 32; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}
/**
 * Cloud Function: Generate Badge Prep Token
 * Triggered by: onCreate of registrations document
 * Creates token and sends notification
 */
exports.onRegistrationCreated = functions.firestore
    .document('conferences/{confId}/registrations/{regId}')
    .onCreate(async (snap, context) => {
    var _a;
    const regData = snap.data();
    const { confId, regId } = context.params;
    // Only generate token for PAID registrations
    if (regData.paymentStatus !== 'PAID') {
        functions.logger.info(`[BadgeToken] Skipping unpaid registration ${regId}`);
        return null;
    }
    // Skip if token already exists
    if (regData.badgePrepToken) {
        functions.logger.info(`[BadgeToken] Token already exists for ${regId}`);
        return null;
    }
    try {
        const db = admin.firestore();
        // Get conference end date for token expiry
        const confSnap = await db.collection('conferences').doc(confId).get();
        const conference = confSnap.data();
        // Set token expiry to conference end date + 1 day
        let expiresAt;
        if ((_a = conference === null || conference === void 0 ? void 0 : conference.dates) === null || _a === void 0 ? void 0 : _a.end) {
            expiresAt = admin.firestore.Timestamp.fromMillis(conference.dates.end.toMillis() + (24 * 60 * 60 * 1000) // 1 day after conference end
            );
        }
        else {
            // Fallback: 7 days if no end date
            const now = admin.firestore.Timestamp.now();
            expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + (7 * 24 * 60 * 60 * 1000));
        }
        // Generate unique token
        const token = generateBadgePrepToken();
        const now = admin.firestore.Timestamp.now();
        // Create badge token document
        await db.collection(`conferences/${confId}/badge_tokens`).doc(token).set({
            token,
            registrationId: regId,
            conferenceId: confId,
            userId: regData.userId || 'GUEST',
            status: 'ACTIVE',
            createdAt: now,
            expiresAt
        });
        // Update registration with token reference
        // [MIGRATION] Removed legacy badgePrepToken field update. Now using badge_tokens collection only.
        await db.collection(`conferences/${confId}/registrations`).doc(regId).update({
            // badgePrepToken: token, // DEPRECATED
            confirmationQr: regId, // Use regId directly without CONF- prefix for InfoDesk scanning
            updatedAt: now
        });
        // Send notification
        if (conference) {
            await sendBadgeNotification(db, conference, regId, regData, token);
        }
        functions.logger.info(`[BadgeToken] Created token ${token} for ${regId}`);
        return null;
    }
    catch (error) {
        functions.logger.error(`[BadgeToken] Error generating token for ${regId}:`, error);
        throw error;
    }
});
/**
 * Helper: Send Badge Notification (AlimTalk)
 */
async function sendBadgeNotification(db, conference, regId, regData, token) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    if (!conference.societyId)
        return;
    try {
        // Find active template for CONFERENCE_REGISTER
        const templatesQuery = await db.collection(`societies/${conference.societyId}/notification-templates`)
            .where('eventType', '==', 'CONFERENCE_REGISTER')
            .where('isActive', '==', true)
            .limit(1)
            .get();
        if (!templatesQuery.empty) {
            const templateDoc = templatesQuery.docs[0];
            const template = templateDoc.data();
            const kakaoConfig = (_a = template.channels) === null || _a === void 0 ? void 0 : _a.kakao;
            if (kakaoConfig && kakaoConfig.status === 'APPROVED' && kakaoConfig.kakaoTemplateCode) {
                // Prepare Data
                // Society Info
                const societySnap = await db.collection('societies').doc(conference.societyId).get();
                const societyData = societySnap.data();
                const societyName = ((_b = societyData === null || societyData === void 0 ? void 0 : societyData.name) === null || _b === void 0 ? void 0 : _b.ko) || ((_c = societyData === null || societyData === void 0 ? void 0 : societyData.name) === null || _c === void 0 ? void 0 : _c.en) || conference.societyId;
                // Event Info
                const eventName = ((_d = conference.title) === null || _d === void 0 ? void 0 : _d.ko) || ((_e = conference.title) === null || _e === void 0 ? void 0 : _e.en) || '';
                const startDate = ((_f = conference.dates) === null || _f === void 0 ? void 0 : _f.start)
                    ? (0, date_fns_1.format)(conference.dates.start.toDate(), 'yyyy-MM-dd HH:mm', { locale: locale_1.ko })
                    : '';
                const venueName = typeof ((_g = conference.venue) === null || _g === void 0 ? void 0 : _g.name) === 'object'
                    ? (conference.venue.name.ko || conference.venue.name.en || '')
                    : (((_h = conference.venue) === null || _h === void 0 ? void 0 : _h.name) || '');
                // URL Construction
                const domain = `https://${conference.societyId}.eregi.co.kr`;
                const badgePrepUrl = `${domain}/${conference.id || conference.slug || conference.conferenceId}/badge-prep/${token}`;
                const digitalBadgeQrUrl = `${domain}/my-badge/${regId}`;
                const affiliation = regData.organization || regData.affiliation || ((_j = regData.userInfo) === null || _j === void 0 ? void 0 : _j.affiliation) || '';
                // Variables Map
                const variables = {
                    userName: regData.name || ((_k = regData.userInfo) === null || _k === void 0 ? void 0 : _k.name) || '',
                    society: societyName,
                    eventName: eventName,
                    badgePrepUrl: badgePrepUrl,
                    digitalBadgeQrUrl: digitalBadgeQrUrl,
                    organization: affiliation,
                    affiliation: affiliation,
                    registrationId: regId,
                    startDate: startDate,
                    venue: venueName,
                };
                // Replace Content
                let content = kakaoConfig.content || '';
                for (const [key, value] of Object.entries(variables)) {
                    content = content.replace(new RegExp(`#{${key}}`, 'g'), value);
                }
                // Process Buttons (Replace URL variables)
                let buttons = kakaoConfig.buttons ? [...kakaoConfig.buttons] : [];
                buttons = buttons.map((btn) => {
                    var _a, _b;
                    return ({
                        ...btn,
                        linkMobile: (_a = btn.linkMobile) === null || _a === void 0 ? void 0 : _a.replace('#{badgePrepUrl}', badgePrepUrl),
                        linkPc: (_b = btn.linkPc) === null || _b === void 0 ? void 0 : _b.replace('#{badgePrepUrl}', badgePrepUrl)
                    });
                });
                // Get Sender Key from Infrastructure Settings
                const infraSnap = await db.doc(`societies/${conference.societyId}/settings/infrastructure`).get();
                const infraData = infraSnap.data();
                const senderKey = (_m = (_l = infraData === null || infraData === void 0 ? void 0 : infraData.notification) === null || _l === void 0 ? void 0 : _l.alimTalk) === null || _m === void 0 ? void 0 : _m.senderKey;
                if (!senderKey) {
                    functions.logger.error(`[BadgeNotification] No Sender Key found for society ${conference.societyId}`);
                    return;
                }
                // Send (NHN AlimTalk)
                const recipientPhone = regData.phone || ((_o = regData.userInfo) === null || _o === void 0 ? void 0 : _o.phone);
                if (recipientPhone) {
                    const cleanPhone = recipientPhone.replace(/-/g, '');
                    // Map buttons to NHN format
                    const nhnButtons = buttons.map((btn, index) => ({
                        ordering: index + 1,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        type: btn.type, // Type cast might be needed if types assume Aligo format
                        name: btn.name,
                        linkMo: btn.linkMobile,
                        linkPc: btn.linkPc
                    }));
                    await (0, nhnAlimTalk_1.sendAlimTalk)({
                        senderKey,
                        templateCode: kakaoConfig.kakaoTemplateCode,
                        recipientNo: cleanPhone,
                        content: content,
                        buttons: nhnButtons.length > 0 ? nhnButtons : undefined
                    });
                    functions.logger.info(`[BadgeNotification] AlimTalk sent to ${cleanPhone} for ${regId}`);
                }
            }
        }
        else {
            functions.logger.info(`[BadgeNotification] No active template for CONFERENCE_REGISTER in ${conference.societyId}`);
        }
    }
    catch (error) {
        functions.logger.error(`[BadgeNotification] Error for ${regId}:`, error);
    }
}
/**
 * Cloud Function: Validate Badge Prep Token (HTTP)
 * Called by badge prep page to validate token and get registration data
 */
exports.validateBadgePrepToken = functions
    .runWith({
    enforceAppCheck: false,
    ingressSettings: 'ALLOW_ALL'
})
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .https.onCall(async (data, _context) => {
    var _a, _b, _c, _d, _e, _f;
    const { confId, token } = data;
    if (!confId || !token) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing confId or token');
    }
    try {
        const db = admin.firestore();
        // Get token document
        const tokenSnap = await db.collection(`conferences/${confId}/badge_tokens`).doc(token).get();
        if (!tokenSnap.exists) {
            return { valid: false, error: 'TOKEN_NOT_FOUND' };
        }
        const tokenData = tokenSnap.data();
        if (!tokenData) {
            return { valid: false, error: 'TOKEN_DATA_INVALID' };
        }
        const now = admin.firestore.Timestamp.now();
        // Check expiry
        if (tokenData.expiresAt.toMillis() < now.toMillis()) {
            // Token expired - auto-reissue new token
            functions.logger.info(`[BadgeToken] Token ${token} expired, reissuing...`);
            // Mark old token as EXPIRED
            await db.collection(`conferences/${confId}/badge_tokens`).doc(token).update({
                status: 'EXPIRED',
                updatedAt: now
            });
            // Generate new token
            const newToken = generateBadgePrepToken();
            // Get conference for expiry date
            const confSnap = await db.collection('conferences').doc(confId).get();
            const conference = confSnap.data();
            let newExpiresAt;
            if ((_a = conference === null || conference === void 0 ? void 0 : conference.dates) === null || _a === void 0 ? void 0 : _a.end) {
                newExpiresAt = admin.firestore.Timestamp.fromMillis(conference.dates.end.toMillis() + (24 * 60 * 60 * 1000));
            }
            else {
                newExpiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + (7 * 24 * 60 * 60 * 1000));
            }
            // Create new token document
            await db.collection(`conferences/${confId}/badge_tokens`).doc(newToken).set({
                token: newToken,
                registrationId: tokenData.registrationId,
                conferenceId: confId,
                userId: tokenData.userId,
                status: 'ACTIVE',
                createdAt: now,
                expiresAt: newExpiresAt
            });
            // Update registration with new token reference
            const collectionName = tokenData.registrationId.startsWith('EXT-') ? 'external_attendees' : 'registrations';
            await db.collection(`conferences/${confId}/${collectionName}`).doc(tokenData.registrationId).update({
                // badgePrepToken: newToken, // DEPRECATED
                updatedAt: now
            });
            functions.logger.info(`[BadgeToken] New token ${newToken} reissued for ${tokenData.registrationId}`);
            // Return new token URL to client for redirect
            return {
                valid: true,
                tokenStatus: 'ACTIVE',
                newToken,
                redirectRequired: true,
                registration: {
                    id: tokenData.registrationId,
                    name: '',
                    email: '',
                    phone: '',
                    affiliation: '',
                    licenseNumber: '',
                    confirmationQr: '',
                    badgeQr: null,
                    badgeIssued: false,
                    attendanceStatus: 'OUTSIDE',
                    currentZone: null,
                    totalMinutes: 0,
                    receiptNumber: ''
                }
            };
        }
        // Get registration data (Check both registrations and external_attendees)
        let regSnap = await db.collection(`conferences/${confId}/registrations`).doc(tokenData.registrationId).get();
        if (!regSnap.exists) {
            regSnap = await db.collection(`conferences/${confId}/external_attendees`).doc(tokenData.registrationId).get();
        }
        if (!regSnap.exists) {
            return { valid: false, error: 'REGISTRATION_NOT_FOUND' };
        }
        const regData = regSnap.data();
        if (!regData) {
            return { valid: false, error: 'REGISTRATION_DATA_INVALID' };
        }
        return {
            valid: true,
            tokenStatus: tokenData.status,
            registration: {
                id: regSnap.id,
                name: regData.name || ((_b = regData.userInfo) === null || _b === void 0 ? void 0 : _b.name),
                email: regData.email || ((_c = regData.userInfo) === null || _c === void 0 ? void 0 : _c.email),
                phone: regData.phone || ((_d = regData.userInfo) === null || _d === void 0 ? void 0 : _d.phone),
                affiliation: regData.affiliation || regData.organization || ((_e = regData.userInfo) === null || _e === void 0 ? void 0 : _e.affiliation) || '',
                licenseNumber: regData.licenseNumber || ((_f = regData.userInfo) === null || _f === void 0 ? void 0 : _f.licenseNumber) || '',
                confirmationQr: regData.confirmationQr,
                badgeQr: regData.badgeQr,
                badgeIssued: !!regData.badgeIssued,
                attendanceStatus: regData.attendanceStatus || 'OUTSIDE',
                currentZone: regData.currentZone,
                totalMinutes: regData.totalMinutes || 0,
                receiptNumber: regData.receiptNumber
            }
        };
    }
    catch (error) {
        functions.logger.error('[BadgeToken] Validation error:', error);
        throw new functions.https.HttpsError('internal', 'Validation failed');
    }
});
/**
 * Cloud Function: Issue Digital Badge (called by InfoDesk)
 * Updates registration and token status
 */
exports.issueDigitalBadge = functions
    .runWith({
    enforceAppCheck: false,
    ingressSettings: 'ALLOW_ALL'
})
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .https.onCall(async (data, _context) => {
    const { confId, regId, issueOption } = data;
    if (!confId || !regId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing confId or regId');
    }
    try {
        const db = admin.firestore();
        const now = admin.firestore.Timestamp.now();
        // Generate badge QR
        const badgeQr = `BADGE-${regId}`;
        // Update registration (Check both)
        let regRef = db.collection(`conferences/${confId}/registrations`).doc(regId);
        let regSnap = await regRef.get();
        if (!regSnap.exists) {
            regRef = db.collection(`conferences/${confId}/external_attendees`).doc(regId);
            regSnap = await regRef.get();
        }
        if (!regSnap.exists) {
            throw new Error('Registration not found');
        }
        await regRef.update({
            badgeIssued: true,
            badgeIssuedAt: now,
            badgeQr,
            badgeType: issueOption || 'DIGITAL_PRINT',
            updatedAt: now
        });
        if (regSnap.exists) {
            // Query badge_tokens for active token instead of relying on badgePrepToken field
            const tokensSnap = await db.collection(`conferences/${confId}/badge_tokens`)
                .where('registrationId', '==', regId)
                .where('status', '==', 'ACTIVE')
                .limit(1)
                .get();
            if (!tokensSnap.empty) {
                await tokensSnap.docs[0].ref.update({
                    status: 'ISSUED',
                    issuedAt: now
                });
            }
        }
        // Log action
        await db.collection(`conferences/${confId}/registrations`).doc(regId).collection('logs').add({
            type: 'BADGE_ISSUED',
            timestamp: now,
            method: 'KIOSK_INFODESK',
            option: issueOption || 'DIGITAL_PRINT'
        });
        functions.logger.info(`[BadgeToken] Digital badge issued for ${regId}, QR: ${badgeQr}`);
        return { success: true, badgeQr };
    }
    catch (error) {
        functions.logger.error('[BadgeToken] Issue badge error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to issue digital badge');
    }
});
/**
 * Cloud Function: Resend Badge Prep Token
 * Generates new token for existing registration (admin use)
 */
exports.resendBadgePrepToken = functions
    .runWith({
    enforceAppCheck: false,
    ingressSettings: 'ALLOW_ALL'
})
    .https.onCall(async (data) => {
    var _a;
    const { confId, regId } = data;
    if (!confId || !regId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing confId or regId');
    }
    try {
        const db = admin.firestore();
        const now = admin.firestore.Timestamp.now();
        // Get existing registration (check both collections)
        let regSnap = await db.collection(`conferences/${confId}/registrations`).doc(regId).get();
        if (!regSnap.exists) {
            regSnap = await db.collection(`conferences/${confId}/external_attendees`).doc(regId).get();
        }
        if (!regSnap.exists) {
            throw new Error('Registration not found');
        }
        const regData = regSnap.data();
        if (!regData) {
            throw new Error('Registration data invalid');
        }
        if (regData.status !== 'PAID') {
            throw new Error('Registration not paid');
        }
        // Get conference for expiry date
        const confSnap = await db.collection('conferences').doc(confId).get();
        const conference = confSnap.data();
        // Set token expiry to conference end date + 1 day
        let expiresAt;
        if ((_a = conference === null || conference === void 0 ? void 0 : conference.dates) === null || _a === void 0 ? void 0 : _a.end) {
            expiresAt = admin.firestore.Timestamp.fromMillis(conference.dates.end.toMillis() + (24 * 60 * 60 * 1000));
        }
        else {
            // Fallback: 7 days if no end date
            expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + (7 * 24 * 60 * 60 * 1000));
        }
        // Mark old tokens as EXPIRED if exists
        const oldTokensSnap = await db.collection(`conferences/${confId}/badge_tokens`)
            .where('registrationId', '==', regId)
            .where('status', '==', 'ACTIVE')
            .get();
        for (const tDoc of oldTokensSnap.docs) {
            await tDoc.ref.update({
                status: 'EXPIRED',
                updatedAt: now
            });
        }
        // Generate new token
        const newToken = generateBadgePrepToken();
        // Create new token document
        await db.collection(`conferences/${confId}/badge_tokens`).doc(newToken).set({
            token: newToken,
            registrationId: regId,
            conferenceId: confId,
            userId: regData.userId || 'GUEST',
            status: 'ACTIVE',
            createdAt: now,
            expiresAt
        });
        // Update registration (handle both registrations and external_attendees)
        const collectionName = regId.startsWith('EXT-') ? 'external_attendees' : 'registrations';
        await db.collection(`conferences/${confId}/${collectionName}`).doc(regId).update({
            // badgePrepToken: newToken, // DEPRECATED
            updatedAt: now
        });
        // Send AlimTalk
        if (conference) {
            await sendBadgeNotification(db, conference, regId, regData, newToken);
        }
        functions.logger.info(`[BadgeToken] New token ${newToken} reissued and sent for ${regId}`);
        // Return new token (client will construct URL)
        return {
            success: true,
            newToken
        };
    }
    catch (error) {
        functions.logger.error('[BadgeToken] Resend token error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to resend token');
    }
});
/**
 * Trigger for External Attendees
 */
exports.onExternalAttendeeCreated = functions.firestore
    .document('conferences/{confId}/external_attendees/{regId}')
    .onCreate(async (snap, context) => {
    var _a;
    const regData = snap.data();
    const { confId, regId } = context.params;
    // Only generate token for PAID registrations
    if (regData.paymentStatus !== 'PAID') {
        functions.logger.info(`[BadgeToken-Ext] Skipping unpaid external registration ${regId}`);
        return null;
    }
    try {
        const db = admin.firestore();
        // Get conference end date for token expiry
        const confSnap = await db.collection('conferences').doc(confId).get();
        const conference = confSnap.data();
        // Set token expiry
        let expiresAt;
        if ((_a = conference === null || conference === void 0 ? void 0 : conference.dates) === null || _a === void 0 ? void 0 : _a.end) {
            expiresAt = admin.firestore.Timestamp.fromMillis(conference.dates.end.toMillis() + (24 * 60 * 60 * 1000));
        }
        else {
            expiresAt = admin.firestore.Timestamp.fromMillis(admin.firestore.Timestamp.now().toMillis() + (7 * 24 * 60 * 60 * 1000));
        }
        // Generate unique token
        const token = generateBadgePrepToken();
        const now = admin.firestore.Timestamp.now();
        // Create badge token document
        await db.collection(`conferences/${confId}/badge_tokens`).doc(token).set({
            token,
            registrationId: regId,
            conferenceId: confId,
            userId: regData.userId || regData.uid || 'GUEST',
            status: 'ACTIVE',
            createdAt: now,
            expiresAt
        });
        // Update external attendee doc (legacy compatibility if needed, but mainly updatedAt)
        await db.collection(`conferences/${confId}/external_attendees`).doc(regId).update({
            updatedAt: now
        });
        // Send notification
        // Note: external_attendees has field 'organization' instead of 'userInfo.affiliation'
        // sendBadgeNotification already updated to handle both
        if (conference) {
            await sendBadgeNotification(db, { ...conference, id: confId }, regId, regData, token);
        }
        functions.logger.info(`[BadgeToken-Ext] Created token ${token} and notified for ${regId}`);
        return null;
    }
    catch (error) {
        functions.logger.error(`[BadgeToken-Ext] Error for ${regId}:`, error);
        return null;
    }
});
//# sourceMappingURL=index.js.map