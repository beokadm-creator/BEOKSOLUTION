import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { formatInTimeZone } from 'date-fns-tz';
import { ko } from 'date-fns/locale';
import { sendAlimTalk } from '../services/notificationService';

// Local type definitions (aligned with schema.ts)
interface Conference {
  id: string;
  conferenceId?: string;
  societyId: string;
  slug?: string;
  title: { ko: string; en?: string };
  dates?: {
    start: admin.firestore.Timestamp;
    end: admin.firestore.Timestamp;
  };
  venue?: {
    name: { ko: string; en?: string } | string;
  };
}

interface Registration {
  name?: string;
  email?: string;
  phone?: string;
  affiliation?: string;
  organization?: string;
  licenseNumber?: string;
  userInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    affiliation?: string;
    licenseNumber?: string;
  };
  badgeIssued?: boolean;
  badgeQr?: string | null;
  attendanceStatus?: string;
  currentZone?: string;
  totalMinutes?: number;
  receiptNumber?: string;
  confirmationQr?: string;
  userId?: string;
  paymentStatus?: string;
  status?: string;
}

interface ExternalAttendee extends Registration {
  uid?: string;
}



/**
 * Generate a secure random token for badge prep
 */
export function generateBadgePrepToken(): string {
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
      const conference = confSnap.data() as Conference | undefined;

      // Set token expiry to conference end date + 1 day
      let expiresAt: admin.firestore.Timestamp;
      if (conference?.dates?.end) {
        expiresAt = admin.firestore.Timestamp.fromMillis(
          conference.dates.end.toMillis() + (48 * 60 * 60 * 1000) // 2 days after conference end to reliably cover the entire next day
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
      if (conference) {
        await sendBadgeNotification(db, conference, regId, regData, token);
      }

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
export async function sendBadgeNotification(
  db: admin.firestore.Firestore,
  conference: Conference,
  regId: string,
  regData: Registration | ExternalAttendee,
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

        // Society Info
        const societySnap = await db.collection('societies').doc(conference.societyId).get();
        const societyData = societySnap.data();
        const societyName = societyData?.name?.ko || societyData?.name?.en || conference.societyId;

        // Event Info
        const eventName = conference.title?.ko || conference.title?.en || '';
        const timeZone = 'Asia/Seoul'; // Default for Korean conferences

        // dates.start 또는 구버전 startDate 필드에서 시작 시간을 가져옴
        const rawStartTimestamp = conference.dates?.start || (conference as any).startDate;
        functions.logger.info(`[BadgeNotification] rawStartTimestamp:`, JSON.stringify({
          hasDatesStart: !!conference.dates?.start,
          hasStartDate: !!(conference as any).startDate,
          rawValue: rawStartTimestamp ? rawStartTimestamp.toDate?.()?.toISOString() : null
        }));

        const startDate = rawStartTimestamp && typeof rawStartTimestamp.toDate === 'function'
          ? formatInTimeZone(rawStartTimestamp.toDate(), timeZone, 'yyyy-MM-dd HH:mm', { locale: ko })
          : '';

        const venueName = typeof conference.venue?.name === 'object'
          ? (conference.venue.name.ko || conference.venue.name.en || '')
          : (conference.venue?.name || '');

        // URL Construction
        const domain = `https://${conference.societyId}.eregi.co.kr`;
        const redirectSlug = conference.id || conference.slug || conference.conferenceId;
        const badgePrepUrl = `${domain}/${redirectSlug}/badge-prep/${token}`;
        const digitalBadgeQrUrl = `${domain}/${redirectSlug}/badge-prep/${token}`;
        const affiliation = regData.organization || regData.affiliation || regData.userInfo?.affiliation || '';

        // Variables Map
        const variables: { [key: string]: string } = {
          userName: regData.name || regData.userInfo?.name || '',
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

        // Send (NHN AlimTalk via NotificationService)
        const recipientPhone = regData.phone || regData.userInfo?.phone;
        if (recipientPhone) {
          const cleanPhone = recipientPhone.replace(/-/g, '');

          const alimTalkResult = await sendAlimTalk({
            phone: cleanPhone,
            templateCode: kakaoConfig.kakaoTemplateCode,
            variables: variables
            // NotificationService already formats and sends these variables properly as templateParameter
            // We omit buttons parameter as NHN AlimTalk uses the template variables to auto-fill button urls
          }, conference.societyId);

          functions.logger.info(`[BadgeNotification] AlimTalk call result to ${cleanPhone}:`, JSON.stringify(alimTalkResult));
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        const conference = confSnap.data() as Conference | undefined;

        let newExpiresAt: admin.firestore.Timestamp;
        if (conference?.dates?.end) {
          newExpiresAt = admin.firestore.Timestamp.fromMillis(
            conference.dates.end.toMillis() + (48 * 60 * 60 * 1000)
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

      // If token was manually expired (e.g. resent), attempt to redirect to the new active/issued token
      if (tokenData.status === 'EXPIRED') {
        const activeTokensSnap = await db.collection(`conferences/${confId}/badge_tokens`)
          .where('registrationId', '==', tokenData.registrationId)
          .where('status', 'in', ['ACTIVE', 'ISSUED'])
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();

        if (!activeTokensSnap.empty) {
          const newToken = activeTokensSnap.docs[0].id;
          functions.logger.info(`[BadgeToken] Found active token ${newToken} for expired request ${token}`);
          return {
            valid: true,
            tokenStatus: 'ACTIVE',
            newToken,
            redirectRequired: true,
            registration: {
              id: tokenData.registrationId,
              name: '', email: '', phone: '', affiliation: '', licenseNumber: '',
              confirmationQr: '', badgeQr: null, badgeIssued: false, attendanceStatus: 'OUTSIDE',
              currentZone: null, totalMinutes: 0, receiptNumber: ''
            }
          };
        }
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
          confirmationQr: regData.confirmationQr || regSnap.id,  // fallback to regId for external_attendees without confirmationQr
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
  .https.onCall(async (data) => {
    const { confId, regId } = data;

    if (!confId || !regId) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing confId or regId');
    }

    try {
      const db = admin.firestore();
      const now = admin.firestore.Timestamp.now();

      // Get existing registration (check both collections)
      let isExternalAttendee = false;
      let regSnap = await db.collection(`conferences/${confId}/registrations`).doc(regId).get();

      if (!regSnap.exists) {
        regSnap = await db.collection(`conferences/${confId}/external_attendees`).doc(regId).get();
        if (regSnap.exists) {
          isExternalAttendee = true;
        }
      }

      if (!regSnap.exists) {
        throw new Error('Registration not found');
      }

      const regData = regSnap.data();
      if (!regData) {
        throw new Error('Registration data invalid');
      }

      // [FIX] External attendees are manually added by admin, so they bypass PAID check
      if (!isExternalAttendee && regData.paymentStatus !== 'PAID' && regData.status !== 'PAID') {
        throw new Error('Registration not paid');
      }

      // Get conference for expiry date
      const confSnap = await db.collection('conferences').doc(confId).get();
      const conference = confSnap.data() as Conference | undefined;

      // Set token expiry to conference end date + 2 days
      let expiresAt: admin.firestore.Timestamp;
      if (conference?.dates?.end) {
        expiresAt = admin.firestore.Timestamp.fromMillis(
          conference.dates.end.toMillis() + (48 * 60 * 60 * 1000)
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
      if (conference) {
        await sendBadgeNotification(db, conference, regId, regData, newToken);
      }

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
 * Cloud Function: Bulk Send AlimTalk Notifications (Server-side batch)
 *
 * 브라우저가 닫혀도 서버에서 안전하게 처리됩니다.
 * 1) 각 등록자별 토큰을 30개 병렬로 생성 (Firestore write)
 * 2) NHN Cloud API에 최대 1,000명씩 1회 배치 호출
 * 3) 결과를 conferences/{confId}/notification_logs에 저장
 */
export const bulkSendNotifications = functions
  .runWith({
    timeoutSeconds: 540,   // 9분 (Firebase v1 최대값)
    memory: '512MB',
    enforceAppCheck: false,
    ingressSettings: 'ALLOW_ALL'
  })
  .https.onCall(async (data) => {
    const { confId, regIds } = data;

    if (!confId || !Array.isArray(regIds) || regIds.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'confId and regIds[] are required');
    }

    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    // 1. Conference 정보 조회
    const confSnap = await db.collection('conferences').doc(confId).get();
    if (!confSnap.exists) throw new functions.https.HttpsError('not-found', 'Conference not found');
    const conference = { id: confSnap.id, ...confSnap.data() } as Conference;
    if (!conference.societyId) throw new functions.https.HttpsError('failed-precondition', 'Conference missing societyId');

    // 2. 알림톡 템플릿 조회
    const templatesQuery = await db
      .collection(`societies/${conference.societyId}/notification-templates`)
      .where('eventType', '==', 'CONFERENCE_REGISTER')
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (templatesQuery.empty) {
      throw new functions.https.HttpsError('not-found', 'No active CONFERENCE_REGISTER template');
    }
    const kakaoConfig = templatesQuery.docs[0].data().channels?.kakao;
    if (!kakaoConfig || kakaoConfig.status !== 'APPROVED' || !kakaoConfig.kakaoTemplateCode) {
      throw new functions.https.HttpsError('failed-precondition', 'No approved AlimTalk template configured');
    }

    // 3. NHN Cloud 설정 조회
    const infraSnap = await db.collection('societies').doc(conference.societyId).collection('settings').doc('infrastructure').get();
    const nhnConfig = infraSnap.data()?.notification;
    const appKey = nhnConfig?.appKey || 'Ik6GEBC22p5Qliqk';
    const secretKey = nhnConfig?.secretKey || 'ajFUrusk8I7tgBQdrztuQvcf6jgWWcme';
    const senderKey = nhnConfig?.senderKey;
    if (!senderKey) throw new functions.https.HttpsError('failed-precondition', 'NHN senderKey not configured');

    // 4. Society / Conference 메타데이터  
    const societySnap = await db.collection('societies').doc(conference.societyId).get();
    const societyName = societySnap.data()?.name?.ko || societySnap.data()?.name?.en || conference.societyId;
    const eventName = conference.title?.ko || conference.title?.en || '';
    const domain = `https://${conference.societyId}.eregi.co.kr`;
    const redirectSlug = conference.id || (conference as any).slug || (conference as any).conferenceId;
    const timeZone = 'Asia/Seoul';
    const rawStart = conference.dates?.start || (conference as any).startDate;
    const startDate = rawStart && typeof rawStart.toDate === 'function'
      ? formatInTimeZone(rawStart.toDate(), timeZone, 'yyyy-MM-dd HH:mm', { locale: ko })
      : '';
    const venueName = typeof conference.venue?.name === 'object'
      ? ((conference.venue.name as any).ko || (conference.venue.name as any).en || '')
      : (conference.venue?.name || '');
    let expiresAt: admin.firestore.Timestamp;
    if (conference.dates?.end) {
      expiresAt = admin.firestore.Timestamp.fromMillis(conference.dates.end.toMillis() + 48 * 3600 * 1000);
    } else {
      expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + 7 * 24 * 3600 * 1000);
    }

    // 5. 각 등록자별 토큰 생성 (30개 병렬)
    const nhnRecipients: Array<{ recipientNo: string; templateParameter: Record<string, string> }> = [];
    let tokenGenerated = 0;
    let skipped = 0;
    let tokenErrors = 0;

    const CONCURRENCY = 30;
    for (let i = 0; i < regIds.length; i += CONCURRENCY) {
      const chunk: string[] = regIds.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.allSettled(chunk.map(async (regId: string) => {
        try {
          // registration 또는 external_attendees 에서 조회
          let isExternal = false;
          let regSnap = await db.collection(`conferences/${confId}/registrations`).doc(regId).get();
          if (!regSnap.exists) {
            regSnap = await db.collection(`conferences/${confId}/external_attendees`).doc(regId).get();
            if (regSnap.exists) isExternal = true;
          }
          if (!regSnap.exists) return null;

          const regData = regSnap.data() as Registration;
          if (!isExternal && regData.paymentStatus !== 'PAID' && regData.status !== 'PAID') return null;

          const phone = (regData.phone || regData.userInfo?.phone || '').replace(/[^0-9]/g, '');
          if (!phone) return null;

          // 기존 ACTIVE 토큰 만료 처리 + 새 토큰 생성을 Batch write로
          const oldTokens = await db
            .collection(`conferences/${confId}/badge_tokens`)
            .where('registrationId', '==', regId)
            .where('status', '==', 'ACTIVE')
            .get();

          const batch = db.batch();
          oldTokens.docs.forEach(t => batch.update(t.ref, { status: 'EXPIRED', updatedAt: now }));
          const newToken = generateBadgePrepToken();
          const tokenRef = db.collection(`conferences/${confId}/badge_tokens`).doc(newToken);
          batch.set(tokenRef, {
            token: newToken,
            registrationId: regId,
            conferenceId: confId,
            userId: regData.userId || 'GUEST',
            status: 'ACTIVE',
            createdAt: now,
            expiresAt
          });
          await batch.commit();

          const badgePrepUrl = `${domain}/${redirectSlug}/badge-prep/${newToken}`;
          const affiliation = regData.organization || regData.affiliation || regData.userInfo?.affiliation || '';

          return {
            recipientNo: phone,
            templateParameter: {
              userName: regData.name || regData.userInfo?.name || '',
              society: societyName,
              eventName,
              badgePrepUrl,
              digitalBadgeQrUrl: badgePrepUrl,
              organization: affiliation,
              affiliation,
              registrationId: regId,
              startDate,
              venue: venueName,
            }
          };
        } catch (err) {
          functions.logger.error(`[BulkSend] Token error for ${regId}:`, err);
          return null;
        }
      }));

      for (const result of chunkResults) {
        if (result.status === 'fulfilled' && result.value) {
          nhnRecipients.push(result.value);
          tokenGenerated++;
        } else if (result.status === 'rejected') {
          tokenErrors++;
        } else {
          skipped++;
        }
      }
    }

    functions.logger.info(`[BulkSend] Tokens ready: ${tokenGenerated}, skipped: ${skipped}, errors: ${tokenErrors}`);

    // 6. NHN Cloud 배치 발송 (최대 1,000명씩)
    const { sendAlimTalkBatch } = require('../utils/nhnCloud');
    let totalSent = 0;
    let totalFailed = 0;
    const NHN_CHUNK = 1000;

    for (let i = 0; i < nhnRecipients.length; i += NHN_CHUNK) {
      const slice = nhnRecipients.slice(i, i + NHN_CHUNK);
      try {
        const batchResult = await sendAlimTalkBatch(
          { appKey, secretKey, senderKey },
          slice,
          kakaoConfig.kakaoTemplateCode
        );
        totalSent += batchResult.successCount;
        totalFailed += batchResult.failCount;
        functions.logger.info(`[BulkSend] Batch ${i / NHN_CHUNK + 1}: sent=${batchResult.successCount}, failed=${batchResult.failCount}`);
      } catch (err) {
        functions.logger.error(`[BulkSend] Batch ${i / NHN_CHUNK + 1} failed:`, err);
        totalFailed += slice.length;
      }
    }

    // 7. 발송 이력 Firestore 저장
    await db.collection(`conferences/${confId}/notification_logs`).add({
      type: 'BULK_ALIMTALK',
      templateCode: kakaoConfig.kakaoTemplateCode,
      totalRequested: regIds.length,
      tokenGenerated,
      skipped: skipped + tokenErrors,
      sent: totalSent,
      failed: totalFailed,
      sentAt: now,
      createdAt: now
    });

    functions.logger.info(`[BulkSend] Complete — sent: ${totalSent}, failed: ${totalFailed}`);

    return {
      success: true,
      totalRequested: regIds.length,
      tokenGenerated,
      skipped: skipped + tokenErrors,
      sent: totalSent,
      failed: totalFailed
    };
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
      const conference = confSnap.data() as Conference | undefined;

      // Set token expiry
      let expiresAt: admin.firestore.Timestamp;
      if (conference?.dates?.end) {
        expiresAt = admin.firestore.Timestamp.fromMillis(
          conference.dates.end.toMillis() + (48 * 60 * 60 * 1000)
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

      // Update external attendee doc - set confirmationQr same as regId (for InfoDesk scanning)
      await db.collection(`conferences/${confId}/external_attendees`).doc(regId).update({
        confirmationQr: regId,  // Used by BadgePrepPage for voucher QR code
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
    } catch (error) {
      functions.logger.error(`[BadgeToken-Ext] Error for ${regId}:`, error);
      return null;
    }
  });
