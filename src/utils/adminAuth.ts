import { SUPER_ADMIN_EMAILS } from '../constants/adminConstants';

export const isSuperAdmin = (email: string | null | undefined): boolean => {
    if (!email) return false;
    return SUPER_ADMIN_EMAILS.includes(email);
};

export const validateSuperAdminAccess = (email: string | null | undefined): boolean => {
    return isSuperAdmin(email);
};
