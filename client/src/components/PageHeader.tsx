import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Home, LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { APP_TITLE } from "@/const";

export function PageHeader() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <header className="border-b bg-white px-4 py-3 sticky top-0 z-40">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">{APP_TITLE}</span>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/")}
                className="h-8 text-sm"
              >
                <Home className="h-4 w-4 mr-1.5" />
                Home
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await logout();
                  window.location.href = "/login";
                }}
                className="h-8 text-sm"
              >
                <LogOut className="h-4 w-4 mr-1.5" />
                Logout
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                window.location.href = "/login";
              }}
              className="h-8 text-sm"
            >
              Login
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

