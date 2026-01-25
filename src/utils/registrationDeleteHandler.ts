import React from 'react';
import toast from 'react-hot-toast';
import { AttendanceDataCleanup } from './attendanceDataCleanup';

interface Registration {
  id: string;
  userName?: string;
  userEmail?: string;
}

/**
 * 개선된 회원 삭제 로직 - RegistrationListPage.tsx 에 적용
 * 기존 코드를 이 함수로 교체해주세요
 */

export const handleDeleteRegistrationWithCleanup = async <T extends Registration>(
  reg: T,
  conferenceId: string,
  setRegistrations: React.Dispatch<React.SetStateAction<T[]>>
) => {
  const confirmMessage = 
    `다음 등록 정보를 삭제하시겠습니까?\n\n` +
    `이름: ${reg.userName || '미상'}\n` +
    `이메일: ${reg.userEmail || '미상'}\n` +
    `주문번호: ${reg.id}\n\n` +
    `⚠️ 관련된 모든 출결 데이터가 함께 삭제됩니다.\n` +
    `⚠️ 이 작업은 되돌릴 수 없습니다.`;

  if (!confirm(confirmMessage)) return;

  try {
    if (!conferenceId) {
      toast.error("Conference ID가 없습니다.");
      return;
    }

    // 개선된 안전 삭제 사용
    const deleteResult = await AttendanceDataCleanup.safeDeleteRegistration(
      conferenceId,
      reg.id,
      'current_admin' // 실제로는 현재 로그인된 관리자 ID를 사용
    );

    if (deleteResult.success) {
      toast.success(
        `등록 정보가 삭제되었습니다.\n` +
        `- 관련 access_logs: ${deleteResult.deletedAccessLogs}개\n` +
        `- 개별 로그: ${deleteResult.deletedRegistrationLogs}개`
      );
      
      // 로컬 상태에서 제거
      setRegistrations(prev => prev.filter(r => r.id !== reg.id));
    }

  } catch (e: unknown) {
    console.error("Delete error:", e);
    toast.error("삭제 중 오류가 발생했습니다: " + (e instanceof Error ? e.message : 'Unknown error'));
  }
};

/**
 * 대량 삭제 처리 (여러 명 선택 삭제)
 */
export const handleBatchDeleteWithCleanup = async <T extends Registration>(
  selectedIds: string[],
  conferenceId: string,
  setRegistrations: React.Dispatch<React.SetStateAction<T[]>>
) => {
  if (selectedIds.length === 0) {
    toast.error("삭제할 항목을 선택해주세요.");
    return;
  }

  const confirmMessage = 
    `${selectedIds.length}개의 등록 정보를 삭제하시겠습니까?\n\n` +
    `⚠️ 관련된 모든 출결 데이터가 함께 삭제됩니다.\n` +
    `⚠️ 이 작업은 되돌릴 수 없습니다.`;

  if (!confirm(confirmMessage)) return;

  try {
    let totalDeleted = 0;
    let totalAccessLogs = 0;
    let totalRegLogs = 0;

    for (const regId of selectedIds) {
      try {
        const deleteResult = await AttendanceDataCleanup.safeDeleteRegistration(
          conferenceId,
          regId,
          'current_admin'
        );
        
        if (deleteResult.success) {
          totalDeleted++;
          totalAccessLogs += deleteResult.deletedAccessLogs;
          totalRegLogs += deleteResult.deletedRegistrationLogs;
        }
      } catch (error) {
        console.error(`Failed to delete registration ${regId}:`, error);
      }
    }

    if (totalDeleted > 0) {
      toast.success(
        `${totalDeleted}개 등록 정보 삭제 완료:\n` +
        `- 관련 access_logs: ${totalAccessLogs}개\n` +
        `- 개별 로그: ${totalRegLogs}개`
      );
      
      // 로컬 상태 업데이트
      setRegistrations(prev => prev.filter(r => !selectedIds.includes(r.id)));
    }

  } catch (e: unknown) {
    console.error("Batch delete error:", e);
    toast.error("대량 삭제 중 오류가 발생했습니다: " + (e instanceof Error ? e.message : 'Unknown error'));
  }
};

/**
 * 데이터 정리 관리자 기능
 */
export const runDataCleanup = async (conferenceId: string) => {
  const confirmMessage = 
    '데이터 정리를 실행하시겠습니까?\n\n' +
    '🧹 다음 데이터가 정리됩니다:\n' +
    '- 등록자가 없는 access_logs\n' +
    '- 존재하지 않는 등록자의 개별 로그\n\n' +
    '⚠️ 정리 작업은 되돌릴 수 없습니다.';

  if (!confirm(confirmMessage)) return;

  try {
    toast.loading('데이터 정리 중...', { id: 'cleanup' });

    const result = await AttendanceDataCleanup.fullCleanup(conferenceId);

    toast.dismiss('cleanup');
    
    if ('deletedCounts' in result) {
      toast.success(
        `데이터 정리 완료:\n` +
        `- 삭제된 access_logs: ${result.deletedCounts.accessLogs}개\n` +
        `- 삭제된 registration logs: ${result.deletedCounts.registrationLogs}개\n` +
        `- 정리 후 불일치: ${result.afterCleanup.statistics.dataInconsistencies}개`
      );
    } else {
      toast.success('정리할 데이터가 없습니다.');
    }

    return result;

  } catch (e: unknown) {
    toast.dismiss('cleanup');
    console.error("Data cleanup error:", e);
    toast.error("데이터 정리 중 오류가 발생했습니다: " + (e instanceof Error ? e.message : 'Unknown error'));
  }
};

/**
 * 데이터 정합성 검사
 */
export const checkDataIntegrity = async (conferenceId: string) => {
  try {
    toast.loading('정합성 검사 중...', { id: 'integrity' });

    const report = await AttendanceDataCleanup.checkDataIntegrity(conferenceId);

    toast.dismiss('integrity');

    if (report.statistics.dataInconsistencies === 0) {
      toast.success('✅ 데이터 정합성 양호');
    } else {
      toast.error(
        `⚠️ 데이터 불일치 발견:\n` +
        `- 고아 access_logs: ${report.statistics.orphanedAccessLogs}개\n` +
        `- 전체 불일치: ${report.statistics.dataInconsistencies}개\n` +
        '데이터 정리를 실행해주세요.'
      );
    }

    return report;

  } catch (e: unknown) {
    toast.dismiss('integrity');
    console.error("Integrity check error:", e);
    toast.error("정합성 검사 중 오류가 발생했습니다: " + (e instanceof Error ? e.message : 'Unknown error'));
  }
};

// RegistrationListPage.tsx 적용 예시:
/*
// 기존 handleDelete 함수를 다음으로 교체
const handleDelete = (reg: Registration) => {
  handleDeleteRegistrationWithCleanup(reg, conferenceId, setRegistrations);
};

// 추가 기능 버튼
const AdminCleanupTools = () => (
  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
    <h3 className="font-bold text-yellow-800 mb-3">🔧 데이터 정리 도구</h3>
    <div className="flex gap-2">
      <button
        onClick={() => checkDataIntegrity(conferenceId)}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        📊 정합성 검사
      </button>
      <button
        onClick={() => runDataCleanup(conferenceId)}
        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
      >
        🧹 데이터 정리
      </button>
    </div>
  </div>
);
*/