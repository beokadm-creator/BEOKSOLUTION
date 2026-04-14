import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { HeaderBar } from "./components/HeaderBar";
import { SummarySection } from "./components/SummarySection";
import { BasicInfoSection } from "./components/BasicInfoSection";
import { PaymentSummarySection } from "./components/PaymentSummarySection";
import { PaymentDetailSection } from "./components/PaymentDetailSection";
import { PaymentMetaSection } from "./components/PaymentMetaSection";
import { ManagementActionsSection } from "./components/ManagementActionsSection";
import { VoucherSection } from "./components/VoucherSection";
import { useRegistrationDetailData } from "./hooks/useRegistrationDetailData";
import { useRegistrationDetailActions } from "./hooks/useRegistrationDetailActions";
import type { EditFormData } from "./types";

type Props = {
  cid?: string;
  regId?: string;
};

const getEditDataFromCurrent = (data: {
  userName?: string;
  userOrg?: string;
  affiliation?: string;
  userPhone?: string;
  licenseNumber?: string;
}): EditFormData => ({
  userName: data.userName || "",
  userOrg: data.userOrg || data.affiliation || "",
  userPhone: data.userPhone || "",
  licenseNumber: data.licenseNumber || "",
});

const AdminRegistrationDetailPage: React.FC<Props> = ({ cid, regId }) => {
  const navigate = useNavigate();

  const { data, setData, loading, effectiveCid } = useRegistrationDetailData({
    cid,
    regId,
    onNotFound: () => navigate(-1),
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<EditFormData>({
    userName: "",
    userOrg: "",
    userPhone: "",
    licenseNumber: "",
  });

  const actionsHook = useRegistrationDetailActions({
    effectiveCid,
    regId,
    data,
    setData,
  });

  const onCancelEdit = () => {
    if (data) setEditData(getEditDataFromCurrent(data));
    setIsEditing(false);
  };

  const onSaveEdit = () => {
    if (!data) return;
    void actionsHook.actions.handleSaveEdit(editData, () => setIsEditing(false));
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!data) return <div className="p-8">데이터가 없습니다.</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto bg-white min-h-screen">
      <HeaderBar onBack={() => navigate(-1)} onPrint={() => window.print()} />

      <div className="grid grid-cols-2 gap-8 border p-6 rounded-lg">
        <SummarySection data={data} />

        <BasicInfoSection
          data={data}
          isEditing={isEditing}
          editData={editData}
          setEditData={setEditData}
          isSaving={actionsHook.isSaving}
          onStartEdit={() => {
            setEditData(getEditDataFromCurrent(data));
            setIsEditing(true);
          }}
          onCancelEdit={onCancelEdit}
          onSave={onSaveEdit}
        />

        <PaymentSummarySection data={data} />
        <PaymentDetailSection data={data} />
        <PaymentMetaSection data={data} />
      </div>

      <ManagementActionsSection
        data={data}
        canceling={actionsHook.canceling}
        onPaymentCancel={actionsHook.actions.handlePaymentCancel}
        onRefundRequest={actionsHook.actions.handleRefundRequest}
        onManualApprove={actionsHook.actions.handleManualApprove}
      />

      {regId && (
        <VoucherSection
          registrationId={regId}
          effectiveCid={effectiveCid}
          onResend={actionsHook.actions.handleResendNotification}
          isResending={actionsHook.isResending}
        />
      )}
    </div>
  );
};

export default AdminRegistrationDetailPage;
