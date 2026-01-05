import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Setup from "./pages/Setup";
import Model from "./pages/Model";
import Integrations from "./pages/Integrations";
import Performance from "./pages/Performance";
import WhatIfAnalysis from "./pages/WhatIfAnalysis";
import Scenarios from "./pages/Scenarios";
import ScenarioDetail from "./pages/ScenarioDetail";
import Login from "./pages/Login";
import PortalStats from "./pages/PortalStats";
import ChangeHistory from "./pages/ChangeHistory";
import CascataTest from "./pages/playground/CascataTest";
import { useInactivityTimer } from "./_core/hooks/useInactivityTimer";
import { useAuth } from "./_core/hooks/useAuth";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { INACTIVITY_TIMEOUT_MS, INACTIVITY_WARNING_MS } from "@shared/const";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Dashboard} />
      <Route path={"/how-it-works"} component={Home} />
      <Route path={"/login"} component={Login} />
      <Route path={"/setup"} component={Setup} />
      <Route path={"/model/:id"} component={Model} />
      <Route path={"/integrations"} component={Integrations} />
      <Route path={"/performance/:id"} component={Performance} />
      <Route path={"/whatif/:id"} component={WhatIfAnalysis} />
      <Route path={"/scenarios/:id"} component={Scenarios} />
      <Route path={"/scenario/:id"} component={ScenarioDetail} />
      <Route path={"/portal-stats"} component={PortalStats} />
      <Route path={"/change-history"} component={ChangeHistory} />
      <Route path={"/configure-cascata"} component={CascataTest} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

/**
 * InactivityWarningDialog Component
 * 
 * Displays a warning dialog when user is about to be logged out due to inactivity.
 */
function InactivityWarningDialog({
  open,
  onStayLoggedIn,
  timeRemaining,
}: {
  open: boolean;
  onStayLoggedIn: () => void;
  timeRemaining: number;
}) {
  // Calculate minutes and seconds remaining
  const totalSeconds = Math.max(0, Math.floor(timeRemaining / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[425px]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Session Timeout Warning</DialogTitle>
          <DialogDescription>
            You have been inactive for a while. Your session will expire in{" "}
            <strong>
              {minutes > 0 ? `${minutes} minute${minutes !== 1 ? "s" : ""} ` : ""}
              {seconds} second{seconds !== 1 ? "s" : ""}
            </strong>
            . Click "Stay Logged In" to continue your session.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onStayLoggedIn} className="w-full">
            Stay Logged In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function App() {
  const [location] = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [warningTimeRemaining, setWarningTimeRemaining] = useState(0);

  // Inactivity timer - only active when authenticated and not on login page
  const isLoginPage = location === "/login";
  const { timeRemaining, resetTimer } = useInactivityTimer({
    timeoutMs: INACTIVITY_TIMEOUT_MS,
    warningTimeMs: INACTIVITY_WARNING_MS,
    enabled: isAuthenticated && !isLoginPage,
    onWarning: () => {
      setShowWarning(true);
    },
    onTimeout: async () => {
      setShowWarning(false);
      await logout();
      // Redirect will happen automatically via useAuth
    },
  });

  // Update warning time remaining every second when warning is shown
  useEffect(() => {
    if (!showWarning) {
      setWarningTimeRemaining(0);
      return;
    }

    const interval = setInterval(() => {
      setWarningTimeRemaining(timeRemaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [showWarning, timeRemaining]);

  const handleStayLoggedIn = () => {
    setShowWarning(false);
    // Reset the timer explicitly to ensure it restarts
    resetTimer();
  };

  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <InactivityWarningDialog
            open={showWarning}
            onStayLoggedIn={handleStayLoggedIn}
            timeRemaining={warningTimeRemaining}
          />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
