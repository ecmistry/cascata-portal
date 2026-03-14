import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, RefreshCw, BarChart3, History, ChevronDown, ChevronRight, Database, Layers, BookOpen, ShieldCheck } from "lucide-react";
import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 240; /* Narrower sidebar for cleaner look */
const MIN_WIDTH = 180;
const MAX_WIDTH = 320;

/**
 * DashboardLayout Component
 * 
 * Main layout component for the application, providing:
 * - Resizable sidebar with navigation menu
 * - Top navigation bar with user profile and dashboard link
 * - Company/model selection dropdown
 * - Settings section with Portal Stats and Change History
 * - Responsive design for mobile and desktop
 * 
 * The sidebar includes:
 * - Navigation items (Home, Models, etc.)
 * - Company/model list with active state highlighting
 * - Settings section (collapsible)
 * - User profile menu in footer
 * 
 * @param children - React nodes to render in the main content area
 * 
 * @returns A layout component with sidebar, top bar, and content area
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <div className="relative group">
              <div className="relative">
                <img
                  src={APP_LOGO}
                  alt={APP_TITLE}
                  className="h-20 w-20 rounded-xl object-cover shadow"
                />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">{APP_TITLE}</h1>
              <p className="text-sm text-muted-foreground">
                Please sign in to continue
              </p>
            </div>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
  // Auto-expand settings if on a settings page
  useEffect(() => {
    if (location === "/portal-stats" || location === "/change-history" || location === "/how-it-works" || location === "/data-quality") {
      setSettingsExpanded(true);
    }
  }, [location]);
  
  // Fetch companies/models for sidebar
  const { data: companies = [], isLoading: companiesLoading } = trpc.company.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const companyId = companies[0]?.id ?? 1;
  const { data: cascadeSheetsData, isLoading: cascadeSheetsLoading } = trpc.cascade.availableSheets.useQuery(
    { companyId },
    { enabled: isAuthenticated },
  );
  const cascadeSheets = cascadeSheetsData?.sheets ?? [];
  
  // Get current model ID from URL if on model page
  const currentModelId = location.startsWith("/model/") 
    ? parseInt(location.split("/model/")[1]?.split("/")[0] || "0")
    : null;

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-12 border-b border-sidebar-border">
            <div className="flex items-center gap-2 px-2 sm:px-3 transition-all w-full">
              {isCollapsed ? (
                <div className="relative h-6 w-6 shrink-0">
                  <img
                    src={APP_LOGO}
                    className="h-6 w-6 rounded object-cover"
                    alt="Logo"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <img
                    src={APP_LOGO}
                    className="h-6 w-6 rounded object-cover shrink-0"
                    alt="Logo"
                  />
                  <span className="text-sm font-medium truncate text-foreground">
                    {APP_TITLE}
                  </span>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            {/* Configure Cascata Environment */}
            <div className="px-2 py-2 border-b border-sidebar-border">
              <SidebarMenu className="gap-0">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={location === "/configure-cascata"}
                    onClick={() => setLocation("/configure-cascata")}
                    tooltip="Configure Cascata Environment"
                    className={`h-9 transition-all font-normal text-sm w-full justify-start gap-2 ${
                      location === "/configure-cascata" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-accent"
                    }`}
                  >
                    <Database
                      className={`h-4 w-4 ${location === "/configure-cascata" ? "text-sidebar-accent-foreground" : "text-muted-foreground"}`}
                    />
                    <span className={location === "/configure-cascata" ? "font-medium" : ""}>Configure Cascata Environment</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </div>

            {/* Cascade Sheets - Dynamically generated from available data */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-2 py-2">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {isCollapsed ? "" : "Cascade Sheets"}
                </div>
              </div>
              <SidebarMenu className="px-2 py-1">
                {cascadeSheets.length === 0 && !cascadeSheetsLoading && (
                  <SidebarMenuItem>
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      {isCollapsed ? "" : "No data yet"}
                    </div>
                  </SidebarMenuItem>
                )}
                {cascadeSheetsLoading && (
                  <SidebarMenuItem>
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      {isCollapsed ? "" : "Loading..."}
                    </div>
                  </SidebarMenuItem>
                )}
                {cascadeSheets.map((sheet) => {
                  const path = `/cascade/${sheet.motion}/${sheet.region}`;
                  const isActive = location === path;
                  return (
                    <SidebarMenuItem key={path}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => setLocation(path)}
                        tooltip={sheet.label}
                        className={`h-8 transition-all font-normal text-sm ${
                          isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-accent"
                        }`}
                      >
                        <Layers
                          className={`h-4 w-4 ${isActive ? "text-sidebar-accent-foreground" : "text-muted-foreground"}`}
                        />
                        <span className={isActive ? "font-medium" : ""}>{sheet.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </div>

            {/* Settings Section */}
            <div className="border-t border-sidebar-border">
              {!isCollapsed && (
                <div className="px-2 py-2">
                  <button
                    onClick={() => setSettingsExpanded(!settingsExpanded)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:bg-accent rounded-md transition-colors"
                  >
                    {settingsExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    Settings
                  </button>
                </div>
              )}
              {settingsExpanded && !isCollapsed && (
                <SidebarMenu className="px-2 py-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={location === "/data-quality"}
                      onClick={() => setLocation("/data-quality")}
                      tooltip="Data Quality"
                      className={`h-9 transition-all font-normal text-sm ${
                        location === "/data-quality" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-accent"
                      }`}
                    >
                      <ShieldCheck
                        className={`h-4 w-4 ${location === "/data-quality" ? "text-sidebar-accent-foreground" : "text-muted-foreground"}`}
                      />
                      <span className={location === "/data-quality" ? "font-medium" : ""}>Data Quality</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={location === "/portal-stats"}
                      onClick={() => setLocation("/portal-stats")}
                      tooltip="Portal Stats"
                      className={`h-9 transition-all font-normal text-sm ${
                        location === "/portal-stats" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-accent"
                      }`}
                    >
                      <BarChart3
                        className={`h-4 w-4 ${location === "/portal-stats" ? "text-sidebar-accent-foreground" : "text-muted-foreground"}`}
                      />
                      <span className={location === "/portal-stats" ? "font-medium" : ""}>Portal Stats</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={location === "/change-history"}
                      onClick={() => setLocation("/change-history")}
                      tooltip="Change History"
                      className={`h-9 transition-all font-normal text-sm ${
                        location === "/change-history" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-accent"
                      }`}
                    >
                      <History
                        className={`h-4 w-4 ${location === "/change-history" ? "text-sidebar-accent-foreground" : "text-muted-foreground"}`}
                      />
                      <span className={location === "/change-history" ? "font-medium" : ""}>Change History</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={location === "/how-it-works"}
                      onClick={() => setLocation("/how-it-works")}
                      tooltip="Documentation"
                      className={`h-9 transition-all font-normal text-sm ${
                        location === "/how-it-works" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-accent"
                      }`}
                    >
                      <BookOpen
                        className={`h-4 w-4 ${location === "/how-it-works" ? "text-sidebar-accent-foreground" : "text-muted-foreground"}`}
                      />
                      <span className={location === "/how-it-works" ? "font-medium" : ""}>Documentation</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              )}
              {isCollapsed && (
                <SidebarMenu className="px-2 py-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={location === "/data-quality"}
                      onClick={() => setLocation("/data-quality")}
                      tooltip="Data Quality"
                      className={`h-9 transition-all font-normal text-sm ${
                        location === "/data-quality" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-accent"
                      }`}
                    >
                      <ShieldCheck
                        className={`h-4 w-4 ${location === "/data-quality" ? "text-sidebar-accent-foreground" : "text-muted-foreground"}`}
                      />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={location === "/portal-stats"}
                      onClick={() => setLocation("/portal-stats")}
                      tooltip="Portal Stats"
                      className={`h-9 transition-all font-normal text-sm ${
                        location === "/portal-stats" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-accent"
                      }`}
                    >
                      <BarChart3
                        className={`h-4 w-4 ${location === "/portal-stats" ? "text-sidebar-accent-foreground" : "text-muted-foreground"}`}
                      />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={location === "/change-history"}
                      onClick={() => setLocation("/change-history")}
                      tooltip="Change History"
                      className={`h-9 transition-all font-normal text-sm ${
                        location === "/change-history" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-accent"
                      }`}
                    >
                      <History
                        className={`h-4 w-4 ${location === "/change-history" ? "text-sidebar-accent-foreground" : "text-muted-foreground"}`}
                      />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={location === "/how-it-works"}
                      onClick={() => setLocation("/how-it-works")}
                      tooltip="Documentation"
                      className={`h-9 transition-all font-normal text-sm ${
                        location === "/how-it-works" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-accent"
                      }`}
                    >
                      <BookOpen
                        className={`h-4 w-4 ${location === "/how-it-works" ? "text-sidebar-accent-foreground" : "text-muted-foreground"}`}
                      />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              )}
            </div>
            
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-1 w-full rounded-md hover:bg-accent transition-colors group-data-[collapsible=icon]:justify-center">
                  <Avatar className="h-8 w-8 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-muted">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate text-foreground">
                      {user?.name || "User"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user?.email || ""}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={async () => {
                    await logout();
                    window.location.href = "/login";
                  }}
                  className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {/* Thin top bar */}
        <div className="flex border-b h-12 items-center justify-between bg-white px-2 sm:px-4 sticky top-0 z-40">
          <div className="flex items-center gap-1 sm:gap-3">
            {isMobile && <SidebarTrigger className="h-9 w-9" />}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setLocation("/")}
              className={`h-9 text-xs sm:text-sm ${
                location === "/" ? "text-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              <LayoutDashboard className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
          </div>
          <TopBarActions user={user} location={location} setLocation={setLocation} companyId={companyId} />
        </div>
        <main className="flex-1 bg-white p-3 sm:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}

function TopBarActions({
  user,
  location,
  setLocation,
  companyId,
}: {
  user: any;
  location: string;
  setLocation: (path: string) => void;
  companyId: number;
}) {
  const utils = trpc.useUtils();
  const syncMutation = trpc.cascade.triggerSync.useMutation({
    onSuccess: (data) => {
      toast.success(
        `HubSpot sync complete — ${data.contactsFetched} contacts, ${data.dealsFetched} deals fetched in ${(data.durationMs / 1000).toFixed(1)}s`,
      );
      utils.invalidate();
    },
    onError: (err) => {
      toast.error(`Sync failed: ${err.message}`);
    },
  });

  const handleRefresh = useCallback(() => {
    if (syncMutation.isPending) return;
    toast.info("Syncing data from HubSpot...");
    syncMutation.mutate({ companyId });
  }, [companyId, syncMutation]);

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLocation("/how-it-works")}
        className={`h-9 text-xs sm:text-sm ${
          location === "/how-it-works" ? "text-foreground font-medium" : "text-muted-foreground"
        }`}
      >
        <BookOpen className="h-4 w-4 sm:mr-1.5" />
        <span className="hidden sm:inline">Documentation</span>
        <span className="sm:hidden">Docs</span>
      </Button>
      {user ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={syncMutation.isPending}
          className="h-9 text-xs sm:text-sm text-muted-foreground"
        >
          <RefreshCw className={`h-4 w-4 sm:mr-1.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">
            {syncMutation.isPending ? "Syncing..." : "Refresh"}
          </span>
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={() => { window.location.href = "/login"; }}
          className="h-9 text-xs sm:text-sm"
        >
          Login
        </Button>
      )}
    </div>
  );
}
