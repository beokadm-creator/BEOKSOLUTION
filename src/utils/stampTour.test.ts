import {
  getSelectableStampTourRewards,
  getStampMissionTargetCount,
  getStampTourRewardTitle,
  hasValidStampTourRewards,
  isStampTourRewardDrawCompleted,
  maskStampTourParticipantName,
  normalizeStampTourRewards,
} from "./stampTour";

describe("stampTour utils", () => {
  describe("getStampMissionTargetCount", () => {
    it("caps count missions to the available booth count", () => {
      expect(getStampMissionTargetCount({ type: "COUNT", requiredCount: 10 }, 4)).toBe(4);
    });

    it("returns all booths when the rule is ALL", () => {
      expect(getStampMissionTargetCount({ type: "ALL" }, 6)).toBe(6);
    });

    it("returns zero when there are no participating booths", () => {
      expect(getStampMissionTargetCount({ type: "COUNT", requiredCount: 3 }, 0)).toBe(0);
    });

    it("returns boothCount when completionRule is undefined", () => {
      expect(getStampMissionTargetCount(undefined, 5)).toBe(5);
    });

    it("returns boothCount when completionRule is null", () => {
      expect(getStampMissionTargetCount(null, 7)).toBe(7);
    });

    it("returns zero when boothCount is negative", () => {
      expect(getStampMissionTargetCount({ type: "COUNT", requiredCount: 3 }, -5)).toBe(0);
    });

    it("floors decimal boothCount values", () => {
      expect(getStampMissionTargetCount({ type: "COUNT", requiredCount: 10 }, 4.7)).toBe(4);
      expect(getStampMissionTargetCount({ type: "COUNT", requiredCount: 10 }, 4.2)).toBe(4);
    });
  });

  describe("normalizeStampTourRewards", () => {
    it("sanitizes reward quantities and random weights", () => {
      const normalized = normalizeStampTourRewards([
        { id: "a", name: "  Gift A  ", label: " 1st ", totalQty: 5, remainingQty: 9, weight: 0 },
      ], "RANDOM");

      expect(normalized[0]).toMatchObject({
        name: "Gift A",
        label: "1st",
        totalQty: 5,
        remainingQty: 5,
        weight: 1,
        order: undefined,
      });
    });

    it("assigns fallback fixed order values when missing", () => {
      const normalized = normalizeStampTourRewards([
        { id: "a", name: "Gift A", totalQty: 1, remainingQty: 1 },
        { id: "b", name: "Gift B", totalQty: 1, remainingQty: 1, order: 0 },
      ], "FIXED");

      expect(normalized[0].order).toBe(1);
      expect(normalized[1].order).toBe(2);
      expect(normalized[0].weight).toBeUndefined();
    });
  });

  describe("hasValidStampTourRewards", () => {
    it("rejects rewards with blank names or invalid quantities", () => {
      expect(hasValidStampTourRewards([
        { id: "a", name: " ", totalQty: 1, remainingQty: 1, weight: 1 },
      ], "RANDOM")).toBe(false);
    });

    it("accepts valid random rewards", () => {
      expect(hasValidStampTourRewards([
        { id: "a", name: "Gift A", label: "1등", totalQty: 3, remainingQty: 2, weight: 2 },
      ], "RANDOM")).toBe(true);
    });
  });

  describe("getSelectableStampTourRewards", () => {
    it("filters out rewards that have already completed their lottery draw", () => {
      const rewards = getSelectableStampTourRewards([
        { id: "a", name: "Gift A", totalQty: 1, remainingQty: 1, drawCompletedAt: { seconds: 1 } },
        { id: "b", name: "Gift B", totalQty: 1, remainingQty: 1 },
      ], { excludeCompletedDraws: true });

      expect(rewards).toHaveLength(1);
      expect(rewards[0].id).toBe("b");
    });
  });

  describe("reward helpers", () => {
    it("builds a combined reward title from rank and product name", () => {
      expect(getStampTourRewardTitle({ label: "1등", name: "아이패드" })).toBe("1등 - 아이패드");
    });

    it("detects completed draw rewards", () => {
      expect(isStampTourRewardDrawCompleted({ drawCompletedAt: { seconds: 1 } })).toBe(true);
      expect(isStampTourRewardDrawCompleted({})).toBe(false);
    });
  });

  describe("maskStampTourParticipantName", () => {
    describe("null/undefined/empty 처리", () => {
      it("null을 처리하여 'Name unavailable'을 반환한다", () => {
        expect(maskStampTourParticipantName(null)).toBe("Name unavailable");
      });

      it("undefined를 처리하여 'Name unavailable'을 반환한다", () => {
        expect(maskStampTourParticipantName(undefined)).toBe("Name unavailable");
      });

      it("빈 문자열을 처리하여 'Name unavailable'을 반환한다", () => {
        expect(maskStampTourParticipantName("")).toBe("Name unavailable");
      });

      it("공백만 있는 문자열을 처리하여 'Name unavailable'을 반환한다", () => {
        expect(maskStampTourParticipantName("   ")).toBe("Name unavailable");
        expect(maskStampTourParticipantName("\t\n")).toBe("Name unavailable");
      });
    });

    describe("한글 이름 마스킹", () => {
      it("1글자 이름은 첫 글자 + '*'를 반환한다", () => {
        expect(maskStampTourParticipantName("김")).toBe("김*");
        expect(maskStampTourParticipantName("이")).toBe("이*");
      });

      it("2글자 이름은 첫 글자 + '*'를 반환한다", () => {
        expect(maskStampTourParticipantName("김씨")).toBe("김*");
        expect(maskStampTourParticipantName("이철")).toBe("이*");
      });

      it("3글자 이름은 첫 글자 + '*' + 마지막 글자를 반환한다", () => {
        expect(maskStampTourParticipantName("홍길동")).toBe("홍*동");
        expect(maskStampTourParticipantName("김철수")).toBe("김*수");
      });

      it("4글자 이상 이름은 첫/마지막만 남기고 마스킹한다", () => {
        expect(maskStampTourParticipantName("김철수씨")).toBe("김**씨");
        expect(maskStampTourParticipantName("남궁철수")).toBe("남**수");
      });
    });

    describe("영어 이름 마스킹", () => {
      it("영어 이름도 올바르게 마스킹한다", () => {
        expect(maskStampTourParticipantName("John")).toBe("J**n");
        expect(maskStampTourParticipantName("Alice")).toBe("A***e");
        expect(maskStampTourParticipantName("Bob")).toBe("B*b");
      });
    });

    describe("공백 처리", () => {
      it("앞뒤 공백을 trim한 후 마스킹한다", () => {
        expect(maskStampTourParticipantName("  홍길동  ")).toBe("홍*동");
        expect(maskStampTourParticipantName("\tJohn\t")).toBe("J**n");
      });
    });
  });
});
