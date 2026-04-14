import { collection, getDocs, orderBy as fbOrderBy, query } from "firebase/firestore";

import { db } from "@/firebase";

import type { RootRegistration } from "../types";

export const fetchAllRegistrations = async (conferenceId: string | null): Promise<RootRegistration[]> => {
  if (!conferenceId) return [];
  const regRef = collection(db, "conferences", conferenceId, "registrations");
  const q = query(regRef, fbOrderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const docData = d.data();
    const flattened = { id: d.id, ...docData } as RootRegistration;
    if (!flattened.orderId) flattened.orderId = flattened.id;
    if (docData.userInfo) {
      flattened.userName = docData.userInfo.name || docData.userName;
      flattened.userEmail = docData.userInfo.email || docData.userEmail;
      flattened.userPhone = docData.userInfo.phone || docData.userPhone;
      flattened.affiliation = docData.userInfo.affiliation || docData.affiliation;
      flattened.licenseNumber = docData.userInfo.licenseNumber || docData.licenseNumber;
      if (!flattened.tier && docData.userInfo.grade) flattened.tier = docData.userInfo.grade;
    }
    if (!flattened.tier && docData.userTier) flattened.tier = docData.userTier;
    if (!flattened.tier && docData.categoryName) flattened.tier = docData.categoryName;
    if (!flattened.licenseNumber) {
      if (docData.license) flattened.licenseNumber = docData.license;
      else if (docData.userInfo?.licensenumber) flattened.licenseNumber = docData.userInfo.licensenumber;
      else if (docData.formData?.licenseNumber) flattened.licenseNumber = docData.formData.licenseNumber;
    }
    if (docData.badgeQr) flattened.badgeQr = docData.badgeQr;
    return flattened;
  });
};

