"use client";

import { useEffect, useState, type ComponentType } from "react";
import heartAnimation from "@/components/checkout/heart-lottie.json";

type LottiePlayer = ComponentType<{
  src: object;
  autoplay?: boolean;
  loop?: boolean;
  className?: string;
  "aria-hidden"?: boolean;
}>;

export function ImpactCheckoutHeart() {
  const [Lottie, setLottie] = useState<LottiePlayer | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("lottie-react").then((mod) => {
      if (!cancelled) setLottie(() => mod.Lottie as LottiePlayer);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Lottie) {
    return <span className="impact-donate-heart" aria-hidden />;
  }

  return (
    <Lottie
      src={heartAnimation}
      autoplay
      loop
      className="impact-donate-heart"
      aria-hidden
    />
  );
}
