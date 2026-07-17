import { notFound } from "next/navigation";

import PresentationPage from "@/components/presentation/core/PresentationPage";
import {
  getDocumentAccessForUser,
  getSessionIdentity,
} from "@/backend/share/authorization";

export const dynamic = "force-dynamic";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const [params, { userId, userEmail }] = await Promise.all([
    props.params,
    getSessionIdentity(),
  ]);
  const access = await getDocumentAccessForUser(params.id, userId, userEmail);

  if (!access.canRead) {
    notFound();
  }

  return <PresentationPage readOnly={!access.canEdit} />;
}
