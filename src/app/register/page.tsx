import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { RegisterClient } from "./RegisterClient";

export const metadata = {
  title: "Enrollment — AEGIS",
};

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  return <RegisterClient />;
}
