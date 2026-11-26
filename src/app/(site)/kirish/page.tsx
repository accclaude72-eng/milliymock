import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth-forms";
import { PageLoader } from "@/components/ui";

export const metadata: Metadata = { title: "Kirish" };

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <SignInForm />
    </Suspense>
  );
}
