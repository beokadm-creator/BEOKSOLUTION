import {
  collection,
  query,
  where,
  getDocs,
  doc,
  writeBatch,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * KADD 2026 Spring 출결 데이터 정리 스크립트
 * 
 * 사용법:
 * 1. 관리자 페이지에서 이 스크립트 실행
 * 2. conferenceId를 kadd_2026spring으로 설정
 * 3. 안전한 환경에서 먼저 테스트 후 운영에 적용
 */

export class AttendanceDataCleanup {
  /**
   * 고아 데이터 정리 - 등록자가 없는 access_logs 정리
   */
  static async cleanupOrphanedAccessLogs(conferenceId: string) {
    console.log(`🧹 시작: 고아 access_logs 정리 (${conferenceId})`);
    
    try {
      // 1. 현재 유효한 등록자 목록 가져오기
      const registrationsRef = collection(db, 'conferences', conferenceId, 'registrations');
      const registrationsSnap = await getDocs(registrationsRef);
      const validRegistrationIds = new Set(
        registrationsSnap.docs.map(doc => doc.id)
      );
      
      console.log(`✅ 유효한 등록자: ${validRegistrationIds.size}명`);

      // 2. 전체 access_logs 확인
      const accessLogsRef = collection(db, 'conferences', conferenceId, 'access_logs');
      const accessLogsSnap = await getDocs(accessLogsRef);
      
      let orphanedCount = 0;
      const batch = writeBatch(db);
      let batchCount = 0;

      for (const logDoc of accessLogsSnap.docs) {
        const logData = logDoc.data();
        
        // scannedQr를 통해 registration 찾기
        if (logData.scannedQr) {
          const registrationQuery = query(
            collection(db, 'conferences', conferenceId, 'registrations'),
            where('badgeQr', '==', logData.scannedQr)
          );
          const registrationSnap = await getDocs(registrationQuery);
          
          if (registrationSnap.empty) {
            // 고아 데이터 발견
            batch.delete(logDoc.ref);
            batchCount++;
            orphanedCount++;
            
            console.log(`🗑️ 고아 로그 삭제: ${logDoc.id} (QR: ${logData.scannedQr})`);
            
            // Firestore batch 제한 (500개)
            if (batchCount >= 400) {
              await batch.commit();
              console.log(`✅ Batch 완료: ${batchCount}개 삭제`);
              batchCount = 0;
            }
          }
        }
      }

      // 남은 batch 실행
      if (batchCount > 0) {
        await batch.commit();
        console.log(`✅ 최종 Batch 완료: ${batchCount}개 삭제`);
      }

      console.log(`🎉 고아 access_logs 정리 완료: ${orphanedCount}개 삭제`);
      return orphanedCount;

    } catch (error) {
      console.error('❌ 고아 access_logs 정리 실패:', error);
      throw error;
    }
  }

  /**
   * 등록자별 로그 정리 - 존재하지 않는 등록자의 로그 정리
   */
  static async cleanupOrphanedRegistrationLogs(conferenceId: string) {
    console.log(`🧹 시작: 고아 registration logs 정리 (${conferenceId})`);
    
    try {
      // 1. 유효한 등록자 목록
      const registrationsRef = collection(db, 'conferences', conferenceId, 'registrations');
      const registrationsSnap = await getDocs(registrationsRef);
      const validRegistrationIds = new Set(
        registrationsSnap.docs.map(doc => doc.id)
      );

      let totalDeleted = 0;

      // 2. 각 등록자의 로그 서브컬렉션 확인
      for (const regId of validRegistrationIds) {
        try {
          const logsRef = collection(db, 'conferences', conferenceId, 'registrations', regId, 'logs');
          const logsSnap = await getDocs(logsRef);
          
          let orphanedLogsCount = 0;
          const batch = writeBatch(db);

          for (const logDoc of logsSnap.docs) {
            // 등록자가 존재하는지 다시 확인
            const registrationDoc = await getDoc(
              doc(db, 'conferences', conferenceId, 'registrations', regId)
            );
            
            if (!registrationDoc.exists()) {
              batch.delete(logDoc.ref);
              orphanedLogsCount++;
              totalDeleted++;
            }
          }

          if (orphanedLogsCount > 0) {
            await batch.commit();
            console.log(`🗑️ ${regId}의 고아 로그 ${orphanedLogsCount}개 삭제`);
          }

        } catch (error) {
          console.warn(`⚠️ 등록자 ${regId}의 로그 정리 중 오류:`, error);
        }
      }

      console.log(`🎉 고아 registration logs 정리 완료: ${totalDeleted}개 삭제`);
      return totalDeleted;

    } catch (error) {
      console.error('❌ 고아 registration logs 정리 실패:', error);
      throw error;
    }
  }

  /**
   * 전체 데이터 정합성 검사
   */
  static async checkDataIntegrity(conferenceId: string) {
    console.log(`🔍 시작: 데이터 정합성 검사 (${conferenceId})`);

    interface DataIntegrityIssue {
      type: string;
      logId?: string;
      scannedQr?: string;
      timestamp?: string;
    }

    const report = {
      conferenceId,
      timestamp: new Date().toISOString(),
      issues: [] as DataIntegrityIssue[],
      statistics: {
        totalRegistrations: 0,
        totalAccessLogs: 0,
        orphanedAccessLogs: 0,
        totalRegistrationLogs: 0,
        dataInconsistencies: 0
      }
    };

    try {
      // 1. 등록자 통계
      const registrationsRef = collection(db, 'conferences', conferenceId, 'registrations');
      const registrationsSnap = await getDocs(registrationsRef);
      report.statistics.totalRegistrations = registrationsSnap.size;

      // 2. access_logs 통계
      const accessLogsRef = collection(db, 'conferences', conferenceId, 'access_logs');
      const accessLogsSnap = await getDocs(accessLogsRef);
      report.statistics.totalAccessLogs = accessLogsSnap.size;

      // 3. 고아 access_logs 확인
      const validBadgeQrs = new Set(
        registrationsSnap.docs
          .map(doc => doc.data().badgeQr)
          .filter(qr => qr)
      );

      for (const logDoc of accessLogsSnap.docs) {
        const logData = logDoc.data();
        if (logData.scannedQr && !validBadgeQrs.has(logData.scannedQr)) {
          report.statistics.orphanedAccessLogs++;
          report.issues.push({
            type: 'ORPHANED_ACCESS_LOG',
            logId: logDoc.id,
            scannedQr: logData.scannedQr,
            timestamp: logData.timestamp?.toDate()?.toISOString()
          });
        }
      }

      // 4. registration logs 통계
      let totalRegLogs = 0;
      for (const regDoc of registrationsSnap.docs) {
        const logsRef = collection(db, 'conferences', conferenceId, 'registrations', regDoc.id, 'logs');
        const logsSnap = await getDocs(logsRef);
        totalRegLogs += logsSnap.size;
      }
      report.statistics.totalRegistrationLogs = totalRegLogs;

      // 5. 데이터 불일치 확인
      report.statistics.dataInconsistencies = report.issues.length;

      console.log(`✅ 데이터 정합성 검사 완료:`);
      console.log(`   - 전체 등록자: ${report.statistics.totalRegistrations}`);
      console.log(`   - 전체 access_logs: ${report.statistics.totalAccessLogs}`);
      console.log(`   - 고아 access_logs: ${report.statistics.orphanedAccessLogs}`);
      console.log(`   - 전체 registration logs: ${report.statistics.totalRegistrationLogs}`);
      console.log(`   - 데이터 불일치: ${report.statistics.dataInconsistencies}`);

      return report;

    } catch (error) {
      console.error('❌ 데이터 정합성 검사 실패:', error);
      throw error;
    }
  }

  /**
   * 전체 정리 실행 (안전한 순서로)
   */
  static async fullCleanup(conferenceId: string) {
    console.log(`🚀 시작: 전체 데이터 정리 (${conferenceId})`);
    
    try {
      // 1. 먼저 정합성 검사
      const integrityReport = await this.checkDataIntegrity(conferenceId);
      
      if (integrityReport.statistics.orphanedAccessLogs === 0 && 
          integrityReport.statistics.dataInconsistencies === 0) {
        console.log('✅ 정리할 데이터가 없습니다.');
        return integrityReport;
      }

      // 2. 고아 데이터 정리
      const deletedAccessLogs = await this.cleanupOrphanedAccessLogs(conferenceId);
      const deletedRegistrationLogs = await this.cleanupOrphanedRegistrationLogs(conferenceId);

      // 3. 재검사
      const finalReport = await this.checkDataIntegrity(conferenceId);

      console.log(`🎉 전체 정리 완료:`);
      console.log(`   - 삭제된 access_logs: ${deletedAccessLogs}`);
      console.log(`   - 삭제된 registration logs: ${deletedRegistrationLogs}`);

      return {
        beforeCleanup: integrityReport,
        afterCleanup: finalReport,
        deletedCounts: {
          accessLogs: deletedAccessLogs,
          registrationLogs: deletedRegistrationLogs
        }
      };

    } catch (error) {
      console.error('❌ 전체 정리 실패:', error);
      throw error;
    }
  }

  /**
   * 특정 등록자 관련 데이터 안전 삭제
   */
  static async safeDeleteRegistration(conferenceId: string, registrationId: string, adminId: string) {
    console.log(`🗑️ 시작: 등록자 안전 삭제 (${conferenceId}/${registrationId})`);
    
    try {
      const batch = writeBatch(db);

      // 1. 등록자 정보 확인
      const registrationDoc = await getDoc(
        doc(db, 'conferences', conferenceId, 'registrations', registrationId)
      );
      
      if (!registrationDoc.exists()) {
        throw new Error('등록자를 찾을 수 없습니다.');
      }

      const registrationData = registrationDoc.data();

      // 2. 관련 access_logs 삭제
      let accessLogsCount = 0;
      if (registrationData.badgeQr) {
        const accessLogsQuery = query(
          collection(db, 'conferences', conferenceId, 'access_logs'),
          where('scannedQr', '==', registrationData.badgeQr)
        );
        const accessLogsSnap = await getDocs(accessLogsQuery);
        
        accessLogsSnap.docs.forEach(logDoc => {
          batch.delete(logDoc.ref);
          console.log(`🗑️ access_log 삭제: ${logDoc.id}`);
        });
        accessLogsCount = accessLogsSnap.size;
      }

      // 3. 개별 로그 서브컬렉션 삭제
      const logsRef = collection(db, 'conferences', conferenceId, 'registrations', registrationId, 'logs');
      const logsSnap = await getDocs(logsRef);
      
      logsSnap.docs.forEach(logDoc => {
        batch.delete(logDoc.ref);
        console.log(`🗑️ registration log 삭제: ${logDoc.id}`);
      });

      // 4. 등록 정보 삭제
      const registrationRef = doc(db, 'conferences', conferenceId, 'registrations', registrationId);
      batch.delete(registrationRef);

      // 5. 삭제 기록 로그 (관리자용)
      const adminLogRef = doc(db, 'conferences', conferenceId, 'admin_logs', `delete_${registrationId}_${Date.now()}`);
      
      // undefined 값 제외하고 삭제 데이터 구성
      const deletedData: Record<string, string> = {};
      
      if (registrationData.userName !== undefined && registrationData.userName !== null) {
        deletedData.userName = registrationData.userName;
      }
      if (registrationData.userEmail !== undefined && registrationData.userEmail !== null) {
        deletedData.userEmail = registrationData.userEmail;
      }
      if (registrationData.badgeQr !== undefined && registrationData.badgeQr !== null) {
        deletedData.badgeQr = registrationData.badgeQr;
      }
      
      const logData: Record<string, unknown> = {
        type: 'REGISTRATION_DELETE',
        registrationId,
        deletedBy: adminId,
        deletedAt: new Date()
      };
      
      // deletedData에 값이 있는 경우에만 추가
      if (Object.keys(deletedData).length > 0) {
        logData.deletedData = deletedData;
      }
      
      batch.set(adminLogRef, logData);

      await batch.commit();

      console.log(`✅ 등록자 안전 삭제 완료: ${registrationId}`);
      return {
        success: true,
        deletedAccessLogs: accessLogsCount,
        deletedRegistrationLogs: logsSnap.size
      };

    } catch (error) {
      console.error('❌ 등록자 안전 삭제 실패:', error);
      throw error;
    }
  }
}

// 사용 예시:
/*
// 1. 전체 정리
const cleanupResult = await AttendanceDataCleanup.fullCleanup('kadd_2026spring');

// 2. 정합성 검사만
const integrity = await AttendanceDataCleanup.checkDataIntegrity('kadd_2026spring');

// 3. 특정 등록자 안전 삭제
const deleteResult = await AttendanceDataCleanup.safeDeleteRegistration(
  'kadd_2026spring', 
  'registration123',
  'admin456'
);
*/