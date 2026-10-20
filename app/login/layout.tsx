import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Admin",
    statusBarStyle: "default",
  },
  icons: {
    apple: [{ url: "/apple-touch-icon.png?v=3", sizes: "180x180" }],
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
