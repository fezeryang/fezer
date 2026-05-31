import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { gsap } from "gsap";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import RouteLoadingScreen from "./components/RouteLoadingScreen";

const WebPet = lazy(() => import("./components/WebPet"));
const Jianli = lazy(() => import("./pages/Jianli"));
const Xizang = lazy(() => import("./pages/Xizang"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const Lab = lazy(() => import("./pages/Lab"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogSurface = lazy(() => import("./pages/BlogSurface"));
const BlogPostDetail = lazy(() => import("./pages/BlogPostDetail"));
const About = lazy(() => import("./pages/About"));
const AboutLogo = lazy(() => import("./pages/AboutLogo"));
const AboutLogoOne = lazy(() => import("./pages/AboutLogoOne"));
const AboutLogoTwo = lazy(() => import("./pages/AboutLogoTwo"));
const AdminRouteGuard = lazy(() => import("./components/AdminRouteGuard"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const BlogAdmin = lazy(() => import("./pages/admin/BlogAdmin"));
const WorksAdmin = lazy(() => import("./pages/admin/WorksAdmin"));

const LAYER_DURATION_SECONDS = 1.3;
const LAYER_STAGGER_SECONDS = 0.3;
const OVERLAY_RADIUS = "3rem";
const GSAP_EASE = "power4.out";

type RouteTransitionPhase = "idle" | "revealing";

const isAdminPath = (path: string) =>
  path === "/admin" || path.startsWith("/admin/");

const getReducedMotionPreference = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

function AdminRouteLoading() {
  return (
    <div data-testid="admin-route-loading">
      <RouteLoadingScreen
        title="Loading admin area..."
        subtitle="Authenticating and preparing dashboard modules."
      />
    </div>
  );
}

function RedirectTo({ to }: { to: string }) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation(to);
  }, [setLocation, to]);

  return null;
}

function RoutePageLoading() {
  return (
    <RouteLoadingScreen
      title="Loading page..."
      subtitle="Fetching the next scene and assets."
    />
  );
}

function Router() {
  const [location] = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [phase, setPhase] = useState<RouteTransitionPhase>("idle");
  const [reducedMotion, setReducedMotion] = useState(
    getReducedMotionPreference
  );
  const queuedLocationRef = useRef<string | null>(null);
  const loadingBoxRef = useRef<HTMLDivElement>(null);
  const loadingAnimationRef = useRef<HTMLDivElement>(null);
  const loadingTransitionRef = useRef<HTMLDivElement>(null);
  const loadingInnerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const currentTargetRef = useRef(displayLocation);
  const transitionIdRef = useRef(0);

  const hideLoadingBox = useCallback(() => {
    if (loadingBoxRef.current) {
      gsap.set(loadingBoxRef.current, {
        autoAlpha: 0,
        pointerEvents: "none",
        display: "none",
      });
    }
  }, []);

  const showLoadingBox = useCallback(() => {
    if (loadingBoxRef.current) {
      gsap.set(loadingBoxRef.current, {
        display: "flex",
        autoAlpha: 1,
        pointerEvents: "auto",
      });
    }
  }, []);

  const clearTransition = useCallback(
    (invalidate = false) => {
      if (invalidate) {
        transitionIdRef.current += 1;
      }

      timelineRef.current?.kill();
      timelineRef.current = null;

      hideLoadingBox();
    },
    [hideLoadingBox]
  );

  const runTransition = useCallback(
    (nextLocation: string) => {
      clearTransition();
      transitionIdRef.current += 1;
      const transitionId = transitionIdRef.current;
      const loadingAnimation = loadingAnimationRef.current;
      const loadingTransition = loadingTransitionRef.current;
      const loadingInner = loadingInnerRef.current;

      if (!loadingAnimation || !loadingTransition || !loadingInner) {
        setDisplayLocation(nextLocation);
        setPhase("idle");
        return;
      }

      const locationToDisplay = queuedLocationRef.current ?? nextLocation;
      queuedLocationRef.current = null;
      currentTargetRef.current = locationToDisplay;
      setPhase("revealing");

      const timelineEndSeconds = LAYER_STAGGER_SECONDS + LAYER_DURATION_SECONDS;

      gsap.set(loadingAnimation, {
        xPercent: 0,
        borderRadius: "0rem",
      });
      gsap.set(loadingTransition, {
        xPercent: 0,
        borderRadius: "0rem",
      });
      gsap.set(loadingInner, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
      });

      showLoadingBox();
      setDisplayLocation(locationToDisplay);

      const timeline = gsap.timeline({ defaults: { ease: GSAP_EASE } });
      timelineRef.current = timeline;

      timeline
        .to(
          loadingInner,
          {
            autoAlpha: 0,
            y: -8,
            duration: 0.28,
            ease: "power2.inOut",
          },
          0
        )
        .to(
          loadingTransition,
          {
            xPercent: 100,
            duration: LAYER_DURATION_SECONDS,
            borderRadius: OVERLAY_RADIUS,
          },
          0
        )
        .to(
          loadingAnimation,
          {
            xPercent: 100,
            duration: LAYER_DURATION_SECONDS,
            borderRadius: OVERLAY_RADIUS,
          },
          LAYER_STAGGER_SECONDS
        )
        .add(() => {
          if (transitionIdRef.current !== transitionId) {
            return;
          }

          setPhase("idle");
          hideLoadingBox();
          timelineRef.current = null;

          const queued = queuedLocationRef.current;
          queuedLocationRef.current = null;

          if (queued && queued !== currentTargetRef.current) {
            runTransition(queued);
          }
        }, timelineEndSeconds);
    },
    [clearTransition, hideLoadingBox, showLoadingBox]
  );

  useEffect(() => {
    hideLoadingBox();
  }, [hideLoadingBox]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setReducedMotion(media.matches);
    syncPreference();

    media.addEventListener("change", syncPreference);
    return () => media.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    return () => {
      clearTransition(true);
    };
  }, [clearTransition]);

  useEffect(() => {
    if (location === displayLocation) {
      return;
    }

    if (
      reducedMotion ||
      isAdminPath(location) ||
      isAdminPath(displayLocation)
    ) {
      clearTransition(true);
      queuedLocationRef.current = null;
      currentTargetRef.current = location;
      setDisplayLocation(location);
      setPhase("idle");
      return;
    }

    if (phase === "idle") {
      runTransition(location);
      return;
    }

    queuedLocationRef.current = location;
  }, [
    clearTransition,
    displayLocation,
    location,
    phase,
    reducedMotion,
    runTransition,
  ]);

  return (
    <div className="route-transition-shell" data-phase={phase}>
      <div className="route-transition-scene">
        <Suspense fallback={<RoutePageLoading />}>
          <Switch location={displayLocation}>
            <Route path={"/"} component={Home} />
            <Route path={"/jianli"} component={Jianli} />
            <Route path={"/portfolio"} component={Portfolio} />
            <Route path={"/xizang"} component={Xizang} />
            <Route path={"/lab"} component={Lab} />
            <Route path={"/blog"} component={Blog} />
            <Route path={"/blog/surface"} component={BlogSurface} />
            <Route path={"/blog/:slug"}>
              {params => <BlogPostDetail slug={params.slug} />}
            </Route>
            <Route path={"/lab/logo/logo1"} component={AboutLogoOne} />
            <Route path={"/lab/logo/logo2"} component={AboutLogoTwo} />
            <Route path={"/lab/logo"} component={AboutLogo} />
            <Route path={"/about/logo/logo1"}>
              <RedirectTo to="/lab/logo/logo1" />
            </Route>
            <Route path={"/about/logo/logo2"}>
              <RedirectTo to="/lab/logo/logo2" />
            </Route>
            <Route path={"/about/logo"}>
              <RedirectTo to="/lab/logo" />
            </Route>
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
        </Suspense>
      </div>

      <div
        ref={loadingBoxRef}
        id="loadingbox"
        className="loadingbox"
        aria-hidden="true"
      >
        <div ref={loadingAnimationRef} className="loading-animation">
          <div ref={loadingInnerRef} className="loading-inner">
            <svg
              className="loading-logo"
              viewBox="0 0 100 100"
              aria-hidden="true"
            >
              <path d="M50 10L88 50L50 90L12 50Z" />
              <path d="M50 24L74 50L50 76L26 50Z" className="accent" />
              <path d="M22 50H78" />
              <path d="M50 22V78" />
            </svg>
            <div className="loading-text" data-glitch="KINETIC.LAB">
              KINETIC.LAB
            </div>
          </div>
        </div>
        <div ref={loadingTransitionRef} className="loading-transition" />
      </div>
    </div>
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
          <WebPetWrapper />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

// WebPet 只在非 jianli 页面显示
function WebPetWrapper() {
  const [location] = useLocation();
  if (location === "/jianli") return null;
  return (
    <Suspense fallback={null}>
      <WebPet />
    </Suspense>
  );
}

export default App;
