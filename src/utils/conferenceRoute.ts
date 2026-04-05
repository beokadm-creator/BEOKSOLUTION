import { DOMAIN_CONFIG, extractSocietyFromHost } from "./domainHelper";

export const resolveConferenceIdFromRoute = (
    slug?: string,
    host: string = window.location.hostname
): string => {
    if (!slug) return "";
    if (slug.includes("_")) return slug;

    const societyId = extractSocietyFromHost(host) || DOMAIN_CONFIG.DEFAULT_SOCIETY;
    return societyId ? `${societyId}_${slug}` : slug;
};

export const resolvePublicSlugFromConferenceId = (value?: string | null): string => {
    if (!value) return "";
    if (!value.includes("_")) return value;

    const [, ...parts] = value.split("_");
    return parts.join("_");
};
