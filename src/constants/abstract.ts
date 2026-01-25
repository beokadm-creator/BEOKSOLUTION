export const ABSTRACT_STATUS = {
  ACCEPTED_ORAL: 'accepted_oral',
  ACCEPTED_POSTER: 'accepted_poster',
  REJECTED: 'rejected',
  SUBMITTED: 'submitted', // Default state when reviewStatus is missing or empty
} as const;

export type AbstractStatusType = typeof ABSTRACT_STATUS[keyof typeof ABSTRACT_STATUS];

export const ABSTRACT_STATUS_LABELS = {
  [ABSTRACT_STATUS.ACCEPTED_ORAL]: { 
    ko: '구연 채택', 
    en: 'Oral Accepted', 
    color: 'green',
    badgeClass: 'bg-green-100 text-green-800 border-green-200'
  },
  [ABSTRACT_STATUS.ACCEPTED_POSTER]: { 
    ko: '포스터 채택', 
    en: 'Poster Accepted', 
    color: 'blue',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200'
  },
  [ABSTRACT_STATUS.REJECTED]: { 
    ko: '미채택', 
    en: 'Rejected', 
    color: 'red',
    badgeClass: 'bg-red-50 text-red-600 border-red-200'
  },
  [ABSTRACT_STATUS.SUBMITTED]: { 
    ko: '심사중/접수', 
    en: 'Under Review', 
    color: 'gray',
    badgeClass: 'bg-gray-100 text-gray-600 border-gray-200'
  },
};

export const getAbstractStatusLabel = (status: string | undefined | null, lang: 'ko' | 'en' = 'ko') => {
  const s = status as AbstractStatusType;
  if (!s || !ABSTRACT_STATUS_LABELS[s]) return ABSTRACT_STATUS_LABELS[ABSTRACT_STATUS.SUBMITTED][lang];
  return ABSTRACT_STATUS_LABELS[s][lang];
};

export const getAbstractStatusColor = (status: string | undefined | null) => {
    const s = status as AbstractStatusType;
    if (!s || !ABSTRACT_STATUS_LABELS[s]) return ABSTRACT_STATUS_LABELS[ABSTRACT_STATUS.SUBMITTED].color;
    return ABSTRACT_STATUS_LABELS[s].color;
};
