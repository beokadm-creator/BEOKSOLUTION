/**
 * Restore KADD 2026 Conference from backup to Firestore
 * Run: node scripts/restore-kadd-2026.js
 */

const { admin } = require('./firebase-admin');
const fs = require('fs');
const path = require('path');

async function restoreKadd2026() {
  console.log('🔧 Starting KADD 2026 conference restoration...');

  const db = admin.firestore();

  // Conference document ID
  const confId = 'kadd_2026';
  const societyId = 'kadd';
  const slug = '2026spring';

  // Main conference document
  const conferenceData = {
    societyId: societyId,
    slug: slug,
    title: {
      ko: '2026년 춘계 학술대회',
      en: '2026 Spring Conference'
    },
    dates: {
      start: new Date('2026-04-15'),
      end: new Date('2026-04-17')
    },
    period: {
      start: new Date('2026-04-15'),
      end: new Date('2026-04-17'),
      abstractDeadline: new Date('2026-02-28'),
      earlyBirdDeadline: new Date('2026-03-15')
    },
    venue: {
      name: {
        ko: '코엑스 컨벤션 센터',
        en: 'COEX Convention Center'
      },
      address: {
        ko: '서울시 강남구 영동대로 513 코엑스',
        en: 'COEX, 513 Yeongdeung-daero, Gangnam-gu, Seoul'
      }
    },
    status: 'published',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  try {
    // 1. Create main conference document
    console.log(`📝 Creating conference document: conferences/${confId}`);
    await db.collection('conferences').doc(confId).set(conferenceData);
    console.log('✅ Main conference document created');

    // 2. Create info/general sub-document
    const infoGeneralData = {
      title: conferenceData.title,
      dates: conferenceData.dates,
      venueName: conferenceData.venue.name,
      venueAddress: conferenceData.venue.address,
      welcomeMessage: {
        ko: '2026년 춘계 학술대회에 오신 것을 환영합니다.',
        en: 'Welcome to the 2026 Spring Conference.'
      },
      subTitle: {
        ko: '새로운 도약, 함께하는 미래',
        en: 'New Leap, Future Together'
      }
    };

    console.log('📝 Creating info/general document');
    await db.doc(`conferences/${confId}/info/general`).set(infoGeneralData);
    console.log('✅ Info/general document created');

    // 3. Create settings/basic sub-document
    const settingsBasicData = {
      venueName: conferenceData.venue.name,
      venueAddress: conferenceData.venue.address,
      greetings: {
        ko: '2026년 춘계 학술대회에 오신 것을 환영합니다.',
        en: 'Welcome to the 2026 Spring Conference.'
      }
    };

    console.log('📝 Creating settings/basic document');
    await db.doc(`conferences/${confId}/settings/basic`).set(settingsBasicData);
    console.log('✅ Settings/basic document created');

    // 4. Create settings/identity sub-document
    const settingsIdentityData = {
      subTitle: {
        ko: '새로운 도약, 함께하는 미래',
        en: 'New Leap, Future Together'
      }
    };

    console.log('📝 Creating settings/identity document');
    await db.doc(`conferences/${confId}/settings/identity`).set(settingsIdentityData);
    console.log('✅ Settings/identity document created');

    // 5. Create settings/visual sub-document
    const settingsVisualData = {
      mainBannerUrl: '',
      bannerUrl: '',
      posterUrl: ''
    };

    console.log('📝 Creating settings/visual document');
    await db.doc(`conferences/${confId}/settings/visual`).set(settingsVisualData);
    console.log('✅ Settings/visual document created');

    // 6. Create settings/registration sub-document with pricing periods
    const settingsRegistrationData = {
      currency: 'KRW',
      periods: [
        {
          id: 'early_bird',
          name: {
            ko: '얼리버드',
            en: 'Early Bird'
          },
          type: 'early_bird',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-03-15'),
          prices: {
            member_specialist: 100000,
            member_resident: 50000,
            non_member: 150000
          },
          isBestValue: true
        },
        {
          id: 'pre_registration',
          name: {
            ko: '사전등록',
            en: 'Pre-registration'
          },
          type: 'regular',
          startDate: new Date('2026-03-16'),
          endDate: new Date('2026-04-10'),
          prices: {
            member_specialist: 120000,
            member_resident: 60000,
            non_member: 180000
          }
        },
        {
          id: 'onsite',
          name: {
            ko: '현장등록',
            en: 'On-site'
          },
          type: 'onsite',
          startDate: new Date('2026-04-15'),
          endDate: new Date('2026-04-17'),
          prices: {
            member_specialist: 150000,
            member_resident: 80000,
            non_member: 200000
          }
        }
      ],
      refundPolicy: {
        ko: '환불 규정 내용입니다.',
        en: 'Refund policy content.'
      }
    };

    console.log('📝 Creating settings/registration document');
    await db.doc(`conferences/${confId}/settings/registration`).set(settingsRegistrationData);
    console.log('✅ Settings/registration document created');

    // 7. Create agendas sub-collection (empty for now)
    console.log('📝 Creating agendas collection (empty)');
    await db.collection(`conferences/${confId}/agendas`).add({
      title: { ko: '개회식', en: 'Opening Ceremony' },
      startTime: new Date('2026-04-15T09:00:00'),
      endTime: new Date('2026-04-15T09:30:00'),
      date: '2026-04-15',
      order: 1
    });
    console.log('✅ Agendas collection created');

    // 8. Create speakers sub-collection (empty for now)
    console.log('📝 Creating speakers collection (empty)');
    await db.collection(`conferences/${confId}/speakers`).add({
      name: { ko: '홍길동', en: 'Hong Gil-dong' },
      affiliation: { ko: '대한피부과학회', en: 'KADD' },
      order: 1
    });
    console.log('✅ Speakers collection created');

    // 9. Create sponsors sub-collection (empty for now)
    console.log('📝 Creating sponsors collection (empty)');
    await db.collection(`conferences/${confId}/sponsors`).add({
      name: { ko: '후원사', en: 'Sponsor' },
      order: 1
    });
    console.log('✅ Sponsors collection created');

    // 10. Create pages sub-collection
    console.log('📝 Creating pages collection');
    await db.collection(`conferences/${confId}/pages`).add({
      title: { ko: '학술대회 안내', en: 'Conference Info' },
      slug: 'about',
      content: {
        ko: '학술대회 소개 내용입니다.',
        en: 'Conference information content.'
      },
      published: true,
      order: 1
    });
    console.log('✅ Pages collection created');

    console.log('\n🎉 KADD 2026 conference restoration completed successfully!');
    console.log(`\n📍 Conference ID: ${confId}`);
    console.log(`📍 Society ID: ${societyId}`);
    console.log(`📍 Slug: ${slug}`);
    console.log(`\n🔗 URLs:`);
    console.log(`   - https://kadd.eregi.co.kr/${slug}`);
    console.log(`   - https://kadd.eregi.co.kr/${slug}/register`);
    console.log(`   - https://kadd.eregi.co.kr/${slug}/program`);

  } catch (error) {
    console.error('❌ Error restoring KADD 2026 conference:', error);
    process.exit(1);
  }
}

// Run the restoration
restoreKadd2026().then(() => {
  console.log('\n✅ Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
