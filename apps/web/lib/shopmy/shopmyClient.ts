// lib/shopmyClient.ts
import axios from "axios";

function getServerBaseUrl() {
  // Point to your prod domain for SSR or non-browser contexts
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return `https://${process.env.NEXT_PUBLIC_API_BASE_URL}`;
  }
  // Fallback for local dev - use localhost with port
  return "http://localhost:8888";
}

export const shopmyClient = axios.create({
  baseURL: typeof window === "undefined"
    ? getServerBaseUrl()
    : "",                  // ← empty = "same origin" in the browser
  withCredentials: true,  // send cookies on same-origin or sameSite requests
});

// Add request interceptor for debugging
shopmyClient.interceptors.request.use(
  config => {
    console.log(`ShopMy client request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  error => {
    console.error('ShopMy client request error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
shopmyClient.interceptors.response.use(
  response => {
    console.log(`ShopMy client response: ${response.status} from ${response.config.url}`);
    return response;
  },
  error => {
    if (axios.isAxiosError(error)) {
      console.error('ShopMy client response error:', {
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
    } else {
      console.error('ShopMy client non-Axios error:', error);
    }
    return Promise.reject(error);
  }
);