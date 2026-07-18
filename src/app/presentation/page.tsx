import { Suspense } from "react";

import { PresentationDashboard } from "@/components/notebook/presentation/components/PresentationDashboard";

// Suspense boundary required for useSearchParams (favorites deep link) in
// the client dashboard.
export default function PresentationPage() {
  return (
    <Suspense>
      <PresentationDashboard />
    </Suspense>
  );
}
