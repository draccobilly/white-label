import { BookHeart } from "lucide-react";
import { VerseOfTheDay } from "@/components/public/VerseOfTheDay";

export function ChurchMission({
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
    <section className="wh-church" id="our-church" aria-labelledby="wh-church-heading">
      <div className="shell">
        <div className="wh-church-card">
          <div className="wh-church-copy">
            <p className="wh-kicker">
              <BookHeart size={16} strokeWidth={2} aria-hidden />
              {kicker}
            </p>
            <h2 id="wh-church-heading">{title}</h2>
            <p className="wh-church-lead">{lead}</p>
            <p>{p1}</p>
            <p>{p2}</p>
          </div>
          <VerseOfTheDay buttonLabel={verseButton} anotherLabel={verseAnother} />
        </div>
      </div>
    </section>
  );
}
