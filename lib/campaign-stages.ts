/**
 * Public goal stages. Amounts are cents.
 *
 * A campaign's ladder comes from Campaign.goalStages (set in the admin, stage 1
 * first). Only the open stage's goal is shown; when the raised amount reaches
 * it the next stage opens on its own and "Stage N Completed" appears beside
 * the new goal. The last goal stays open however much comes in. A campaign
 * without a ladder shows its single goalAmount, as before.
 */

/** Stage 1 plus up to this many more. */
export const GOAL_STAGES_MAX = 6;

/**
 * Ladders for campaigns that got stages before the admin field existed, by
 * campaign slug. Used only while Campaign.goalStages is empty. This storefront
 * has none; set stages in the admin instead.
 */
const CAMPAIGN_STAGE_GOALS: Record<string, readonly number[]> = {};

export type CampaignStageSource = {
  slug: string;
  goalAmount: number;
  goalStages: readonly number[] | null | undefined;
};

export type CampaignStageView = {
  goalAmount: number;
  stageCompletedLabel: string | null;
};

export function stageCompletedLabel(stage: number) {
  return `Stage ${stage} Completed`;
}

/** The full ladder in force for a campaign, or null when it has a single goal. */
export function goalStageLadder(campaign: CampaignStageSource): readonly number[] | null {
  const stored = (campaign.goalStages ?? []).filter(
    (cents) => Number.isInteger(cents) && cents > 0,
  );
  if (stored.length) return stored;
  return CAMPAIGN_STAGE_GOALS[campaign.slug] ?? null;
}

/** The goals after stage 1, as the admin edits them. */
export function nextGoalStages(campaign: CampaignStageSource): number[] {
  const ladder = goalStageLadder(campaign);
  if (!ladder?.length) return [];
  // The goal field is stage 1. Once that goal has moved up the ladder, the
  // field only lists the stages still above it.
  if (ladder[0] === campaign.goalAmount) return ladder.slice(1);
  return ladder.filter((cents) => cents > campaign.goalAmount);
}

/**
 * The goal field is stage 1. A list that starts with that same amount is the
 * ladder written out again ("150000, 350000" while the goal is already 150000),
 * not a second stage.
 */
function goalsFollowingStageOne(
  goalAmount: number,
  nextGoals: readonly number[] | undefined,
): readonly number[] {
  if (!nextGoals?.length) return [];
  return nextGoals[0] === goalAmount ? nextGoals.slice(1) : nextGoals;
}

/** The ladder to store for a goal and the goals typed after it; empty without next goals. */
export function goalStagesLadder(goalAmount: number, nextGoals: readonly number[] | undefined) {
  const following = goalsFollowingStageOne(goalAmount, nextGoals);
  return following.length ? [goalAmount, ...following] : [];
}

/** Why a typed ladder cannot be saved, or null when it can. */
export function goalStagesProblem(
  goalAmount: number,
  nextGoals: readonly number[] | undefined,
): string | null {
  const following = goalsFollowingStageOne(goalAmount, nextGoals);
  if (!following.length) return null;
  if (following.length > GOAL_STAGES_MAX - 1) {
    return `Goal stages: at most ${GOAL_STAGES_MAX - 1} goals after the first.`;
  }
  let previous = goalAmount;
  for (const [index, cents] of following.entries()) {
    if (!Number.isInteger(cents) || cents <= 0) {
      return `Goal stages: stage ${index + 2} is not an amount.`;
    }
    if (cents <= previous) {
      const stageAmount = cents / 100;
      const previousAmount = previous / 100;
      return `Goal stages: stage ${index + 2} (${stageAmount}) must be higher than ${
        index === 0 ? `the goal (${previousAmount})` : `stage ${index + 1} (${previousAmount})`
      }.`;
    }
    previous = cents;
  }
  return null;
}

export function campaignStageView(
  input: CampaignStageSource & { currentAmount: number },
): CampaignStageView {
  const goals = goalStageLadder(input);
  if (!goals?.length) {
    return { goalAmount: input.goalAmount, stageCompletedLabel: null };
  }

  let index = 0;
  while (index < goals.length - 1 && input.currentAmount >= goals[index]) {
    index += 1;
  }

  return {
    goalAmount: goals[index],
    stageCompletedLabel: index > 0 ? stageCompletedLabel(index) : null,
  };
}
