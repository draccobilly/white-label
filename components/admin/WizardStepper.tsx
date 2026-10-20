"use client";

type Step = {
  id: number;
  label: string;
  /** Short description shown under the label (what the step edits). */
  hint?: string;
};

export function WizardStepper({
  steps,
  current,
  unlockedUntil,
  onSelect,
}: {
  steps: Step[];
  current: number;
  unlockedUntil: number;
  onSelect: (step: number) => void;
}) {
  const position = Math.max(1, steps.findIndex((step) => step.id === current) + 1);
  const total = steps.length;
  const currentStep = steps.find((step) => step.id === current);

  return (
    <div className="studio-wizard-head">
      <div className="studio-progress" aria-hidden>
        <span>
          Passo {position} de {total}
          {currentStep ? ` · ${currentStep.label}` : ""}
        </span>
        <span className="studio-progress-bar">
          <i style={{ width: `${(position / total) * 100}%` }} />
        </span>
      </div>
      <ol className="studio-steps" aria-label="Campaign setup steps">
        {steps.map((step) => {
          const complete = current > step.id;
          const active = current === step.id;
          const locked = step.id > unlockedUntil;
          return (
            <li
              key={step.id}
              className={[
                complete ? "is-complete" : "",
                active ? "is-active" : "",
                locked ? "is-locked" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <button
                type="button"
                disabled={locked}
                aria-current={active ? "step" : undefined}
                title={locked ? "Save the campaign to unlock this step" : undefined}
                onClick={() => onSelect(step.id)}
              >
                <span className="studio-steps-index">
                  {complete ? (
                    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
                      <path
                        d="M3.2 8.4 6.3 11.4 12.8 4.6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    step.id
                  )}
                </span>
                <span className="studio-steps-copy">
                  <span>{step.label}</span>
                  {step.hint ? <small>{step.hint}</small> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
