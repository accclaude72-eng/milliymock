"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { ExamPlayer } from "@/components/exam/player";
import { RequireCandidate } from "@/components/guards";
import { PageLoader } from "@/components/ui";

function Player() {
  const { id } = useParams<{ id: string }>();
  return <RequireCandidate>{() => <ExamPlayer attemptId={id} />}</RequireCandidate>;
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader label="Imtihon yuklanmoqda…" />}>
      <Player />
    </Suspense>
  );
}
