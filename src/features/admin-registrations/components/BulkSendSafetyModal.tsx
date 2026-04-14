import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, X } from "lucide-react";

import type { BulkSendModalState } from "../types";

type Props = {
  bulkModal: BulkSendModalState;
  onClose: () => void;
  onExecute: () => void;
  onToggleCheck: (index: number) => void;
  onConfirmInputChange: (value: string) => void;
};

export function BulkSendSafetyModal(props: Props) {
  const { bulkModal, onClose, onExecute, onToggleCheck, onConfirmInputChange } = props;

  if (!bulkModal.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div
          className={`px-6 py-4 flex items-center gap-3 ${
            bulkModal.step === "done" ? "bg-green-600" : bulkModal.step === "processing" ? "bg-blue-600" : "bg-amber-500"
          }`}
        >
          {bulkModal.step === "confirm" && <AlertTriangle className="w-6 h-6 text-white" />}
          {bulkModal.step === "processing" && <Loader2 className="w-6 h-6 text-white animate-spin" />}
          {bulkModal.step === "done" && <ShieldCheck className="w-6 h-6 text-white" />}
          <h2 className="text-white font-bold text-lg flex-1">
            {bulkModal.step === "confirm" && "전체 알림톡 발송 확인"}
            {bulkModal.step === "processing" && "서버에서 발송 중..."}
            {bulkModal.step === "done" && "발송 완료"}
          </h2>
          {bulkModal.step !== "processing" && (
            <button onClick={onClose} className="text-white/80 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="px-6 py-5">
          {bulkModal.step === "confirm" && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-700 font-medium">발송 대상</p>
                <p className="text-3xl font-extrabold text-amber-900 mt-1">{bulkModal.targetIds.length}명</p>
                <p className="text-xs text-amber-600 mt-1">기존 수령 링크는 무효화되고 새 링크가 발급됩니다.</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">다음 사항을 확인하세요 ⚠️</p>
                {[
                  "앞에 표시된 등록자가 모두 전화번호를 보유한 실제 수령 대상임을 확인했습니다.",
                  "이미 알림톡을 받은 대상에게 재발송하면 기존 링크가 만료되는 점을 이해했습니다.",
                  "사전에 테스트 발송을 통해 템플릿과 시간 표기를 확인했습니다.",
                ].map((label, i) => (
                  <label
                    key={i}
                    className={`flex items-start gap-2 p-2.5 rounded-lg cursor-pointer transition-colors ${
                      bulkModal.checks[i]
                        ? "bg-green-50 border border-green-200"
                        : "bg-gray-50 border border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={bulkModal.checks[i]}
                      onChange={() => onToggleCheck(i)}
                      className="mt-0.5 w-4 h-4 accent-green-600"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1.5">
                  아래에 정확히 <strong className="text-red-600">{bulkModal.targetIds.length}</strong> 을 입력하세요
                </p>
                <input
                  type="text"
                  value={bulkModal.confirmInput}
                  onChange={(e) => onConfirmInputChange(e.target.value)}
                  placeholder={`${bulkModal.targetIds.length} 입력`}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-400 focus:outline-none text-lg font-bold text-center"
                />
              </div>

              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700">
                  <strong>안전:</strong> 화면을 닫아도 서버에서 멈춰지 않고 처리됩니다.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 font-medium"
                >
                  취소
                </button>
                <button
                  onClick={onExecute}
                  disabled={!bulkModal.checks.every(Boolean) || bulkModal.confirmInput.trim() !== String(bulkModal.targetIds.length)}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  발송 시작
                </button>
              </div>
            </div>
          )}

          {bulkModal.step === "processing" && (
            <div className="py-8 text-center space-y-4">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
              <div>
                <p className="font-bold text-gray-800 text-lg">{bulkModal.targetIds.length}명 발송 중...</p>
                <p className="text-sm text-gray-500 mt-1">30명 병렬 토큰 생성 → NHN 배치 전송</p>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-700 font-medium">✅ 이 창을 닫아도 안전합니다</p>
                <p className="text-xs text-blue-600 mt-1">서버에서 자동 완료 후 결과를 저장합니다.</p>
              </div>
            </div>
          )}

          {bulkModal.step === "done" && bulkModal.result && (
            <div className="py-6 space-y-4">
              <div className="text-center">
                <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-3" />
                <p className="font-bold text-gray-800 text-xl">발송 완료!</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
                  <p className="text-3xl font-extrabold text-green-700">{bulkModal.result.sent}</p>
                  <p className="text-xs text-green-600 mt-1">발송 성공</p>
                </div>
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
                  <p className="text-3xl font-extrabold text-red-700">{bulkModal.result.failed}</p>
                  <p className="text-xs text-red-600 mt-1">발송 실패</p>
                </div>
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-center">
                  <p className="text-3xl font-extrabold text-gray-700">{bulkModal.result.skipped}</p>
                  <p className="text-xs text-gray-600 mt-1">스킵 (전화번호 없음 등)</p>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-center">
                  <p className="text-3xl font-extrabold text-blue-700">{bulkModal.result.tokenGenerated}</p>
                  <p className="text-xs text-blue-600 mt-1">토큰 발급</p>
                </div>
              </div>
              {bulkModal.result.failed > 0 && <p className="text-xs text-gray-500 text-center">Firebase 콘솔 로그에서 실패 대상 확인 가능</p>}
              <button
                onClick={onClose}
                className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-900 transition-colors"
              >
                닫기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

