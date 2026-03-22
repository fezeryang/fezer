import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, LogOut } from "lucide-react";

export default function AdminDashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background" data-testid="admin-dashboard">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-6 w-6" />
            <h1 className="text-xl font-semibold">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user?.email || user?.name}
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-medium mb-4">Content Management</h2>
          <p className="text-muted-foreground">
            Admin modules will be implemented in T7-T9.
          </p>
        </div>
      </main>
    </div>
  );
}
