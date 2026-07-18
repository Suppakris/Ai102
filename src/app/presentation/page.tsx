import { Suspense } from "react";

import { PresentationDashboard } from "@/components/notebook/presentation/components/PresentationDashboard";

export const metadata = { title: "Dashboard" };

// Suspense boundary required for useSearchParams (favorites deep link) in
// the client dashboard.
export default function PresentationPage() {
  return (
    <Suspense>
      <PresentationDashboard />
    </Suspense>
  );
}
