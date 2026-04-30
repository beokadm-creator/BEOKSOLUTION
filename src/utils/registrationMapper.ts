/**
 * registrationMapper.ts — Single Source of Truth for registration field flattening.
 *
 * Firestore registration documents have inconsistent shapes:
 * - Some store user fields at root level (userName, userEmail, etc.)
 * - Some nest them under userInfo (userInfo.name, userInfo.email, etc.)
 * - Legacy fields use different names (userOrg, userAffiliation, organization, etc.)
 *
 * This module consolidates ALL field-flattening logic into ONE function.
 * When adding a new field, update ONLY this file.
 */

/**
 * Flatten Firestore registration document data into a normalized shape.
 *
 * Handles:
 * - Root-level fields (userName, affiliation, etc.)
 * - Nested userInfo fields (userInfo.name, userInfo.affiliation, etc.)
 * - Legacy field names (userOrg, userAffiliation, etc.)
 * - Missing field fallbacks
 *
 * SINGLE SOURCE OF TRUTH: When adding a new field to registrations,
 * add it HERE and it will propagate everywhere.
 */
export function flattenRegistrationFields(
  docData: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // ─── User Identity Fields ───
  // Prefer userInfo nested fields (more reliable), fall back to root-level
  result.userName =
    docData.userInfo && typeof docData.userInfo === 'object'
      ? (docData.userInfo as Record<string, unknown>).name || docData.userName || docData.name || ''
      : docData.userName || docData.name || '';

  result.userEmail =
    docData.userInfo && typeof docData.userInfo === 'object'
      ? (docData.userInfo as Record<string, unknown>).email || docData.userEmail || ''
      : docData.userEmail || '';

  result.userPhone =
    docData.userInfo && typeof docData.userInfo === 'object'
      ? (docData.userInfo as Record<string, unknown>).phone || docData.userPhone || ''
      : docData.userPhone || '';

  // ─── Organization / Affiliation (many legacy field names) ───
  const userInfo = docData.userInfo && typeof docData.userInfo === 'object'
    ? docData.userInfo as Record<string, unknown>
    : null;

  result.affiliation =
    docData.affiliation ||
    docData.organization ||
    docData.userOrg ||
    docData.userAffiliation ||
    userInfo?.affiliation ||
    userInfo?.organization ||
    '';

  // ─── Position (직급) ───
  result.position =
    docData.position ||
    userInfo?.position ||
    '';

  // ─── License Number (many legacy variants) ───
  result.licenseNumber =
    docData.licenseNumber ||
    docData.license ||
    userInfo?.licenseNumber ||
    userInfo?.licensenumber ||
    (docData.formData && typeof docData.formData === 'object'
      ? (docData.formData as Record<string, unknown>).licenseNumber
      : undefined) ||
    '';

  // ─── Tier / Grade ───
  result.tier =
    docData.tier ||
    docData.userTier ||
    docData.categoryName ||
    userInfo?.grade ||
    '';

  return result;
}
