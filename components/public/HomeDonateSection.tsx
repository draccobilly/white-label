"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { PayPalPayButton } from "@/components/checkout/PayPalPayButton";
import {
  CAUSE_PAGE_ID,
  causeGivePath,
  causePath,
  causeText,
  FOUNDATION_CAUSES,
} from "@/lib/foundation-causes";
import { parseDonationInput, publicDonationTickets, STANDARD_DONATION_AMOUNTS } from "@/lib/donation-ticket";
import { formatMoney, progressPercent } from "@/lib/utils";

const RECOMMENDED_CENTS = 10_000;

const TICKETS = STANDARD_DONATION_AMOUNTS.map((amount) => ({
  id: `home-${amount}`,
  amount,
  suggested: amount === RECOMMENDED_CENTS,
  paymentLinkId: null,
}));

const COPY = {
  en: {
    kicker: "Choose a cause",
    heading: "Public causes",
    donateKicker: "Make a donation",
    donateHeading: "Choose an amount",
    lead: "One-time gifts. Pick a ticket, choose the cause, then pay by card or PayPal.",
    amounts: "Donation amounts",
    recommended: "Recommended",
    custom: "Enter your donation",
    customLabel: "Enter your donation in dollars",
    goesTo: "This gift goes to",
    donate: "Donate",
    donated: "donated",
    of: "of",
  },
  es: {
    kicker: "Elige una causa",
    heading: "Causas públicas",
    donateKicker: "Haz una donación",
    donateHeading: "Elige un monto",
    lead: "Regalos únicos. Elige un boleto, la causa, y paga con tarjeta o PayPal.",
    amounts: "Montos de donación",
    recommended: "Recomendado",
    custom: "Escribe tu donación",
    customLabel: "Escribe tu donación en dólares",
    goesTo: "Este regalo va a",
    donate: "Donar",
    donated: "donados",
    of: "de",
  },
} as const;

function dollars(cents: number) {
  return String(cents / 100);
}

export function HomeDonateSection({
  lang = "en",
  paypalClientId = "",
}: {
  lang?: "en" | "es";
  paypalClientId?: string;
}) {
  const copy = COPY[lang];
  const tickets = useMemo(() => publicDonationTickets("USD", TICKETS), []);
  const recommended = tickets.find((ticket) => ticket.amount === RECOMMENDED_CENTS) ?? tickets[0];
  const [selectedId, setSelectedId] = useState(recommended?.id ?? "");
  const [customOn, setCustomOn] = useState(false);
  const [customRaw, setCustomRaw] = useState(recommended ? dollars(recommended.amount) : "");
  const [causeSlug, setCauseSlug] = useState(FOUNDATION_CAUSES[0]?.slug ?? "");
  const selected = tickets.find((item) => item.id === selectedId) ?? recommended;
  const customCents = customOn ? parseDonationInput(customRaw, "USD") : null;
  const amount = customOn ? customCents : selected?.amount ?? null;
  const cause = FOUNDATION_CAUSES.find((item) => item.slug === causeSlug) ?? FOUNDATION_CAUSES[0];
  const [paypalError, setPaypalError] = useState("");
  const reportPaypal = useCallback((message: string) => setPaypalError(message), []);

  return (
    <div className="ch-give-block">
      <div className="ch-cause-head">
        <p className="ch-kicker">{copy.kicker}</p>
        <h2 id="ch-cause-grid-heading">{copy.heading}</h2>
      </div>
      <ul className="ch-cause-grid" aria-labelledby="ch-cause-grid-heading">
        {FOUNDATION_CAUSES.map((item) => {
          const text = causeText(item, lang);
          const percent = progressPercent(item.currentAmount, item.goalAmount);
          return (
            <li key={item.slug} className={item.slug === cause?.slug ? "is-selected" : ""}>
              <Link href={causePath(item.slug, lang)}>
                <span className="ch-cause-photo" style={{ backgroundImage: `url(${item.image})` }} />
                <strong>{text.title}</strong>
                <span className="ch-cause-progress">
                  <span className="ch-cause-bar" aria-hidden>
                    <i style={{ width: `${percent}%` }} />
                  </span>
                  <em>
                    {formatMoney(item.currentAmount, "USD")} {copy.donated}
                    <span>
                      {" "}
                      · {percent}% {copy.of} {formatMoney(item.goalAmount, "USD")}
                    </span>
                  </em>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="ch-donate-panel" id="donate">
        <p className="ch-kicker">{copy.donateKicker}</p>
        <h3>{copy.donateHeading}</h3>
        <p className="ch-donate-lead">{copy.lead}</p>
        <div className="ch-ticket-grid" role="group" aria-label={copy.amounts}>
          {tickets.map((ticket) => (
            <button
              type="button"
              key={ticket.id}
              className={amount === ticket.amount ? "is-selected" : ""}
              aria-pressed={amount === ticket.amount}
              onClick={() => {
                setCustomOn(false);
                setSelectedId(ticket.id);
                setCustomRaw(dollars(ticket.amount));
              }}
            >
              {ticket.amount === RECOMMENDED_CENTS ? <em>{copy.recommended}</em> : null}
              {formatMoney(ticket.amount, "USD")}
            </button>
          ))}
        </div>
        <label className="ch-custom">
          <span>{copy.custom}</span>
          <span className="ch-custom-field">
            <span className="ch-custom-sign" aria-hidden>
              $
            </span>
            <input
              inputMode="decimal"
              value={customOn ? customRaw : selected ? dollars(selected.amount) : ""}
              aria-label={copy.customLabel}
              onFocus={() => {
                if (!customOn && selected) setCustomRaw(dollars(selected.amount));
                setCustomOn(true);
              }}
              onChange={(event) => {
                setCustomOn(true);
                setCustomRaw(event.target.value);
              }}
            />
          </span>
        </label>
        <label className="ch-cause-pick">
          <span>{copy.goesTo}</span>
          <select value={cause?.slug} onChange={(event) => setCauseSlug(event.target.value)}>
            {FOUNDATION_CAUSES.map((item) => (
              <option key={item.slug} value={item.slug}>
                {causeText(item, lang).title}
              </option>
            ))}
          </select>
        </label>
        {cause && amount ? (
          <Link className="ch-donate-go" href={causeGivePath(cause.slug, lang, amount)}>
            {copy.donate} {formatMoney(amount, "USD")}
          </Link>
        ) : (
          <button type="button" className="ch-donate-go" disabled>
            {copy.donate}
          </button>
        )}
        {paypalClientId && cause && amount ? (
          <PayPalPayButton
            affiliatePageId={CAUSE_PAGE_ID}
            campaignPath={causePath(cause.slug, lang)}
            clientId={paypalClientId}
            currency="USD"
            locale={lang}
            donationCents={amount}
            tipCents={0}
            comment={null}
            disabled={false}
            hidden={false}
            causeSlug={cause.slug}
            onError={reportPaypal}
          />
        ) : null}
        {paypalError ? <p className="ch-donate-error">{paypalError}</p> : null}
      </div>
    </div>
  );
}
