import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Dashboard from "@/components/dashboard/Dashboard";
import { DashboardLogin } from "@/components/dashboard/DashboardLogin";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

// Dashboard entry: NextAuth email+password gate, then the full dashboard.
// Only the account in DASHBOARD_EMAIL can sign in (see lib/auth.ts).
export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return <DashboardLogin />;
  return (
    <DashboardShell email={session.user.email ?? ""}>
      <Dashboard onNavigate={() => {}} />
    </DashboardShell>
  );
}
