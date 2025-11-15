import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Setup from "./pages/Setup";
import Model from "./pages/Model";
import Integrations from "./pages/Integrations";
import BigQueryConfig from "./pages/BigQueryConfig";
import Performance from "./pages/Performance";
import WhatIfAnalysis from "./pages/WhatIfAnalysis";
import Scenarios from "./pages/Scenarios";
import ScenarioDetail from "./pages/ScenarioDetail";
import Login from "./pages/Login";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Dashboard} />
      <Route path={"/how-it-works"} component={Home} />
      <Route path={"/login"} component={Login} />
      <Route path={"/setup"} component={Setup} />
      <Route path={"/model/:id"} component={Model} />
      <Route path={"/integrations"} component={Integrations} />
      <Route path={"/bigquery/:id"} component={BigQueryConfig} />
      <Route path={"/performance/:id"} component={Performance} />
      <Route path={"/whatif/:id"} component={WhatIfAnalysis} />
      <Route path={"/scenarios/:id"} component={Scenarios} />
      <Route path={"/scenario/:id"} component={ScenarioDetail} />
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
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
