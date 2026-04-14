import React from "react";
import { useParams } from "react-router-dom";

import AdminRegistrationDetailPage from "@/features/admin-registration-detail/AdminRegistrationDetailPage";

export default function RegistrationDetailPage() {
  const { cid, regId } = useParams<{ cid: string; regId: string }>();
  return <AdminRegistrationDetailPage cid={cid} regId={regId} />;
}
