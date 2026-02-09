export const getSocietyAdminPath = (sid: string, subPath: string, currentSubdomain: string | null): string => {
  // Clean up subPath to avoid double slashes
  const cleanSubPath = subPath.startsWith('/') ? subPath.slice(1) : subPath;

  // If the current subdomain matches the society ID, we omit the SID from the URL
  if (currentSubdomain && currentSubdomain === sid) {
    return `/admin/society/${cleanSubPath}`;
  }

  // Otherwise, we include the SID
  return `/admin/society/${sid}/${cleanSubPath}`;
};

/**
 * Extract conference ID from URL path
 * Examples:
 * - /admin/conf/kap_2026spring/dashboard → returns "kap_2026spring"
 * - /admin/conf/kap_2026spring/registrations → returns "kap_2026spring"
 * - /kap_2026spring/register → returns "kap_2026spring"
 * - /super/dashboard → returns null
 */
export const extractConfIdFromPath = (): string | null => {
  const path = window.location.pathname;

  // Pattern 1: /admin/conf/{confId}/*
  const adminConfMatch = path.match(/^\/admin\/conf\/([^\/]+)/);
  if (adminConfMatch) return adminConfMatch[1];

  // Pattern 2: /{slug}/* (conferences are like "kap_2026spring", "kadd_2025fall")
  // We need to distinguish from admin routes like /admin, /super
  const slugMatch = path.match(/^\/([^\/]+)/);
  if (slugMatch) {
    const slug = slugMatch[1];
    // Exclude admin and super routes
    if (slug !== 'admin' && slug !== 'super' && slug !== 'auth' && slug !== 'hub' && slug !== 'vendor') {
      // Check if it looks like a conference slug (contains underscore)
      if (slug.includes('_')) {
        return slug;
      }
    }
  }

  return null;
};

/**
 * Extract society ID from conference ID or URL
 * Examples:
 * - "kap_2026spring" → returns "kap"
 * - "kadd_2025fall" → returns "kadd"
 */
export const extractSocietyIdFromConfId = (confId?: string): string | null => {
  if (!confId) return null;
  const parts = confId.split('_');
  return parts[0] || null;
};

/**
 * Extract society ID from current URL
 * Combines confId extraction and society ID extraction
 */
export const extractSocietyIdFromPath = (): string | null => {
  const confId = extractConfIdFromPath();
  return extractSocietyIdFromConfId(confId);
};
