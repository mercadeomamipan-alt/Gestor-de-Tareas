import Link from "next/link";
import { Header } from "@/components/Header";
import { ProfileForm } from "./ProfileForm";
import { requireUser } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { me } = await requireUser();
  return (
    <>
      <Header me={me} />
      <main className="page narrow">
        <div className="crumbs"><Link href="/">← Tareas</Link></div>
        <h1 style={{ fontSize: 28 }}>Tu perfil</h1>
        <ProfileForm name={me.full_name} email={me.email} />
      </main>
    </>
  );
}
