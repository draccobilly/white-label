import Link from "next/link";
import { OrganizerAvatar } from "@/components/campaign/OrganizerAvatar";
import { EmphasizedText } from "@/components/campaign/EmphasizedText";
import { VerifiedTick } from "@/components/campaign/VerifiedTick";

type Props = {
  heading: string;
  name: string;
  boldText?: string | null;
  verified?: boolean;
  imageUrl?: string | null;
  role: string;
  location?: string | null;
  messageLabel: string;
  messageHref: string | null;
  createdLabel: string | null;
  category: string | null;
  categoryHref?: string | null;
};

export function ImpactOrganizers({
  heading,
  name,
  boldText,
  verified = true,
  imageUrl,
  role,
  location,
  messageLabel,
  messageHref,
  createdLabel,
  category,
  categoryHref,
}: Props) {
  const hasMeta = Boolean(createdLabel || category);

  return (
    <section className="impact-organizers" aria-labelledby="impact-organizers-heading">
      <hr className="impact-organizers-rule" />
      <h2 id="impact-organizers-heading" className="impact-organizers-heading">
        {heading}
      </h2>
      <div className="impact-organizer">
        <OrganizerAvatar
          className="impact-organizer-avatar"
          name={name}
          imageUrl={imageUrl}
        />
        <div className="impact-organizer-copy">
          <p className="impact-organizer-name">
            <EmphasizedText text={name} bold={boldText} />
            {verified ? <VerifiedTick /> : null}
          </p>
          <p className="impact-organizer-role">{role}</p>
          {location ? <p className="impact-organizer-location">{location}</p> : null}
          {messageHref ? (
            <Link href={messageHref} className="impact-organizer-message">
              {messageLabel}
            </Link>
          ) : null}
        </div>
      </div>
      {hasMeta ? (
        <>
          <hr className="impact-organizers-rule" />
          <p className="impact-organizers-meta">
            {createdLabel}
            {createdLabel && category ? (
              <span className="impact-organizers-dot" aria-hidden>
                {" · "}
              </span>
            ) : null}
            {category ? (
              categoryHref ? (
                <Link href={categoryHref} className="impact-organizers-category">
                  {category}
                </Link>
              ) : (
                <span>{category}</span>
              )
            ) : null}
          </p>
        </>
      ) : null}
    </section>
  );
}
