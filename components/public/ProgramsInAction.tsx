"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { isVideoUrl } from "@/lib/media-file";
import type { PublicSitePost } from "@/lib/site-posts";

type Props = {
  kicker: string;
  title: string;
  lead: string;
  items: PublicSitePost[];
};

function ProgramCard({ post }: { post: PublicSitePost }) {
  const media = post.coverImageUrl?.trim() || "";
  const video = Boolean(media && isVideoUrl(media));
  const player = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const node = player.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          void node.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
        } else {
          node.pause();
          setPlaying(false);
        }
      },
      { threshold: 0.45 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [media]);

  function toggle() {
    const node = player.current;
    if (!node) return;
    if (node.paused) {
      void node.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      node.pause();
      setPlaying(false);
    }
  }

  return (
    <article className="wh-program-card">
      <div className="wh-program-media">
        {video ? (
          <>
            <video
              ref={player}
              src={media}
              muted
              loop
              playsInline
              preload="metadata"
              onClick={toggle}
            />
            {!playing ? (
              <button type="button" className="wh-program-play" onClick={toggle} aria-label="Play video">
                <Play size={22} strokeWidth={2.2} fill="currentColor" />
              </button>
            ) : null}
          </>
        ) : media ? (
          <span style={{ backgroundImage: `url(${media})` }} />
        ) : null}
        {post.excerpt ? <p className="wh-program-caption">{post.excerpt}</p> : null}
      </div>
      <p className="wh-program-label">{post.title}</p>
    </article>
  );
}

export function ProgramsInAction({ kicker, title, lead, items }: Props) {
  if (!items.length) return null;
  return (
    <section className="wh-programs" id="programs" aria-labelledby="wh-programs-heading">
      <div className="shell wh-programs-grid">
        <div className="wh-programs-copy">
          <p className="wh-programs-kicker">{kicker}</p>
          <h2 id="wh-programs-heading">{title}</h2>
          <p>{lead}</p>
        </div>
        <div className="wh-programs-cards">
          {items.map((post) => (
            <ProgramCard key={post.id} post={post} />
          ))}
        </div>
      </div>
    </section>
  );
}
