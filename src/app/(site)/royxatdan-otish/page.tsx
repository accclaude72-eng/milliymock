import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUpForm } from "@/components/auth-forms";
import { PageLoader } from "@/components/ui";

export const metadata: Metadata = { title: "Ro‘yxatdan o‘tish" };

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <SignUpForm />
    </Suspense>
  );
}
