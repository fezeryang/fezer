import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Portfolio from "./pages/Portfolio";
import Lab from "./pages/Lab";
import Blog from "./pages/Blog";
import About from "./pages/About";
import WebPet from "./components/WebPet";

const AdminRouteGuard = lazy(() => import("./components/AdminRouteGuard"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const BlogAdmin = lazy(() => import("./pages/admin/BlogAdmin"));
const WorksAdmin = lazy(() => import("./pages/admin/WorksAdmin"));

function AdminRouteLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen" data-testid="admin-route-loading">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-full border-2 border-muted border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading admin area...</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/portfolio"} component={Portfolio} />
      <Route path={"/lab"} component={Lab} />
      <Route path={"/blog"} component={Blog} />
      <Route path={"/about"} component={About} />
      <Route path={"/admin/blog"}>
        <Suspense fallback={<AdminRouteLoading />}>
          <AdminRouteGuard>
            <BlogAdmin />
          </AdminRouteGuard>
        </Suspense>
      </Route>
      <Route path={"/admin/works"}>
        <Suspense fallback={<AdminRouteLoading />}>
          <AdminRouteGuard>
            <WorksAdmin />
          </AdminRouteGuard>
        </Suspense>
      </Route>
      <Route path={"/admin"}>
        <Suspense fallback={<AdminRouteLoading />}>
          <AdminRouteGuard>
            <AdminDashboard />
          </AdminRouteGuard>
        </Suspense>
      </Route>
      <Route path={"/admin/:rest*"}>
        <Suspense fallback={<AdminRouteLoading />}>
          <AdminRouteGuard>
            <AdminDashboard />
          </AdminRouteGuard>
        </Suspense>
      </Route>
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
          <WebPet />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
