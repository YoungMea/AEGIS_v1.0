import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { listDossiersByOwner } from "@/lib/dossier";
import { DashboardClient } from "./DashboardClient";

export const metadata = {
  title: "Operations — AEGIS",
};

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const dossiers = listDossiersByOwner(user.id);

  return (
    <DashboardClient
      user={{
        id: user.id,
        uid: user.uid,
        phone: user.phone,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        bio: user.bio,
        createdAt: user.created_at,
      }}
      initialDossiers={dossiers}
    />
  );
}
