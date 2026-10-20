export function VerifiedTick({
  className = "",
  title = "Verified beneficiary",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      className={`verified-tick ${className}`.trim()}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-label={title}
      role="img"
    >
      <path
        fill="#1877F2"
        d="M12.02 1.15 14.16 3.7l3.22-.62 1.34 3.04 3.05 1.33-.62 3.22 2.55 2.14-2.55 2.14.62 3.22-3.05 1.33-1.34 3.04-3.22-.62-2.14 2.55-2.14-2.55-3.22.62-1.34-3.04-3.05-1.33.62-3.22L1.3 11.81l2.55-2.14-.62-3.22 3.05-1.33 1.34-3.04 3.22.62z"
      />
      <path
        fill="#fff"
        d="M10.12 15.42 6.7 12l1.27-1.27 2.15 2.15 5.16-5.16 1.27 1.27z"
      />
    </svg>
  );
}
