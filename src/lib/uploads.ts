// Per-file upload limit. It must match the API's MAX_UPLOAD_MB: 10 MB by
// default, lower on hosts that cap request bodies (Vercel: 4.5 MB).
export const MAX_UPLOAD_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB) > 0 ? Number(import.meta.env.VITE_MAX_UPLOAD_MB) : 10
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
