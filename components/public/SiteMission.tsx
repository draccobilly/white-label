import { BookHeart } from "lucide-react";
import { VerseOfTheDay } from "@/components/public/VerseOfTheDay";

export function SiteMission({
  kicker,
  title,
  lead,
  p1,
  p2,
  verseButton,
  verseAnother,
}: {
  kicker: string;
  title: string;
  lead: string;
  p1: string;
  p2: string;
  verseButton: string;
  verseAnother: string;
}) {
  return (
    <section className="wh-org" id="our-mission" aria-labelledby="wh-org-heading">
      <div className="shell">
        <div className="wh-org-card">
          <div className="wh-org-copy">
            <p className="wh-kicker">
              <BookHeart size={16} strokeWidth={2} aria-hidden />
              {kicker}
            </p>
            <h2 id="wh-org-heading">{title}</h2>
            <p className="wh-org-lead">{lead}</p>
            <p>{p1}</p>
            <p>{p2}</p>
          </div>
          <VerseOfTheDay buttonLabel={verseButton} anotherLabel={verseAnother} />
        </div>
      </div>
    </section>
  );
}
