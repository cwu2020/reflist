// Check if we're in development mode
const isDevelopment = typeof process !== "undefined" && process.env.NODE_ENV === "development";

// Use localhost:8888 URLs in development mode
export const DEFAULT_REDIRECTS = {
  home: isDevelopment ? "http://localhost:8888" : "https://thereflist.com",
  dub: isDevelopment ? "http://localhost:8888" : "https://thereflist.com",
  signin: isDevelopment ? "http://localhost:8888/app.thereflist.com/login" : "https://app.thereflist.com/login",
  login: isDevelopment ? "http://localhost:8888/app.thereflist.com/login" : "https://app.thereflist.com/login",
  register: isDevelopment ? "http://localhost:8888/app.thereflist.com/register" : "https://app.thereflist.com/register",
  signup: isDevelopment ? "http://localhost:8888/app.thereflist.com/register" : "https://app.thereflist.com/register",
  app: isDevelopment ? "http://localhost:8888/app.thereflist.com" : "https://app.thereflist.com",
  dashboard: isDevelopment ? "http://localhost:8888/app.thereflist.com" : "https://app.thereflist.com",
  links: isDevelopment ? "http://localhost:8888/app.thereflist.com/links" : "https://app.thereflist.com/links",
  settings: isDevelopment ? "http://localhost:8888/app.thereflist.com/settings" : "https://app.thereflist.com/settings",
  welcome: isDevelopment ? "http://localhost:8888/app.thereflist.com/onboarding/welcome" : "https://app.thereflist.com/onboarding/welcome",
  discord: "https://twitter.com/dubdotco", // placeholder for now
};

export const DUB_HEADERS = {
  "x-powered-by": "RefList - Affiliate Links for Everyone",
};

export const REDIRECTION_QUERY_PARAM = "redir_url";
