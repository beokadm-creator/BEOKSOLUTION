import React from "react";
import { Edit, Save, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { EditFormData, ExtendedRegistration } from "../types";

type Props = {
  data: ExtendedRegistration;
  isEditing: boolean;
  editData: EditFormData;
  setEditData: React.Dispatch<React.SetStateAction<EditFormData>>;
  isSaving: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
};

export const BasicInfoSection: React.FC<Props> = ({
  data,
  isEditing,
  editData,
  setEditData,
  isSaving,
  onStartEdit,
  onCancelEdit,
  onSave,
}) => (
  <>
    <div className="col-span-2 flex justify-between items-center border-t py-2 my-2">
      <h2 className="text-lg font-bold">기본 정보 (Basic Information)</h2>
      {!isEditing ? (
        <Button variant="outline" size="sm" onClick={onStartEdit}>
          <Edit className="w-4 h-4 mr-2" /> 수정하기
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancelEdit} disabled={isSaving}>
            <X className="w-4 h-4 mr-2" /> 취소
          </Button>
          <Button variant="default" size="sm" onClick={onSave} disabled={isSaving}>
            {isSaving ? "저장중..." : (
              <>
                <Save className="w-4 h-4 mr-2" /> 저장
              </>
            )}
          </Button>
        </div>
      )}
    </div>

    <div>
      <h3 className="text-sm font-bold text-gray-500 mb-1">이름 (Name)</h3>
      {isEditing ? (
        <input
          type="text"
          className="border p-2 rounded w-full border-blue-400 bg-blue-50"
          value={editData.userName}
          onChange={(e) => setEditData({ ...editData, userName: e.target.value })}
        />
      ) : (
        <p className="text-lg">{data.userName}</p>
      )}
    </div>
    <div>
      <h3 className="text-sm font-bold text-gray-500 mb-1">소속 (Affiliation)</h3>
      {isEditing ? (
        <input
          type="text"
          className="border p-2 rounded w-full border-blue-400 bg-blue-50"
          value={editData.userOrg}
          onChange={(e) => setEditData({ ...editData, userOrg: e.target.value })}
        />
      ) : (
        <p className="text-lg">{data.userOrg || data.affiliation || "-"}</p>
      )}
    </div>

    <div>
      <h3 className="text-sm font-bold text-gray-500 mb-1">
        이메일 (Email) <span className="text-xs font-normal">(수정불가)</span>
      </h3>
      <p className="text-lg text-gray-600">{data.userEmail}</p>
    </div>
    <div>
      <h3 className="text-sm font-bold text-gray-500 mb-1">전화번호 (Phone)</h3>
      {isEditing ? (
        <input
          type="text"
          className="border p-2 rounded w-full border-blue-400 bg-blue-50"
          value={editData.userPhone}
          onChange={(e) => setEditData({ ...editData, userPhone: e.target.value })}
        />
      ) : (
        <p className="text-lg">{data.userPhone}</p>
      )}
    </div>

    <div>
      <h3 className="text-sm font-bold text-gray-500 mb-1">면허번호 (License)</h3>
      {isEditing ? (
        <input
          type="text"
          className="border p-2 rounded w-full border-blue-400 bg-blue-50"
          value={editData.licenseNumber}
          onChange={(e) => setEditData({ ...editData, licenseNumber: e.target.value })}
        />
      ) : (
        <p className="text-lg">
          {data.licenseNumber ||
            data.userInfo?.licenseNumber ||
            (data as unknown as Record<string, unknown>)?.userInfo?.licensenumber ||
            (data as unknown as Record<string, unknown>)?.license ||
            (data as unknown as Record<string, unknown>)?.formData?.licenseNumber ||
            "-"}
        </p>
      )}
    </div>
    <div>
      <h3 className="text-sm font-bold text-gray-500 mb-1">
        등록등급 (Grade) <span className="text-xs font-normal">(수정불가)</span>
      </h3>
      <p className="text-lg text-gray-600">{data.tier || (data as unknown as Record<string, unknown>).userTier || data.categoryName || data.grade || "-"}</p>
    </div>
  </>
);

