// lib/shopmyClient.ts
import axios from "axios";

function getServerBaseUrl() {
  // Point to your prod domain for SSR or non-browser contexts
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return `https://${process.env.NEXT_PUBLIC_API_BASE_URL}`;
  }
  // Fallback (local dev)
  return "";
}

export const shopmyClient = axios.create({
  baseURL: typeof window === "undefined"
    ? getServerBaseUrl()
    : "",                  // ← empty = “same origin” in the browser
  withCredentials: true,  // send cookies on same-origin or sameSite requests
});