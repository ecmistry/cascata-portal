export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const APP_TITLE = import.meta.env.VITE_APP_TITLE || "Cascata - Transform Forecasting";

// Main logo - using logo.png
export const APP_LOGO = "/logo.png";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  // Use simple login page instead of OAuth
  return "/login";
  
  // OAuth code (kept for reference, can be re-enabled if needed):
  // const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  // const appId = import.meta.env.VITE_APP_ID;
  // 
  // // In development mode, if OAuth is not configured, use dev login endpoint
  // if (import.meta.env.DEV && !oauthPortalUrl) {
  //   console.log("[Dev Mode] Using dev login endpoint");
  //   return "/api/oauth/dev-login";
  // }
  // 
  // // Handle missing environment variables gracefully
  // if (!oauthPortalUrl) {
  //   console.error("VITE_OAUTH_PORTAL_URL is not set. Please configure it in your .env file.");
  //   // Return a placeholder URL that won't crash the app
  //   return "#";
  // }
  // 
  // if (!appId) {
  //   console.error("VITE_APP_ID is not set. Please configure it in your .env file.");
  // }
  // 
  // const redirectUri = `${window.location.origin}/api/oauth/callback`;
  // const state = btoa(redirectUri);
  //
  // try {
  //   const url = new URL(`${oauthPortalUrl}/app-auth`);
  //   url.searchParams.set("appId", appId || "");
  //   url.searchParams.set("redirectUri", redirectUri);
  //   url.searchParams.set("state", state);
  //   url.searchParams.set("type", "signIn");
  //
  //   return url.toString();
  // } catch (error) {
  //   console.error("Failed to create login URL:", error);
  //   return "#";
  // }
};
