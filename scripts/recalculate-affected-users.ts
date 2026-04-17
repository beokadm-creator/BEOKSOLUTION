/**
 * 데이터 구제 스크립트: 0분 버그로 인해 손실된 참석 시간 복구
 *
 * 문제: 2026-04-17 (오늘)에 EXIT한 사용자들이 0분으로 기록됨
 * 원인: allZonesRef.current.find()가 2026-04-16의 zone을 반환하여 zone end time이 과거가 됨
 *
 * 해결: access_logs를 읽어서 실제 ENTER/EXIT 시간으로 다시 계산
 */

import * as admin from 'firebase-admin';

// Firebase Admin 초기화 필요
// admin.initializeApp();

const db = admin.firestore();
const confId = 'YOUR_CONF_ID';  // ← 수정 필요: 대한구강악안면외과학회 confId
const targetDate = '2026-04-17';  // 영향 받은 날짜

interface AccessLog {
  action: 'ENTRY' | 'EXIT';
  registrationId: string;
  zoneId: string;
  timestamp: admin.firestore.Timestamp;
  method: string;
  recognizedMinutes?: number;
  accumulatedTotal?: number;
}

/**
 * 단일 사용자의 참석 시간 재계산
 */
async function recalculateUser(
  registrationId: string,
  isExternal: boolean = false
): Promise<{ success: boolean; corrected: number; error?: string }> {
  const collectionName = isExternal ? 'external_attendees' : 'registrations';
  const regRef = db.doc(`conferences/${confId}/${collectionName}/${registrationId}`);
  const logsRef = db.collection(`conferences/${confId}/${collectionName}/${registrationId}/logs`);

  try {
    // 1. 현재 상태 읽기
    const regSnap = await regRef.get();
    if (!regSnap.exists) return { success: false, corrected: 0, error: 'Registration not found' };

    const currentTotal = regSnap.data()?.totalMinutes || 0;

    // 2. 오늘의 로그 읽기 (access_logs는 안 쓰고, logs 서브컬렉션 사용)
    const todayLogsSnap = await logsRef
      .where('date', '==', targetDate)
      .orderBy('timestamp', 'asc')
      .get();

    if (todayLogsSnap.empty) {
      return { success: false, corrected: 0, error: 'No logs for today' };
    }

    // 3. ENTER/EXIT 페어로 재계산
    const logs = todayLogsSnap.docs.map(doc => ({
      type: doc.data().type,
      zoneId: doc.data().zoneId,
      timestamp: doc.data().timestamp.toDate(),
      rawDuration: doc.data().rawDuration || 0,
      recognizedMinutes: doc.data().recognizedMinutes || 0
    }));

    let recalculatedTotal = 0;
    let entryTime: Date | null = null;

    for (const log of logs) {
      if (log.type === 'ENTER') {
        entryTime = log.timestamp;
      } else if (log.type === 'EXIT' && entryTime) {
        const duration = Math.floor((log.timestamp.getTime() - entryTime.getTime()) / 60000);
        // Zone rule의 break time은 적용 어려움 - raw duration 사용
        recalculatedTotal += Math.max(0, duration);
        entryTime = null;
      }
    }

    // 4. 영향 받은 사용자인지 확인 (오늘의 로그에서 0분인 EXIT가 있는지)
    const hasZeroMinuteExit = logs.some(
      log => log.type === 'EXIT' && log.recognizedMinutes === 0
    );

    if (!hasZeroMinuteExit) {
      return { success: false, corrected: 0, error: 'Not affected by bug' };
    }

    // 5. 복구가 필요한지 확인
    const difference = recalculatedTotal - currentTotal;

    if (difference <= 0) {
      console.log(`[${registrationId}] Current: ${currentTotal}m, Recalculated: ${recalculatedTotal}m - No correction needed`);
      return { success: true, corrected: 0 };
    }

    console.log(`[${registrationId}] Current: ${currentTotal}m, Recalculated: ${recalculatedTotal}m, Difference: ${difference}m`);

    // 6. 데이터 업데이트 (dry-run mode - 실제 실행 시 주석 해제)
    /*
    await regRef.update({
      totalMinutes: recalculatedTotal,
      [`dailyMinutes.${targetDate}`]: recalculatedTotal
    });

    // 영향 받은 로그 업데이트 (recognizedMinutes = 0인 것들)
    const batch = db.batch();
    let correctedCount = 0;

    for (const logDoc of todayLogsSnap.docs) {
      const logData = logDoc.data();
      if (logData.type === 'EXIT' && logData.recognizedMinutes === 0) {
        // 이전 ENTER 찾기
        const prevLog = logs.find((l, i) =>
          l.type === 'ENTER' &&
          logs[i + 1] === logData
        );

        if (prevLog) {
          const duration = Math.floor((logData.timestamp.toDate().getTime() - prevLog.timestamp.getTime()) / 60000);
          batch.update(logDoc.ref, {
            rawDuration: duration,
            recognizedMinutes: Math.max(0, duration),
            correctionNote: 'Recalculated via script on ' + new Date().toISOString()
          });
          correctedCount++;
        }
      }
    }

    await batch.commit();
    */

    return { success: true, corrected: difference };

  } catch (error: any) {
    console.error(`[${registrationId}] Error:`, error);
    return { success: false, corrected: 0, error: error.message };
  }
}

/**
 * 전체 영향 받은 사용자 찾기 및 복구
 */
async function recalculateAllAffectedUsers() {
  console.log('='.repeat(60));
  console.log('데이터 구제 시작: 0분 버그 복구');
  console.log(`대상 날짜: ${targetDate}`);
  console.log(`Conference: ${confId}`);
  console.log('='.repeat(60));

  // 1. 오늘 0분 EXIT 로그가 있는 사용자 찾기
  const accessLogsRef = db.collection(`conferences/${confId}/access_logs`);
  const zeroMinuteExitsSnap = await accessLogsRef
    .where('date', '==', targetDate)
    .where('action', '==', 'EXIT')
    .where('recognizedMinutes', '==', 0)
    .get();

  console.log(`\n발견된 0분 EXIT: ${zeroMinuteExitsSnap.size}건`);

  const affectedUsers = new Set<string>();
  const affectedExternals = new Set<string>();

  zeroMinuteExitsSnap.docs.forEach(doc => {
    const data = doc.data();
    const regId = data.registrationId;
    const isExt = data.isExternal;

    if (isExt) {
      affectedExternals.add(regId);
    } else {
      affectedUsers.add(regId);
    }
  });

  console.log(`영향 받은 registration: ${affectedUsers.size}명`);
  console.log(`영향 받은 external_attendee: ${affectedExternals.size}명`);

  // 2. 각 사용자별 재계산
  let totalCorrected = 0;
  let errorCount = 0;
  const corrections: Array<{ id: string; from: number; to: number; diff: number }> = [];

  console.log('\n재계산 시작...\n');

  for (const regId of affectedUsers) {
    const result = await recalculateUser(regId, false);
    if (result.success && result.corrected > 0) {
      totalCorrected += result.corrected;
      corrections.push({
        id: regId,
        from: 0,  // 현재 totalMinutes를 확인하려면 추가 코드 필요
        to: result.corrected,
        diff: result.corrected
      });
    } else if (!result.success) {
      errorCount++;
    }
  }

  for (const extId of affectedExternals) {
    const result = await recalculateUser(extId, true);
    if (result.success && result.corrected > 0) {
      totalCorrected += result.corrected;
      corrections.push({
        id: extId,
        from: 0,
        to: result.corrected,
        diff: result.corrected
      });
    } else if (!result.success) {
      errorCount++;
    }
  }

  // 3. 결과 요약
  console.log('\n' + '='.repeat(60));
  console.log('복구 결과 요약');
  console.log('='.repeat(60));
  console.log(`총 복구 분: ${totalCorrected}분`);
  console.log(`오류 발생: ${errorCount}건`);
  console.log('\n상세 내역:');
  corrections.forEach(c => {
    console.log(`  ${c.id}: +${c.diff}분`);
  });

  return {
    affectedCount: affectedUsers.size + affectedExternals.size,
    totalCorrected,
    errorCount,
    corrections
  };
}

// 실행: node scripts/recalculate-affected-users.js
// 주의: 실제 업데이트를 하려면 recalculateUser() 내의 주석 해제 필요
// 현재는 dry-run 모드로만 계산 결과 출력

if (require.main === module) {
  recalculateAllAffectedUsers()
    .then(result => {
      console.log('\n완료. 결과를 확인 후 주석을 해제하여 실제 업데이트를 실행하세요.');
      process.exit(0);
    })
    .catch(error => {
      console.error('실패:', error);
      process.exit(1);
    });
}

export { recalculateUser, recalculateAllAffectedUsers };
