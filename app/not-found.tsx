import { BrandLogo } from "@/components/BrandLogo";

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div>
        <BrandLogo />
        <h1 style={{ fontSize: "3rem", marginBottom: 8 }}>Campaign unavailable</h1>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          This link may be inactive or no longer accepting donations.
        </p>
      </div>
    </main>
  );
}
