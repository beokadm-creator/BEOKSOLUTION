import { SUPER_ADMIN_EMAILS } from '../constants/adminConstants';

export const isSuperAdmin = (email: string | null | undefined): boolean => {
    if (!email) return false;
    return SUPER_ADMIN_EMAILS.includes(email);
};

export const isSuperAdminUID = (uid: string | null | undefined): boolean => {
    if (!uid) return false;
    return uid === 'ykiqki032RXDGoS50sTcDlFx4nO2';
};

export const validateSuperAdminAccess = (email: string | null | undefined, uid?: string | null | undefined): boolean => {
    return isSuperAdmin(email) || isSuperAdminUID(uid);
};
