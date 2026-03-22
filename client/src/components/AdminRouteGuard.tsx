import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl, isOAuthConfigured } from "@/const";
import { AlertTriangle, Lock, LogIn } from "lucide-react";
import { useEffect } from "react";
import { Button } from "./ui/button";

export type AdminRouteGuardProps = {
  children: React.ReactNode;
  redirectOnUnauthenticated?: boolean;
};

/**
 * UI-only guard for admin routes. Server-side adminProcedure is the authoritative security boundary.
 */
export function AdminRouteGuard({
  children,
  redirectOnUnauthenticated = true,
}: AdminRouteGuardProps) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (loading) return;
    if (user) return;
    if (typeof window === "undefined") return;

    const loginUrl = getLoginUrl();
    if (loginUrl) {
      window.location.href = loginUrl;
    }
  }, [redirectOnUnauthenticated, loading, user]);

  if (loading) {
    return <AdminRouteGuardSkeleton />;
  }

  if (!user) {
    const oauthConfigured = isOAuthConfigured();

    if (redirectOnUnauthenticated && oauthConfigured) {
      return <AdminRouteGuardSkeleton />;
    }

    return (
      <div
        className="flex items-center justify-center min-h-screen"
        data-testid="admin-guard-unauthenticated"
      >
        <div className="flex flex-col items-center gap-6 p-8 max-w-md w-full text-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <LogIn className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Authentication Required
            </h1>
            <p className="text-sm text-muted-foreground">
              {oauthConfigured
                ? "Please sign in to access this page."
                : "Authentication is not configured for this environment."}
            </p>
          </div>
          {oauthConfigured && (
            <Button
              onClick={() => {
                const loginUrl = getLoginUrl();
                if (loginUrl) {
                  window.location.href = loginUrl;
                }
              }}
              size="lg"
              className="w-full max-w-xs"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Sign in
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = "/";
            }}
            className="w-full max-w-xs"
          >
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        data-testid="admin-guard-forbidden"
      >
        <div className="flex flex-col items-center gap-6 p-8 max-w-md w-full text-center">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <Lock className="h-8 w-8 text-destructive" />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Access Denied
            </h1>
            <p className="text-sm text-muted-foreground">
              You don't have permission to access this page.
              This area is restricted to administrators only.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Signed in as <strong>{user.email || user.name || "Unknown"}</strong>
            </span>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = "/";
            }}
            className="w-full max-w-xs"
          >
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AdminRouteGuardSkeleton() {
  return (
    <div
      className="flex items-center justify-center min-h-screen"
      data-testid="admin-guard-loading"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-full border-2 border-muted border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Checking access...</p>
      </div>
    </div>
  );
}

export default AdminRouteGuard;
