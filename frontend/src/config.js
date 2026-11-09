// Single place for the backend URL, so it is no longer hardcoded in 17
// files. Resolution order:
//   1. VITE_API_URL (frontend/.env), if set
//   2. the same host the page was opened from, on port 8000
//      (this makes the Patient Portal work on a phone when the app is
//      opened through the laptop's LAN IP, e.g. http://192.168.1.5:5173)
// "localhost" is mapped to 127.0.0.1 because `php artisan serve` binds
// IPv4 only, and some browsers try IPv6 first for "localhost".
const pageHost =
  typeof window !== "undefined" && window.location.hostname
    ? window.location.hostname
    : "127.0.0.1";

const apiHost = pageHost === "localhost" ? "127.0.0.1" : pageHost;

export const API_URL =
  import.meta.env.VITE_API_URL || `http://${apiHost}:8000/api`;
