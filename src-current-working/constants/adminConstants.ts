export const ATTENDANCE_STATE = {
    INSIDE: 'INSIDE',
    OUTSIDE: 'OUTSIDE'
} as const;

export const DB_PATHS = {
    SOCIETIES: 'societies',
    CONFERENCES: 'conferences',
    USERS: 'users',
    SYSTEM: 'system',
    SETTINGS: 'settings',
    MEMBERS: 'members',
    SUPER_ADMINS: 'super_admins',
    REGISTRATIONS: 'registrations'
} as const;

export const SUPER_ADMIN_EMAILS = [
    'aaron@beoksolution.com'
] as const;

export const ALLOWED_FILE_TYPES = {
    IMAGES: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
    DOCUMENTS: ['application/pdf'],
    ALL: [...['image/png', 'image/jpeg', 'image/gif', 'image/webp'], 'application/pdf']
} as const;

export const MEMBER_TAB = {
    REGULAR: 'REGULAR',
    GUEST: 'GUEST'
} as const;

export const SETTINGS_LANG = {
    KO: 'KO',
    EN: 'EN'
} as const;

export const ADMIN_TAB = {
    SOCIETY: 'SOCIETY',
    CONFERENCE: 'CONFERENCE',
    MEMBERS: 'MEMBERS',
    SETTINGS: 'SETTINGS',
    CODES: 'CODES'
} as const;
