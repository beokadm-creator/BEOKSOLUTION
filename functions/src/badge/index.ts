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
      // [MIGRATION] Removed legacy badgePrepToken field update. Now using badge_tokens collection only.
      await db.collection(`conferences/${confId}/registrations`).doc(regId).update({
        // badgePrepToken: token, // DEPRECATED
        confirmationQr: regId, // Use regId directly without CONF- prefix for InfoDesk scanning
        updatedAt: now
      });

      // Send notification
      await sendBadgeNotification(db, conference, regId, regData, token);

      functions.logger.info(`[BadgeToken] Created token ${token} for ${regId}`);

      return null;
    } catch (error) {
      functions.logger.error(`[BadgeToken] Error generating token for ${regId}:`, error);
      throw error;
    }
  });

/**
 * Helper: Send Badge Notification (AlimTalk)
 */
interface ConferenceData {
  societyId?: string;
  id?: string;
  slug?: string;
  conferenceId?: string;
  title?: { ko?: string; en?: string } | string;
  dates?: {
    start?: admin.firestore.Timestamp;
    end?: admin.firestore.Timestamp;
  };
  venue?: {
    name?: { ko?: string; en?: string } | string;
  };
}

interface RegistrationData {
  organization?: string;
  affiliation?: string;
  userInfo?: {
    affiliation?: string;
  };
  userName?: string;
  name?: string;
  userEmail?: string;
  email?: string;
}

async function sendBadgeNotification(
  db: admin.firestore.Firestore,
  conference: ConferenceData,
  regId: string,
  regData: RegistrationData,
  token: string
) {
  if (!conference.societyId) return;

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
      const kakaoConfig = template.channels?.kakao;

      if (kakaoConfig && kakaoConfig.status === 'APPROVED' && kakaoConfig.kakaoTemplateCode) {
        // Prepare Data
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { format } = require('date-fns');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { ko } = require('date-fns/locale');

        // Society Info
        const societySnap = await db.collection('societies').doc(conference.societyId).get();
        const societyData = societySnap.data();
        const societyName = societyData?.name?.ko || societyData?.name?.en || conference.societyId;

        // Event Info
        const title = conference.title;
        const eventName = typeof title === 'object'
          ? (title?.ko || title?.en || '')
          : (title || '');
        const startDate = conference.dates?.start
          ? format(conference.dates.start.toDate(), 'yyyy-MM-dd HH:mm', { locale: ko })
          : '';

        const venueName = typeof conference.venue?.name === 'object'
          ? (conference.venue.name.ko || conference.venue.name.en || '')
          : (conference.venue?.name || '');

        // URL Construction
        const domain = `https://${conference.societyId}.eregi.co.kr`;
        const badgePrepUrl = `${domain}/${conference.id || conference.slug || conference.conferenceId}/badge-prep/${token}`;
        const digitalBadgeQrUrl = `${domain}/my-badge/${regId}`;
        const affiliation = regData.organization || regData.affiliation || regData.userInfo?.affiliation || '';

        // Variables Map
        const variables: { [key: string]: string } = {
          userName: (regData as any).name || (regData as any).userInfo?.name || '',
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
        buttons = buttons.map((btn: any) => ({
          ...btn,
          // NHN uses linkMo, linkPc
          linkMo: btn.linkMobile?.replace('#{badgePrepUrl}', badgePrepUrl),
          linkPc: btn.linkPc?.replace('#{badgePrepUrl}', badgePrepUrl),
          // Keep legacy fields just in case
          linkMobile: btn.linkMobile?.replace('#{badgePrepUrl}', badgePrepUrl)
        }));

        // Send
        const recipientPhone = (regData as any).phone || (regData as any).userInfo?.phone;
        if (recipientPhone) {
          const cleanPhone = recipientPhone.replace(/-/g, '');

          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { sendAlimTalk } = require('../utils/nhnAlimTalk');

          await sendAlimTalk(
            cleanPhone,
            kakaoConfig.kakaoTemplateCode,
            variables, // Pass raw variables for template substitution
            {
              buttons: buttons
            }
          );

          functions.logger.info(`[BadgeNotification] AlimTalk sent to ${cleanPhone} for ${regId}`);
        }
      }
    } else {
      functions.logger.info(`[BadgeNotification] No active template for CONFERENCE_REGISTER in ${conference.societyId}`);
    }
  } catch (error) {
    functions.logger.error(`[BadgeNotification] Error for ${regId}:`, error);
  }
}

/**
 * Cloud Function: Validate Badge Prep Token (HTTP)
 * Called by badge prep page to validate token and get registration data
 */
export const validateBadgePrepToken = functions
  .runWith({
    enforceAppCheck: false,
    ingressSettings: 'ALLOW_ALL'
  })
  .https.onCall(async (data, _context) => {
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
          name: regData.name || regData.userInfo?.name,
          email: regData.email || regData.userInfo?.email,
          phone: regData.phone || regData.userInfo?.phone,
          affiliation: regData.affiliation || regData.organization || regData.userInfo?.affiliation || '',
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
  .https.onCall(async (data, _context) => {
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
      await sendBadgeNotification(db, conference, regId, regData, newToken);

      functions.logger.info(`[BadgeToken] New token ${newToken} reissued and sent for ${regId}`);

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

/**
 * Trigger for External Attendees
 */
export const onExternalAttendeeCreated = functions.firestore
  .document('conferences/{confId}/external_attendees/{regId}')
  .onCreate(async (snap, context) => {
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
      let expiresAt: admin.firestore.Timestamp;
      if (conference?.dates?.end) {
        expiresAt = admin.firestore.Timestamp.fromMillis(
          conference.dates.end.toMillis() + (24 * 60 * 60 * 1000)
        );
      } else {
        expiresAt = admin.firestore.Timestamp.fromMillis(
          admin.firestore.Timestamp.now().toMillis() + (7 * 24 * 60 * 60 * 1000)
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
      await sendBadgeNotification(db, { ...conference, id: confId }, regId, regData, token);

      functions.logger.info(`[BadgeToken-Ext] Created token ${token} and notified for ${regId}`);

      return null;
    } catch (error) {
      functions.logger.error(`[BadgeToken-Ext] Error for ${regId}:`, error);
      return null;
    }
  });

/**
 * Cloud Function: Send Notification to Registrations (Manual Send)
 * Called by admin to manually send AlimTalk to selected registrations
 * Key: Ensures badgePrepUrl contains valid token for each registration
 */
export const sendNotificationToRegistrations = functions
  .runWith({
    enforceAppCheck: false,
    ingressSettings: 'ALLOW_ALL'
  })
  .https.onCall(async (data, _context) => {
    const { confId, regIds, eventType } = data;

    if (!confId || !regIds || !Array.isArray(regIds) || regIds.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing confId or regIds');
    }

    if (!eventType) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing eventType');
    }

    try {
      const db = admin.firestore();
      const now = admin.firestore.Timestamp.now();

      // Get conference
      const confSnap = await db.collection('conferences').doc(confId).get();
      if (!confSnap.exists) {
        throw new Error('Conference not found');
      }
      const conference = confSnap.data();

      // Get societyId for notification-templates lookup
      const societyId = conference?.societyId;
      if (!societyId) {
        throw new Error('Society ID not found in conference');
      }

      // Check if notification template exists for this event
      const templatesQuery = await db.collection(`societies/${societyId}/notification-templates`)
        .where('eventType', '==', eventType)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (templatesQuery.empty) {
        throw new Error(`No active template found for event type: ${eventType}`);
      }

      const template = templatesQuery.docs[0].data();
      if (!template.channels?.kakao || template.channels.kakao.status !== 'APPROVED') {
        throw new Error(`Kakao channel not configured or not approved for event type: ${eventType}`);
      }

      // Process each registration
      const results = {
        total: regIds.length,
        success: 0,
        failed: 0,
        details: [] as Array<{ regId: string; success: boolean; error?: string }>
      };

      for (const regId of regIds) {
        try {
          // Determine collection (registrations or external_attendees)
          const collectionName = regId.startsWith('EXT-') ? 'external_attendees' : 'registrations';
          const regSnap = await db.collection(`conferences/${confId}/${collectionName}`).doc(regId).get();

          if (!regSnap.exists) {
            results.failed++;
            results.details.push({ regId, success: false, error: 'Registration not found' });
            continue;
          }

          const regData = regSnap.data();

          // Check or create token for badgePrepUrl
          let token: string;

          // Query existing ACTIVE token
          const existingTokensSnap = await db.collection(`conferences/${confId}/badge_tokens`)
            .where('registrationId', '==', regId)
            .where('status', '==', 'ACTIVE')
            .limit(1)
            .get();

          if (!existingTokensSnap.empty) {
            token = existingTokensSnap.docs[0].id;
          } else {
            // Create new token
            token = generateBadgePrepToken();

            // Calculate expiry
            let expiresAt: admin.firestore.Timestamp;
            if (conference?.dates?.end) {
              expiresAt = admin.firestore.Timestamp.fromMillis(
                conference.dates.end.toMillis() + (24 * 60 * 60 * 1000)
              );
            } else {
              expiresAt = admin.firestore.Timestamp.fromMillis(
                now.toMillis() + (7 * 24 * 60 * 60 * 1000)
              );
            }

            // Create token document
            await db.collection(`conferences/${confId}/badge_tokens`).doc(token).set({
              token,
              registrationId: regId,
              conferenceId: confId,
              userId: regData?.userId || regData?.uid || 'GUEST',
              status: 'ACTIVE',
              createdAt: now,
              expiresAt
            });

            functions.logger.info(`[ManualSend] Created new token ${token} for ${regId}`);
          }

          // Send notification with token (badgePrepUrl will be constructed inside)
          await sendBadgeNotification(db, conference, regId, regData, token);

          results.success++;
          results.details.push({ regId, success: true });
        } catch (error: unknown) {
          results.failed++;
          const message = error instanceof Error ? error.message : 'Unknown error';
          results.details.push({ regId, success: false, error: message });
          functions.logger.error(`[ManualSend] Failed for ${regId}:`, error);
        }
      }

      functions.logger.info(`[ManualSend] Completed: ${results.success}/${results.total} successful`);

      return {
        success: true,
        results
      };
    } catch (error: unknown) {
      functions.logger.error('[ManualSend] Error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new functions.https.HttpsError('internal', message);
    }
  });

