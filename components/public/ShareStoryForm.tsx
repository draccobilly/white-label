"use client";

import { useMemo, useRef, useState } from "react";
import { FileText, Film, ImageIcon, Upload, X } from "lucide-react";
import { formatMajorAmount, parseMajorAmount } from "@/lib/money-input";
import {
  priorDonationCountFromInput,
  priorRaisedCentsFromInput,
} from "@/lib/fundraiser-prior";
import { HumanCheckFields, useHumanCheck } from "@/components/public/HumanCheck";

const ACCEPT =
  "image/*,video/*,application/pdf,.heic,.heif,.pdf,.mp4,.mov,.m4v,.webm,.avi,.mkv,.png,.jpg,.jpeg,.gif,.webp";
const MAX_FILES = 8;
const MAX_BYTES = 20 * 1024 * 1024;

const EN = {
  aboutLabel: "I'd like to tell you about…",
  myself: "Myself",
  someone: "Someone I know",
  name: "Your name",
  email: "Email",
  whatsapp: "WhatsApp number",
  address: "Address",
  story: "The story, what happened, who needs help, and what a fundraiser would pay for",
  raisedHeading: "Already raised",
  raised: "Raised",
  raisedHint:
    "If you already collected gifts before opening this campaign here, enter that total. Donors see it as the starting amount, and new gifts add on top. Leave 0 to start from nothing.",
  raisedPreview: "Shown as {amount} donated. New gifts still add on top.",
  raisedInvalid: "Enter the amount already raised, or leave it at 0.",
  donations: "Donations",
  donationsHint: "How many gifts that starting total came from. New gifts still add on top.",
  donationsPreview: "Shown as “{count} donations”. New gifts still add on top.",
  donationsInvalid: "Enter how many donations that starting total came from, or leave it at 0.",
  media: "Upload files",
  mediaHint: "Photos, videos, or documents. Up to 8 files, 20 MB each. The team uses these only to evaluate the case.",
  drop: "Drop photos, videos, or files here, or browse",
  remove: "Remove file",
  consentData:
    "I authorize this organization to process my name, email, WhatsApp, address, and story to evaluate this request.",
  consentImage:
    "I authorize the team to receive and review the photos, videos, or files I attach, solely to evaluate this case. Nothing is published without a later conversation.",
  consentTerms: "I have read and agree to the",
  termsLink: "Terms",
  termsError: "Accept the Terms before sending your campaign.",
  consentNote:
    "Required. Accept the Terms to send a campaign. You can ask us to delete this submission by writing to the support email. If you attach files, media consent is required too.",
  submit: "Send",
  sending: "Sending…",
  thanks:
    "Thank you. We received your campaign. Any funds raised follow the Terms, including the hold we may keep while the case is confirmed and support is released.",
  error: "We couldn't send that just now. Please try again shortly.",
  step1: "Contact",
  step2: "Story",
  step3: "Send",
  next: "Continue",
  back: "Back",
  stepError: "Please complete this step before continuing.",
  accountHeading: "Create your organizer account",
  accountHint:
    "Choose a password. After you send the case you can sign in to follow donations, post updates, and request payouts.",
  password: "Password",
  confirmPassword: "Confirm password",
  passwordHint: "At least 8 characters with letters and a number.",
  passwordMismatch: "The two passwords do not match.",
  existingHint: "Already sent a case with this email? Use the same password, or reset it from the sign-in page.",
  openDashboard: "Open your dashboard",
};

type Labels = Partial<typeof EN>;

function fileKind(file: File) {
  if (file.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(file.name)) {
    return "video" as const;
  }
  if (file.type.startsWith("image/") || /\.(jpe?g|png|gif|webp|heic|heif|avif)$/i.test(file.name)) {
    return "image" as const;
  }
  return "file" as const;
}

function FileGlyph({ kind }: { kind: "image" | "video" | "file" }) {
  const Icon = kind === "video" ? Film : kind === "image" ? ImageIcon : FileText;
  return <Icon size={16} strokeWidth={2} aria-hidden />;
}

export function ShareStoryForm({
  labels = {},
  termsHref = "/fundraiser-terms",
  portalHref = "/portal",
  currency = "USD",
}: {
  labels?: Labels;
  termsHref?: string;
  portalHref?: string;
  currency?: string;
}) {
  const copy = { ...EN, ...labels };
  const [step, setStep] = useState(1);
  const [maxReached, setMaxReached] = useState(1);
  const [about, setAbout] = useState<"myself" | "someone">("someone");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [story, setStory] = useState("");
  const [raised, setRaised] = useState("");
  const [donations, setDonations] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [consentData, setConsentData] = useState(false);
  const [consentImage, setConsentImage] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const human = useHumanCheck();

  const steps = useMemo(
    () => [
      { id: 1, label: copy.step1 },
      { id: 2, label: copy.step2 },
      { id: 3, label: copy.step3 },
    ],
    [copy.step1, copy.step2, copy.step3],
  );

  function onFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list).filter((file) => file.size > 0 && file.size <= MAX_BYTES);
    setFiles((current) => {
      const names = new Set(current.map((file) => `${file.name}-${file.size}`));
      const next = [...current];
      for (const file of incoming) {
        const key = `${file.name}-${file.size}`;
        if (names.has(key)) continue;
        next.push(file);
        names.add(key);
        if (next.length >= MAX_FILES) break;
      }
      return next.slice(0, MAX_FILES);
    });
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, i) => i !== index));
  }

  function priorTotalsProblem() {
    if (priorRaisedCentsFromInput(raised, currency) == null) return copy.raisedInvalid;
    if (priorDonationCountFromInput(donations) == null) return copy.donationsInvalid;
    return null;
  }

  function validate(current: number) {
    if (current === 1) {
      if (!name.trim() || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return copy.stepError;
      }
      if (whatsapp.trim().length < 8 || address.trim().length < 8) {
        return copy.stepError;
      }
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        return copy.passwordHint;
      }
      if (password !== confirmPassword) {
        return copy.passwordMismatch;
      }
    }
    if (current === 2) {
      if (story.trim().length < 40) {
        return "Tell us a bit more about what happened — at least a few sentences.";
      }
      const priorProblem = priorTotalsProblem();
      if (priorProblem) return priorProblem;
    }
    if (current === 3) {
      if (!consentTerms) return copy.termsError;
      if (!consentData) return copy.consentNote;
      if (files.length > 0 && !consentImage) return copy.consentNote;
    }
    return null;
  }

  function goTo(next: number) {
    setError(null);
    if (next > step) {
      const problem = validate(step);
      if (problem) {
        setError(problem);
        return;
      }
    }
    const clamped = Math.min(3, Math.max(1, next));
    setStep(clamped);
    setMaxReached((value) => Math.max(value, clamped));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const problem = validate(3) ?? priorTotalsProblem();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStatus("sending");
    const body = new FormData();
    body.set("about", about);
    body.set("name", name);
    body.set("email", email);
    body.set("password", password);
    body.set("whatsapp", whatsapp);
    body.set("address", address);
    body.set("story", story);
    body.set(
      "priorRaisedCents",
      String(priorRaisedCentsFromInput(raised, currency) ?? 0),
    );
    body.set(
      "priorDonationCount",
      String(priorDonationCountFromInput(donations) ?? 0),
    );
    body.set("consentData", consentData ? "true" : "false");
    body.set("consentImage", consentImage ? "true" : "false");
    body.set("consentTerms", consentTerms ? "true" : "false");
    for (const file of files) body.append("media", file);
    const formToken = await human.takeToken();
    if (!formToken) {
      setStatus("error");
      setError(human.reloadError);
      return;
    }
    body.set("formToken", formToken);
    body.set("companyUrl", human.companyUrl);
    const response = await fetch("/api/share-story", {
      method: "POST",
      body,
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      portal?: boolean;
    };
    if (!response.ok) {
      setStatus("error");
      setError(payload.error ?? copy.error);
      return;
    }
    setPortalReady(Boolean(payload.portal));
    setStatus("done");
  }

  if (status === "done") {
    return (
      <div className="inst-form-thanks">
        <p>{copy.thanks}</p>
        {portalReady ? (
          <p>
            <a className="primary-button" href={portalHref}>
              {copy.openDashboard}
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form className="inst-form inst-form-wide start-wizard" onSubmit={(event) => void submit(event)}>
      <HumanCheckFields companyUrl={human.companyUrl} onCompanyUrl={human.setCompanyUrl} />
      <ol className="start-steps" aria-label="Start a fundraiser steps">
        {steps.map((item, index) => {
          const active = step === item.id;
          const done = step > item.id;
          const locked = item.id > maxReached;
          return (
            <li key={item.id} className={active ? "is-active" : done ? "is-done" : locked ? "is-locked" : ""}>
              {index > 0 ? <span className="start-steps-join" aria-hidden /> : null}
              <button type="button" disabled={locked} onClick={() => goTo(item.id)}>
                <span className="start-steps-index">{done ? "✓" : item.id}</span>
                <span>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {step === 1 ? (
        <div className="start-panel" aria-labelledby="start-step-1">
          <h3 id="start-step-1">{copy.step1}</h3>
          <fieldset>
            <legend>{copy.aboutLabel}</legend>
            <div className="start-choice">
              <label className={about === "myself" ? "is-on" : ""}>
                <input
                  type="radio"
                  name="about"
                  checked={about === "myself"}
                  onChange={() => setAbout("myself")}
                />
                {copy.myself}
              </label>
              <label className={about === "someone" ? "is-on" : ""}>
                <input
                  type="radio"
                  name="about"
                  checked={about === "someone"}
                  onChange={() => setAbout("someone")}
                />
                {copy.someone}
              </label>
            </div>
          </fieldset>
          <label>
            {copy.name}
            <input
              className="admin-input"
              required
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            {copy.email}
            <input
              className="admin-input"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            {copy.whatsapp}
            <input
              className="admin-input"
              type="tel"
              required
              minLength={8}
              autoComplete="tel"
              value={whatsapp}
              onChange={(event) => setWhatsapp(event.target.value)}
            />
          </label>
          <label>
            {copy.address}
            <textarea
              className="admin-textarea"
              required
              minLength={8}
              rows={3}
              autoComplete="street-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </label>
          <div className="start-account">
            <h4>{copy.accountHeading}</h4>
            <p className="admin-field-hint">{copy.accountHint}</p>
            <div className="start-account-grid">
              <label>
                {copy.password}
                <input
                  className="admin-input"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <label>
                {copy.confirmPassword}
                <input
                  className="admin-input"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
            </div>
            <p className="admin-field-hint">
              {copy.passwordHint} {copy.existingHint}
            </p>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="start-panel" aria-labelledby="start-step-2">
          <h3 id="start-step-2">{copy.step2}</h3>
          <label>
            {copy.story}
            <textarea
              className="admin-textarea start-story"
              required
              minLength={40}
              rows={12}
              value={story}
              onChange={(event) => setStory(event.target.value)}
            />
          </label>
          <div className="start-prior">
            <h4>{copy.raisedHeading}</h4>
            <p className="admin-field-hint">{copy.raisedHint}</p>
            <div className="start-prior-grid">
              <label>
                {copy.raised}
                <input
                  className="admin-input"
                  inputMode="decimal"
                  value={raised}
                  placeholder="0"
                  onChange={(event) => setRaised(event.target.value)}
                  onBlur={() => {
                    const cents = priorRaisedCentsFromInput(raised, currency);
                    if (cents == null) return;
                    const major = parseMajorAmount(raised, currency);
                    setRaised(major ? String(major) : "0");
                  }}
                />
                <small className="admin-help">
                  {copy.raisedPreview.replace(
                    "{amount}",
                    formatMajorAmount(
                      (priorRaisedCentsFromInput(raised, currency) ?? 0) / 100,
                      currency,
                    ) || "0",
                  )}
                </small>
              </label>
              <label>
                {copy.donations}
                <input
                  className="admin-input"
                  type="number"
                  min={0}
                  step={1}
                  value={donations}
                  placeholder="0"
                  onChange={(event) => setDonations(event.target.value)}
                />
                <small className="admin-help">
                  {copy.donationsPreview.replace(
                    "{count}",
                    String(priorDonationCountFromInput(donations) ?? 0),
                  )}
                </small>
              </label>
            </div>
            <p className="admin-field-hint">{copy.donationsHint}</p>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="start-panel" aria-labelledby="start-step-3">
          <h3 id="start-step-3">{copy.media}</h3>
          <div
            className={`start-drop${dragging ? " is-drag" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              onFiles(event.dataTransfer.files);
            }}
          >
            <input
              ref={fileInput}
              className="start-drop-input"
              type="file"
              accept={ACCEPT}
              multiple
              onChange={(event) => {
                onFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <Upload size={22} strokeWidth={2} aria-hidden />
            <strong>{copy.media}</strong>
            <p>{copy.drop}</p>
            <span className="admin-field-hint">{copy.mediaHint}</span>
            <button
              type="button"
              className="secondary-button start-browse"
              onClick={() => fileInput.current?.click()}
            >
              Browse files
            </button>
          </div>
          {files.length ? (
            <ul className="start-files">
              {files.map((file, index) => (
                <li key={`${file.name}-${file.size}-${index}`}>
                  <FileGlyph kind={fileKind(file)} />
                  <span>
                    {file.name}
                    <small>
                      {fileKind(file) === "video"
                        ? "Video"
                        : fileKind(file) === "image"
                          ? "Photo"
                          : "File"}{" "}
                      · {Math.ceil(file.size / 1024)} KB
                    </small>
                  </span>
                  <button type="button" aria-label={`${copy.remove}: ${file.name}`} onClick={() => removeFile(index)}>
                    <X size={16} strokeWidth={2.2} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <label className="inst-consent">
            <input
              type="checkbox"
              checked={consentData}
              onChange={(event) => setConsentData(event.target.checked)}
              required
            />
            <span>{copy.consentData}</span>
          </label>
          <label className="inst-consent">
            <input
              type="checkbox"
              checked={consentImage}
              onChange={(event) => setConsentImage(event.target.checked)}
              required={files.length > 0}
            />
            <span>{copy.consentImage}</span>
          </label>
          <div className="inst-consent">
            <input
              id="start-terms"
              type="checkbox"
              checked={consentTerms}
              onChange={(event) => setConsentTerms(event.target.checked)}
              required
            />
            <span>
              <label htmlFor="start-terms">{copy.consentTerms}</label>{" "}
              <a href={termsHref} target="_blank" rel="noreferrer">
                {copy.termsLink}
              </a>
              .
            </span>
          </div>
          <p className="admin-field-hint">{copy.consentNote}</p>
        </div>
      ) : null}

      <div className="start-actions">
        {step > 1 ? (
          <button className="secondary-button" type="button" onClick={() => goTo(step - 1)}>
            {copy.back}
          </button>
        ) : (
          <span />
        )}
        {step < 3 ? (
          <button className="primary-button" type="button" onClick={() => goTo(step + 1)}>
            {copy.next}
          </button>
        ) : (
          <button
            className="primary-button"
            type="submit"
            disabled={status === "sending" || !consentTerms}
          >
            {status === "sending" ? copy.sending : copy.submit}
          </button>
        )}
      </div>
      {status === "error" || error ? <p className="form-message">{error ?? copy.error}</p> : null}
    </form>
  );
}
