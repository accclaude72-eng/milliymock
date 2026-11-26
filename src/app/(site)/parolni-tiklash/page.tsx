import type { Metadata } from "next";
import { ResetForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Parolni tiklash" };

export default function Page() {
  return <ResetForm />;
}
