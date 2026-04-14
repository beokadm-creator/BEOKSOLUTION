import { useState } from "react";

import type { Member } from "../types";

export function useMemberSelection(members: Member[]) {
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
    const [selectAll, setSelectAll] = useState(false);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = members
                .filter((m) => !m.used)
                .map((m) => m.id);
            setSelectedMemberIds(new Set(allIds));
        } else {
            setSelectedMemberIds(new Set());
        }
        setSelectAll(checked);
    };

    const handleSelectMember = (memberId: string, checked: boolean) => {
        const newSelected = new Set(selectedMemberIds);
        if (checked) {
            newSelected.add(memberId);
        } else {
            newSelected.delete(memberId);
        }
        setSelectedMemberIds(newSelected);
    };

    const clearSelection = () => {
        setSelectedMemberIds(new Set());
        setSelectAll(false);
    };

    return {
        selectedMemberIds,
        setSelectedMemberIds,
        selectAll,
        setSelectAll,
        handleSelectAll,
        handleSelectMember,
        clearSelection
    };
}

