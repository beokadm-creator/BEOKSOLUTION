export type BadgeRecordSource = "REGULAR" | "EXTERNAL";

type BadgeRecordLike = {
    badgeIssued?: boolean | null;
    badgeQr?: string | null;
    userName?: string | null;
    name?: string | null;
    userInfo?: {
        name?: string | null;
        affiliation?: string | null;
    } | null;
    affiliation?: string | null;
    organization?: string | null;
    userAffiliation?: string | null;
};

export const isBadgeIssued = (
    record: BadgeRecordLike,
    source: BadgeRecordSource
): boolean => {
    if (source === "EXTERNAL") {
        // External attendees can have a pre-generated badge QR before actual issuance.
        return !!record.badgeIssued;
    }

    return !!record.badgeIssued || !!record.badgeQr;
};

export const getBadgeDisplayName = (record: BadgeRecordLike): string => (
    String(record.userName || record.name || record.userInfo?.name || "이름 없음")
);

export const getBadgeDisplayAffiliation = (record: BadgeRecordLike): string => (
    String(
        record.affiliation
        || record.organization
        || record.userAffiliation
        || record.userInfo?.affiliation
        || "소속 없음"
    )
);
