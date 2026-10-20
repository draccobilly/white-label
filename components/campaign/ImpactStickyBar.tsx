"use client";

import { useEffect, useState } from "react";
import { ImpactProgressRing } from "@/components/campaign/ImpactProgressRing";
import { ImpactShareButton } from "@/components/campaign/ImpactShareButton";
import { DonateTrigger } from "@/components/campaign/DonateModalContext";
import { StageGoal } from "@/components/campaign/StageGoal";

type Props = {
  percent: number;
  raised: string;
  raisedSuffix: string;
  ofLabel: string;
  goal: string;
  stageCompletedLabel?: string | null;
  socialProof: string;
  checkoutHref: string;
  donateLabel: string;
  campaignId: string;
  title: string;
  shareLabel: string;
  copiedLabel: string;
  proofHref?: string;
  showYou?: boolean;
};

export function ImpactStickyBar({
  percent,
  raised,
  raisedSuffix,
  ofLabel,
  goal,
  stageCompletedLabel,
  socialProof,
  checkoutHref,
  donateLabel,
  campaignId,
  title,
  shareLabel,
  copiedLabel,
  proofHref = "#donations",
  showYou = false,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const donations =
      document.getElementById("recent-donations") ??
      document.getElementById("donations");
    const update = () => {
      const atTop = window.scrollY < 72;
      if (!donations) {
        setVisible(!atTop && window.scrollY > 280);
        return;
      }
      const top = donations.getBoundingClientRect().top;
      const reachedDonations = top < window.innerHeight * 0.72;
      setVisible(!atTop && reachedDonations);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      className={`impact-sticky-bar is-gated${visible ? " is-visible" : ""}`}
      aria-hidden={!visible}
    >
      <div className="impact-sticky-stats">
        <ImpactProgressRing percent={percent} showYou={showYou} />
        <div className="impact-sticky-copy">
          <p className="impact-sticky-raised">
            <strong>
              {raised} {raisedSuffix}
            </strong>{" "}
            {ofLabel}{" "}
            <StageGoal amount={goal} stageCompletedLabel={stageCompletedLabel} />
          </p>
          <a href={proofHref} className="impact-sticky-proof">
            {socialProof}
            <span aria-hidden> ›</span>
          </a>
        </div>
      </div>
      <div className="impact-sticky-actions">
        <DonateTrigger href={checkoutHref} className="impact-sticky-donate">
          {donateLabel}
        </DonateTrigger>
        <ImpactShareButton
          campaignId={campaignId}
          title={title}
          shareLabel={shareLabel}
          copiedLabel={copiedLabel}
          className="impact-sticky-share"
        />
      </div>
    </div>
  );
}
