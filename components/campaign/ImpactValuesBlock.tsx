import Link from "next/link";
import { Atom, Heart, Megaphone, Shield } from "lucide-react";

type Props = {
  heading: string;
  easyTitle: string;
  easyBody: string;
  powerfulTitle: string;
  powerfulBody: string;
  trustedTitle: string;
  trustedBodyBefore: string;
  trustedGuarantee: string;
  trustedBodyAfter: string;
  refundHref: string;
};

export function ImpactValuesBlock({
  heading,
  easyTitle,
  easyBody,
  powerfulTitle,
  powerfulBody,
  trustedTitle,
  trustedBodyBefore,
  trustedGuarantee,
  trustedBodyAfter,
  refundHref,
}: Props) {
  return (
    <section className="impact-values" aria-labelledby="impact-values-heading">
      <div className="impact-values-inner">
        <h2 id="impact-values-heading">{heading}</h2>
        <ul className="impact-values-list">
          <li>
            <span className="impact-values-icon" aria-hidden>
              <Megaphone size={28} strokeWidth={1.4} />
              <Heart
                className="impact-values-heart"
                size={11}
                strokeWidth={1.8}
              />
            </span>
            <span>
              <strong>{easyTitle}</strong>
              <span>{easyBody}</span>
            </span>
          </li>
          <li>
            <span className="impact-values-icon" aria-hidden>
              <Atom size={28} strokeWidth={1.4} />
            </span>
            <span>
              <strong>{powerfulTitle}</strong>
              <span>{powerfulBody}</span>
            </span>
          </li>
          <li>
            <span className="impact-values-icon" aria-hidden>
              <Shield size={28} strokeWidth={1.4} />
            </span>
            <span>
              <strong>{trustedTitle}</strong>
              <span>
                {trustedBodyBefore}
                <Link href={refundHref} className="impact-values-link">{trustedGuarantee}</Link>{trustedBodyAfter}
              </span>
            </span>
          </li>
        </ul>
      </div>
    </section>
  );
}
