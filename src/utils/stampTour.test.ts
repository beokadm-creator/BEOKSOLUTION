import {
  getSelectableStampTourRewards,
  getStampMissionTargetCount,
  getStampTourRewardTitle,
  hasValidStampTourRewards,
  isStampTourRewardDrawCompleted,
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
});
