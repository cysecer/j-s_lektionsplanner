import { AppHeader } from "@/components/shell/app-header";
import { requireViewer } from "@/lib/auth/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const viewer = await requireViewer();
  return (
    <>
      <AppHeader viewer={viewer} />
      <main
        id="main"
        className="app-container mx-auto w-full max-w-6xl flex-1 px-4 py-8 print:max-w-none print:p-0"
      >
        {children}
      </main>
    </>
  );
}
