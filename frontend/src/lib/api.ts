import type {
  AdminStats,
  AdminUser,
  AdminUserDetail,
  AuthResult,
  CheckoutResult,
  Content,
  ContentAccess,
  ContentDetail,
  ContentSort,
  Genre,
  HistoryItem,
  MySubscription,
  OtpIssue,
  Paged,
  Payment,
  PaymentCheck,
  PendingVerification,
  Plan,
  PresignResult,
  ReleaseStatus,
  Rental,
  RentCheckoutResult,
  User,
  WatchSources,
  WatchlistItem,
} from "./types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export class ApiError extends Error {
  status: number;
  code?: string;
  /** Extra payload the API attached (e.g. otp info on ACCOUNT_NOT_VERIFIED). */
  data?: unknown;

  constructor(message: string, status: number, code?: string, data?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
  /** Cache a successful token-less GET this long; also dedupes in-flight calls. */
  cacheTtlMs?: number;
}

/** Short-lived cache for public GETs — repeat navigations render instantly. */
const getCache = new Map<string, { at: number; promise: Promise<unknown> }>();

async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", token, cacheTtlMs } = options;
  const cacheable = Boolean(cacheTtlMs) && method === "GET" && !token;
  if (cacheable) {
    const hit = getCache.get(path);
    if (hit && Date.now() - hit.at < (cacheTtlMs as number)) {
      return hit.promise as Promise<T>;
    }
  }
  const promise = doFetch<T>(path, options);
  if (cacheable) {
    getCache.set(path, { at: Date.now(), promise });
    // Failures must not be served from the cache.
    promise.catch(() => getCache.delete(path));
  }
  return promise;
}

async function doFetch<T>(path: string, options: RequestOptions): Promise<T> {
  const { method = "GET", body, token } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Сервертэй холбогдож чадсангүй. Дараа дахин оролдоно уу.", 0);
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = normalizeError(data) ?? "Алдаа гарлаа. Дахин оролдоно уу.";
    const code =
      data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
        ? ((data as { error: string }).error)
        : undefined;
    throw new ApiError(message, res.status, code, data);
  }

  return data as T;
}

// NestJS validation errors return { message: string | string[] }.
function normalizeError(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const message = (data as { message?: unknown }).message;
  if (Array.isArray(message)) return String(message[0]);
  if (typeof message === "string") return message;
  return null;
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const out = search.toString();
  return out ? `?${out}` : "";
}

// ---------------------------------------------------------------------------

export const authApi = {
  register: (payload: {
    name?: string;
    phone: string;
    email?: string;
    password: string;
  }) =>
    apiFetch<PendingVerification>("/auth/register", { method: "POST", body: payload }),

  verifyOtp: (payload: { identifier: string; code: string }) =>
    apiFetch<AuthResult>("/auth/verify-otp", { method: "POST", body: payload }),

  resendOtp: (payload: { identifier: string; purpose?: "VERIFY" | "RESET" }) =>
    apiFetch<OtpIssue>("/auth/resend-otp", { method: "POST", body: payload }),

  login: (payload: { identifier: string; password: string }) =>
    apiFetch<AuthResult>("/auth/login", { method: "POST", body: payload }),

  forgotPassword: (payload: { identifier: string }) =>
    apiFetch<{ sent: boolean; otp?: OtpIssue }>("/auth/forgot-password", {
      method: "POST",
      body: payload,
    }),

  resetPassword: (payload: {
    identifier: string;
    code: string;
    newPassword: string;
  }) => apiFetch<AuthResult>("/auth/reset-password", { method: "POST", body: payload }),

  me: (token: string) => apiFetch<User>("/auth/me", { token }),

  logout: (token: string) =>
    apiFetch<{ success: boolean }>("/auth/logout", { method: "POST", token }),
};

export interface ContentListParams {
  type?: "MOVIE" | "SERIES";
  genre?: string;
  search?: string;
  featured?: boolean;
  year?: number;
  yearFrom?: number;
  yearTo?: number;
  releaseStatus?: ReleaseStatus;
  sort?: ContentSort;
  page?: number;
  limit?: number;
}

/** Public catalog data changes rarely — a minute of cache kills refetch flicker. */
const CATALOG_TTL_MS = 60_000;

export const contentApi = {
  list: (params: ContentListParams = {}) =>
    apiFetch<Paged<Content>>(`/content${qs({ ...params })}`, {
      cacheTtlMs: CATALOG_TTL_MS,
    }),

  get: (idOrSlug: string) =>
    apiFetch<ContentDetail>(`/content/${idOrSlug}`, {
      cacheTtlMs: CATALOG_TTL_MS,
    }),

  genres: () =>
    apiFetch<Genre[]>("/content/genres", { cacheTtlMs: CATALOG_TTL_MS }),

  related: (idOrSlug: string) =>
    apiFetch<Content[]>(`/content/${idOrSlug}/related`, {
      cacheTtlMs: CATALOG_TTL_MS,
    }),

  access: (id: string, token: string) =>
    apiFetch<ContentAccess>(`/content/${id}/access`, { token }),

  watch: (id: string, token: string, episodeId?: string) =>
    apiFetch<WatchSources>(
      `/content/${id}/watch${qs({ episodeId })}`,
      { token },
    ),
};

export const billingApi = {
  plans: () =>
    apiFetch<Plan[]>("/billing/plans", { cacheTtlMs: CATALOG_TTL_MS }),

  me: (token: string) => apiFetch<MySubscription>("/billing/me", { token }),

  checkout: (token: string, planId: string) =>
    apiFetch<CheckoutResult>("/billing/checkout", {
      method: "POST",
      body: { planId },
      token,
    }),

  check: (token: string, paymentId: string) =>
    apiFetch<PaymentCheck>(`/billing/payments/${paymentId}/check`, {
      method: "POST",
      token,
    }),

  mockPay: (token: string, paymentId: string) =>
    apiFetch<PaymentCheck>(`/billing/payments/${paymentId}/mock-pay`, {
      method: "POST",
      token,
    }),

  rent: (token: string, contentId: string) =>
    apiFetch<RentCheckoutResult>("/billing/rent", {
      method: "POST",
      body: { contentId },
      token,
    }),

  rentals: (token: string) => apiFetch<Rental[]>("/billing/rentals", { token }),
};

export const activityApi = {
  watchlist: (token: string) => apiFetch<WatchlistItem[]>("/me/watchlist", { token }),

  addWatchlist: (token: string, contentId: string) =>
    apiFetch<WatchlistItem>(`/me/watchlist/${contentId}`, { method: "POST", token }),

  removeWatchlist: (token: string, contentId: string) =>
    apiFetch<{ success: boolean }>(`/me/watchlist/${contentId}`, {
      method: "DELETE",
      token,
    }),

  history: (token: string) => apiFetch<HistoryItem[]>("/me/history", { token }),

  removeHistory: (token: string, contentId: string) =>
    apiFetch<{ success: boolean }>(`/me/history/${contentId}`, {
      method: "DELETE",
      token,
    }),

  updateProfile: (token: string, payload: { name?: string }) =>
    apiFetch<User>("/me/profile", { method: "PATCH", body: payload, token }),

  async uploadAvatar(token: string, file: File): Promise<User> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_URL}/me/avatar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError(
        normalizeError(data) ?? "Зураг хуулж чадсангүй",
        res.status,
      );
    }
    return data as User;
  },

  saveProgress: (
    token: string,
    payload: {
      contentId: string;
      episodeId?: string;
      progressSec: number;
      completed?: boolean;
    },
  ) => apiFetch("/me/history", { method: "PUT", body: payload, token }),

  rate: (token: string, payload: { contentId: string; score: number; review?: string }) =>
    apiFetch("/me/ratings", { method: "PUT", body: payload, token }),
};

export const adminApi = {
  stats: (token: string) => apiFetch<AdminStats>("/admin/stats", { token }),

  users: (token: string, params: { search?: string; page?: number; limit?: number } = {}) =>
    apiFetch<Paged<AdminUser>>(`/admin/users${qs(params)}`, { token }),

  user: (token: string, id: string) =>
    apiFetch<AdminUserDetail>(`/admin/users/${id}`, { token }),

  grant: (token: string, userId: string, planId: string) =>
    apiFetch(`/admin/users/${userId}/grant`, {
      method: "POST",
      body: { planId },
      token,
    }),

  cancelSubscription: (token: string, subscriptionId: string) =>
    apiFetch(`/admin/subscriptions/${subscriptionId}`, { method: "DELETE", token }),

  payments: (
    token: string,
    params: { status?: string; search?: string; page?: number; limit?: number } = {},
  ) => apiFetch<Paged<Payment>>(`/admin/payments${qs(params)}`, { token }),

  // Content management (admin views of the content endpoints)
  contentList: (
    token: string,
    params: { status?: string; search?: string; page?: number; limit?: number } = {},
  ) => apiFetch<Paged<Content>>(`/content/admin/all${qs(params)}`, { token }),

  contentGet: (token: string, idOrSlug: string) =>
    apiFetch<ContentDetail>(`/content/admin/${idOrSlug}`, { token }),

  contentCreate: (token: string, body: unknown) =>
    apiFetch<Content>("/content", { method: "POST", body, token }),

  contentUpdate: (token: string, id: string, body: unknown) =>
    apiFetch<Content>(`/content/${id}`, { method: "PATCH", body, token }),

  contentDelete: (token: string, id: string) =>
    apiFetch<{ success: boolean }>(`/content/${id}`, { method: "DELETE", token }),

  addSeason: (token: string, contentId: string, body: { number: number; title?: string }) =>
    apiFetch(`/content/${contentId}/seasons`, { method: "POST", body, token }),

  removeSeason: (token: string, seasonId: string) =>
    apiFetch(`/content/seasons/${seasonId}`, { method: "DELETE", token }),

  addEpisode: (token: string, seasonId: string, body: unknown) =>
    apiFetch(`/content/seasons/${seasonId}/episodes`, { method: "POST", body, token }),

  removeEpisode: (token: string, episodeId: string) =>
    apiFetch(`/content/episodes/${episodeId}`, { method: "DELETE", token }),

  addVideoAsset: (token: string, contentId: string, body: unknown) =>
    apiFetch(`/content/${contentId}/video-assets`, { method: "POST", body, token }),

  removeVideoAsset: (token: string, assetId: string) =>
    apiFetch(`/content/video-assets/${assetId}`, { method: "DELETE", token }),
};

export const storageApi = {
  /** Which upload flow the backend expects: presigned R2 or local disk. */
  mode: (token: string) =>
    apiFetch<{ mode: "r2" | "local" }>("/storage/mode", { token }),

  /** Small images go through the API as multipart form data. */
  async uploadImage(
    token: string,
    kind: "poster" | "banner" | "thumbnail",
    file: File,
  ): Promise<{ key: string; url: string }> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_URL}/storage/${kind}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError(normalizeError(data) ?? "Файл хуулж чадсангүй", res.status);
    }
    return data as { key: string; url: string };
  },

  presign: (
    token: string,
    body: { folder: string; filename: string; contentType: string },
  ) => apiFetch<PresignResult>("/storage/presign", { method: "POST", body, token }),

  /** Local mode: video/trailer goes through the API onto the server disk. */
  async uploadVideoLocal(
    token: string,
    folder: "videos" | "trailers",
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<{ key: string; url: string }> {
    return new Promise((resolvePromise, reject) => {
      const form = new FormData();
      form.append("file", file);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/storage/video?folder=${folder}`);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolvePromise(JSON.parse(xhr.responseText));
        } else {
          reject(new ApiError("Файл хуулж чадсангүй", xhr.status));
        }
      };
      xhr.onerror = () => reject(new ApiError("Файл хуулж чадсангүй", 0));
      xhr.send(form);
    });
  },

  /** Big files (movies, trailers) PUT straight to R2 with the presigned URL. */
  async uploadDirect(
    presigned: PresignResult,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", presigned.uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new ApiError("Файл хуулж чадсангүй", xhr.status));
      xhr.onerror = () => reject(new ApiError("Файл хуулж чадсангүй", 0));
      xhr.send(file);
    });
  },
};
