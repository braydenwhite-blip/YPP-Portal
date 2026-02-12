import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getWorldData } from "@/lib/world-actions";
import PassionWorld from "@/components/world/passion-world";

export const metadata = {
  title: "The Passion World | YPP",
};

export default async function WorldPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const data = await getWorldData();

  return <PassionWorld data={data} />;
}
