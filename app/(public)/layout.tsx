import PageHelperFab from "@/components/page-helper-fab";

export const dynamic = "force-dynamic";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <PageHelperFab primaryRole="PUBLIC" />
    </>
  );
}
