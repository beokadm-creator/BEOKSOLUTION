import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Generate a secure random token for badge prep
 */
function generateBadgePrepToken(): string {
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
export const onRegistrationCreated = functions.firestore
  .document('conferences/{confId}/registrations/{regId}')
  .onCreate(async (snap, context) => {
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
      let expiresAt: admin.firestore.Timestamp;
      if (conference?.dates?.end) {
        expiresAt = admin.firestore.Timestamp.fromMillis(
          conference.dates.end.toMillis() + (24 * 60 * 60 * 1000) // 1 day after conference end
        );
      } else {
        // Fallback: 7 days if no end date
        const now = admin.firestore.Timestamp.now();
        expiresAt = admin.firestore.Timestamp.fromMillis(
          now.toMillis() + (7 * 24 * 60 * 60 * 1000)
        );
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
      await db.collection(`conferences/${confId}/registrations`).doc(regId).update({
        badgePrepToken: token,
        confirmationQr: regId, // Use regId directly without CONF- prefix for InfoDesk scanning
        updatedAt: now
      });

      // TODO: Send notification with badgePrepUrl
      // This requires notification template integration
      // URL format: https://{domain}/{confId}/badge-prep/{token}
      functions.logger.info(`[BadgeToken] Created token ${token} for ${regId}`);

      return null;
    } catch (error) {
      functions.logger.error(`[BadgeToken] Error generating token for ${regId}:`, error);
      throw error;
    }
  });

/**
 * Cloud Function: Validate Badge Prep Token (HTTP)
 * Called by badge prep page to validate token and get registration data
 */
export const validateBadgePrepToken = functions
  .runWith({
    enforceAppCheck: false,
    ingressSettings: 'ALLOW_ALL'
  })
  .https.onCall(async (data, context) => {
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

        let newExpiresAt: admin.firestore.Timestamp;
        if (conference?.dates?.end) {
          newExpiresAt = admin.firestore.Timestamp.fromMillis(
            conference.dates.end.toMillis() + (24 * 60 * 60 * 1000)
          );
        } else {
          newExpiresAt = admin.firestore.Timestamp.fromMillis(
            now.toMillis() + (7 * 24 * 60 * 60 * 1000)
          );
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
        await db.collection(`conferences/${confId}/registrations`).doc(tokenData.registrationId).update({
          badgePrepToken: newToken,
          updatedAt: now
        });

        functions.logger.info(`[BadgeToken] New token ${newToken} issued for ${tokenData.registrationId}`);

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

      // Get registration data
      const regSnap = await db.collection(`conferences/${confId}/registrations`).doc(tokenData.registrationId).get();

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
          name: regData.name,
          email: regData.email,
          phone: regData.phone,
          affiliation: regData.affiliation || regData.userAffiliation || '',
          licenseNumber: regData.licenseNumber || regData.userInfo?.licenseNumber || '',
          confirmationQr: regData.confirmationQr,
          badgeQr: regData.badgeQr,
          badgeIssued: !!regData.badgeIssued,
          attendanceStatus: regData.attendanceStatus || 'OUTSIDE',
          currentZone: regData.currentZone,
          totalMinutes: regData.totalMinutes || 0,
          receiptNumber: regData.receiptNumber
        }
      };
    } catch (error) {
      functions.logger.error('[BadgeToken] Validation error:', error);
      throw new functions.https.HttpsError('internal', 'Validation failed');
    }
  });

/**
 * Cloud Function: Issue Digital Badge (called by InfoDesk)
 * Updates registration and token status
 */
export const issueDigitalBadge = functions
  .runWith({
    enforceAppCheck: false,
    ingressSettings: 'ALLOW_ALL'
  })
  .https.onCall(async (data, context) => {
    const { confId, regId, issueOption } = data;

    if (!confId || !regId) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing confId or regId');
    }

    try {
      const db = admin.firestore();
      const now = admin.firestore.Timestamp.now();

      // Generate badge QR
      const badgeQr = `BADGE-${regId}`;

      // Update registration
      await db.collection(`conferences/${confId}/registrations`).doc(regId).update({
        badgeIssued: true,
        badgeIssuedAt: now,
        badgeQr,
        badgeType: issueOption || 'DIGITAL_PRINT',
        updatedAt: now
      });

      // Update token status if exists
      const regSnap = await db.collection(`conferences/${confId}/registrations`).doc(regId).get();

      if (regSnap.exists) {
        const regData = regSnap.data();
        if (regData && regData.badgePrepToken) {
          await db.collection(`conferences/${confId}/badge_tokens`).doc(regData.badgePrepToken).update({
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
    } catch (error) {
      functions.logger.error('[BadgeToken] Issue badge error:', error);
      throw new functions.https.HttpsError('internal', 'Failed to issue digital badge');
    }
  });

/**
 * Cloud Function: Resend Badge Prep Token
 * Generates new token for existing registration (admin use)
 */
export const resendBadgePrepToken = functions
  .runWith({
    enforceAppCheck: false,
    ingressSettings: 'ALLOW_ALL'
  })
  .https.onCall(async (data, context) => {
    const { confId, regId } = data;

    if (!confId || !regId) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing confId or regId');
    }

    try {
      const db = admin.firestore();
      const now = admin.firestore.Timestamp.now();

      // Get existing registration
      const regSnap = await db.collection(`conferences/${confId}/registrations`).doc(regId).get();

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
      let expiresAt: admin.firestore.Timestamp;
      if (conference?.dates?.end) {
        expiresAt = admin.firestore.Timestamp.fromMillis(
          conference.dates.end.toMillis() + (24 * 60 * 60 * 1000)
        );
      } else {
        // Fallback: 7 days if no end date
        expiresAt = admin.firestore.Timestamp.fromMillis(
          now.toMillis() + (7 * 24 * 60 * 60 * 1000)
        );
      }

      // Mark old token as EXPIRED if exists
      if (regData.badgePrepToken) {
        await db.collection(`conferences/${confId}/badge_tokens`).doc(regData.badgePrepToken).update({
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

      // Update registration with new token reference
      await db.collection(`conferences/${confId}/registrations`).doc(regId).update({
        badgePrepToken: newToken,
        updatedAt: now
      });

      functions.logger.info(`[BadgeToken] New token ${newToken} reissued for ${regId}`);

      // Return new token (client will construct URL)
      return {
        success: true,
        newToken
      };
    } catch (error) {
      functions.logger.error('[BadgeToken] Resend token error:', error);
      throw new functions.https.HttpsError('internal', 'Failed to resend token');
    }
  });
