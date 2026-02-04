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
