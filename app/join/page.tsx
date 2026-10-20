import type { Metadata } from "next";
import { JoinForm } from "@/components/admin/JoinForm";

export const metadata: Metadata = {
  title: "Create account",
};

export default function JoinPage() {
  return <JoinForm />;
}
