import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

/**
 * RESTORE KADD 2026SPRING (FULL RESTORE)
 * 
 * Restores Main Document + Settings + Basic Subcollections.
 * Visit: https://us-central1-eregi-8fc1e.cloudfunctions.net/restoreKadd2026
 */

export const restoreKadd2026 = functions.https.onRequest(async (req, res) => {
  const db = admin.firestore();
  const confId = 'kadd_2026spring';
  const societyId = 'kadd';
  const slug = '2026spring';

  try {
    console.log(`[Restore] Full restoration for ${confId}...`);

    // 1. MAIN DOCUMENT
    const mainDocData = {
      societyId: societyId,
      slug: slug,
      title: {
        ko: '2026년 춘계 학술대회',
        en: '2026 Spring Conference'
      },
      dates: {
        start: admin.firestore.Timestamp.fromDate(new Date('2026-04-15')),
        end: admin.firestore.Timestamp.fromDate(new Date('2026-04-17'))
      },
      period: {
        start: admin.firestore.Timestamp.fromDate(new Date('2026-04-15')),
        end: admin.firestore.Timestamp.fromDate(new Date('2026-04-17')),
        abstractDeadline: admin.firestore.Timestamp.fromDate(new Date('2026-02-28')),
        earlyBirdDeadline: admin.firestore.Timestamp.fromDate(new Date('2026-03-15'))
      },
      i18n: {
        default: 'ko',
        available: ['ko', 'en'],
        fallback: 'ko'
      },
      theme: {
        primary: '#003366',
        secondary: '#002244',
        accent: '#24669e',
        background: '#f0f5fa',
        text: '#1a202c',
        border: '#e2e8f0'
      },
      features: {
        showAbstract: true,
        showWideHero: true,
        showRegistration: true,
        showSchedule: true,
        showSpeakers: true,
        multiLanguageSupport: true,
        earlyBirdEnabled: true,
        onlineAttendance: false
      },
      venue: {
        name: {
          ko: '코엑스 컨벤션 센터, 서울',
          en: 'COEX Convention Center, Seoul'
        },
        address: {
          ko: '서울시 강남구 영동대로 513 코엑스',
          en: 'COEX, 513 Yeongdeung-daero, Gangnam-gu, Seoul'
        },
        mapUrl: 'https://www.coex.co.kr/'
      },
      status: 'published',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('conferences').doc(confId).set(mainDocData, { merge: true });

    // 2. SETTINGS/REGISTRATION (Critical for Payment)
    const registrationSettings = {
      periods: [
        {
          id: 'early_bird',
          name: { ko: '얼리버드', en: 'Early Bird' },
          type: 'EARLY',
          startDate: admin.firestore.Timestamp.fromDate(new Date('2026-01-01')),
          endDate: admin.firestore.Timestamp.fromDate(new Date('2026-03-15')),
          prices: {
            'Member (Specialist)': 100000,
            'Member (Resident)': 50000,
            'Non-Member': 150000,
            // Add mapped keys for easier matching if needed
            'member_specialist': 100000,
            'member_resident': 50000,
            'non_member': 150000
          },
          isBestValue: true
        },
        {
          id: 'pre_registration',
          name: { ko: '사전등록', en: 'Pre-registration' },
          type: 'REGULAR',
          startDate: admin.firestore.Timestamp.fromDate(new Date('2026-03-16')),
          endDate: admin.firestore.Timestamp.fromDate(new Date('2026-04-10')),
          prices: {
            'Member (Specialist)': 120000,
            'Member (Resident)': 60000,
            'Non-Member': 180000,
            'member_specialist': 120000,
            'member_resident': 60000,
            'non_member': 180000
          }
        },
        {
          id: 'onsite',
          name: { ko: '현장등록', en: 'On-site' },
          type: 'ONSITE',
          startDate: admin.firestore.Timestamp.fromDate(new Date('2026-04-15')),
          endDate: admin.firestore.Timestamp.fromDate(new Date('2026-04-17')),
          prices: {
            'Member (Specialist)': 150000,
            'Member (Resident)': 80000,
            'Non-Member': 200000,
            'member_specialist': 150000,
            'member_resident': 80000,
            'non_member': 200000
          }
        }
      ],
      refundPolicy: '환불 규정: 2026년 4월 1일까지 100% 환불, 이후 환불 불가.'
    };
    await db.doc(`conferences/${confId}/settings/registration`).set(registrationSettings, { merge: true });

    // 3. SETTINGS/BASIC & IDENTITY (Visuals)
    await db.doc(`conferences/${confId}/settings/basic`).set({
      venueName: mainDocData.venue.name,
      venueAddress: mainDocData.venue.address
    }, { merge: true });

    await db.doc(`conferences/${confId}/settings/identity`).set({
      subTitle: { ko: '새로운 도약, 함께하는 미래', en: 'New Leap, Future Together' }
    }, { merge: true });

    // 4. RESTORE AGENDAS (Sample from backup + common structure)
    // Only add if empty to avoid duplicates on re-run
    const agendaRef = db.collection(`conferences/${confId}/agendas`);
    const agendaSnap = await agendaRef.limit(1).get();
    if (agendaSnap.empty) {
      await agendaRef.add({
        title: { ko: '개회식', en: 'Opening Ceremony' },
        startTime: admin.firestore.Timestamp.fromDate(new Date('2026-04-15T09:00:00')),
        endTime: admin.firestore.Timestamp.fromDate(new Date('2026-04-15T09:30:00')),
        date: '2026-04-15',
        order: 1
      });
      await agendaRef.add({
        title: { ko: '기조 강연', en: 'Keynote Speech' },
        startTime: admin.firestore.Timestamp.fromDate(new Date('2026-04-15T10:00:00')),
        endTime: admin.firestore.Timestamp.fromDate(new Date('2026-04-15T11:00:00')),
        date: '2026-04-15',
        speakers: ['Hong Gil-dong'],
        order: 2
      });
    }

    // 5. RESTORE SPONSORS (Sample)
    const sponsorRef = db.collection(`conferences/${confId}/sponsors`);
    const sponsorSnap = await sponsorRef.limit(1).get();
    if (sponsorSnap.empty) {
      await sponsorRef.add({
        name: 'Sponsor A',
        level: 'Platinum',
        order: 1
      });
      await sponsorRef.add({
        name: 'Sponsor B',
        level: 'Gold',
        order: 2
      });
    }

    console.log(`[Restore] Successfully restored ALL data for ${confId}`);
    res.status(200).send(`<h1>Success!</h1><p>Full restoration complete for <b>${confId}</b> (Settings, Pricing, Samples).</p><p>Try converting to 30,000 KRW again.</p>`);

  } catch (error) {
    console.error('[Restore] Failed:', error);
    res.status(500).send(`Restoration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});
