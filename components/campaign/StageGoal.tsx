export function StageGoal({
  amount,
  stageCompletedLabel,
  amountClassName = "impact-raised-goal-amount",
}: {
  amount: string;
  stageCompletedLabel?: string | null;
  amountClassName?: string;
}) {
  if (!stageCompletedLabel) {
    return <span className={amountClassName}>{amount}</span>;
  }

  return (
    <span className="campaign-goal">
      <span className={amountClassName}>{amount}</span>
      <span className="campaign-stage-tag">{stageCompletedLabel}</span>
    </span>
  );
}
