import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import toast from "react-hot-toast";

import { db } from "@/firebase";
import { DOMAIN_CONFIG, extractSocietyFromHost } from "@/utils/domainHelper";

import type { EditFormData, ExtendedRegistration } from "../types";

const getConferenceIdByDomain = () => {
  const hostname = window.location.hostname;
  const societyId = extractSocietyFromHost(hostname) || DOMAIN_CONFIG.DEFAULT_SOCIETY;
  return `${societyId}_2026spring`;
};

const getDefaultEditData = (data: ExtendedRegistration): EditFormData => ({
  userName: data.userName || "",
  userOrg: data.userOrg || data.affiliation || "",
  userPhone: data.userPhone || "",
  licenseNumber: data.licenseNumber || "",
});

export const useRegistrationDetailData = (params: {
  cid?: string;
  regId?: string;
  onNotFound?: () => void;
}) => {
  const { cid, regId, onNotFound } = params;

  const [data, setData] = useState<ExtendedRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [effectiveCid, setEffectiveCid] = useState<string | null>(null);
  const [defaultEditData, setDefaultEditData] = useState<EditFormData>({
    userName: "",
    userOrg: "",
    userPhone: "",
    licenseNumber: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      let targetCid = cid;

      if (!targetCid) {
        targetCid = getConferenceIdByDomain();
        setEffectiveCid(targetCid);
      } else {
        setEffectiveCid(targetCid);
      }

      if (!regId || !targetCid) return;

      try {
        const ref = doc(db, "conferences", targetCid, "registrations", regId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          toast.error("등록 정보를 찾을 수 없습니다.");
          onNotFound?.();
          return;
        }

        const docData = snap.data() as Record<string, unknown>;
        const flattened = { id: snap.id, ...docData } as ExtendedRegistration;

        if (docData.userInfo && typeof docData.userInfo === "object") {
          const userInfo = docData.userInfo as Record<string, unknown>;
          flattened.userName = (userInfo.name as string) || flattened.userName;
          flattened.userEmail = (userInfo.email as string) || flattened.userEmail;
          flattened.userPhone = (userInfo.phone as string) || flattened.userPhone;
          flattened.affiliation = (userInfo.affiliation as string) || flattened.affiliation;
          flattened.licenseNumber = (userInfo.licenseNumber as string) || flattened.licenseNumber;

          if (!flattened.tier && userInfo.grade) {
            flattened.tier = String(userInfo.grade);
          }
        }

        const optionsList = flattened.options || flattened.selectedOptions || [];
        const calculatedOptionsTotal = optionsList.reduce((sum: number, opt: unknown) => {
          const row = opt as Record<string, unknown>;
          const rowTotal = row.totalPrice;
          if (typeof rowTotal === "number") return sum + rowTotal;
          const price = typeof row.price === "number" ? row.price : 0;
          const quantity = typeof row.quantity === "number" ? row.quantity : 0;
          return sum + price * quantity;
        }, 0);

        if (calculatedOptionsTotal > 0 && (!flattened.optionsTotal || flattened.optionsTotal === 0)) {
          flattened.optionsTotal = calculatedOptionsTotal;
        }

        if (!flattened.tier && docData.userTier) {
          (flattened as unknown as Record<string, unknown>).tier = docData.userTier;
        }

        if (!flattened.licenseNumber && docData.license) {
          flattened.licenseNumber = String(docData.license);
        }

        if (docData.paymentDetails && typeof docData.paymentDetails === "object") {
          const paymentDetails = docData.paymentDetails as Record<string, unknown>;
          if (!flattened.paymentKey && paymentDetails.paymentKey) {
            flattened.paymentKey = String(paymentDetails.paymentKey);
          }
          if (!flattened.paymentMethod && paymentDetails.method) {
            flattened.paymentMethod = String(paymentDetails.method);
          }
          if (!flattened.paidAt && paymentDetails.approvedAt) {
            flattened.paidAt = new Date(String(paymentDetails.approvedAt));
          }
        }

        setData(flattened);
        setDefaultEditData(getDefaultEditData(flattened));
      } catch (error) {
        console.error("Fetch error:", error);
        toast.error("데이터를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [cid, onNotFound, regId]);

  return { data, setData, loading, effectiveCid, defaultEditData, setDefaultEditData };
};

