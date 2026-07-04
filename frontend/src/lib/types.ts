export type Role = "USER" | "ADMIN";
export type ContentType = "MOVIE" | "SERIES";
export type ContentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type VideoQuality = "P480" | "P720" | "P1080" | "P4K";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";
export type SubscriptionStatus = "ACTIVE" | "EXPIRED" | "CANCELLED";
export type OtpChannel = "EMAIL" | "SMS";
export type OtpPurpose = "VERIFY" | "RESET";

export interface User {
  id: string;
  publicId: string;
  name: string | null;
  phone: string;
  email: string | null;
  role: Role;
  verified: boolean;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResult {
  user: User;
  accessToken: string;
}

export interface OtpIssue {
  target: string;
  channel: OtpChannel;
  expiresInMinutes: number;
  /** Only present outside production. */
  devCode?: string;
}

export interface PendingVerification {
  requiresVerification: true;
  otp: OtpIssue;
}

export interface Genre {
  id: string;
  name: string;
  slug: string;
}

export interface EpisodeSummary {
  id: string;
  number: number;
  title: string;
  description?: string | null;
  durationSec?: number | null;
  thumbnailUrl?: string | null;
  seasonId?: string;
  videoAssets?: Array<{ id: string; quality: VideoQuality }>;
}

export interface Season {
  id: string;
  number: number;
  title: string | null;
  episodes: EpisodeSummary[];
}

export interface Content {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  type: ContentType;
  status: ContentStatus;
  releaseYear: number | null;
  durationSec: number | null;
  ageRating: string | null;
  language: string | null;
  country: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  trailerUrl: string | null;
  cast: string[];
  featured: boolean;
  genres: Array<{ genre: Genre }>;
  createdAt: string;
  updatedAt: string;
}

export interface ContentDetail extends Content {
  seasons: Season[];
  videoAssets: Array<{ id: string; quality: VideoQuality }>;
  subtitles: Array<{ id: string; language: string; label: string | null }>;
  ratingAvg: number | null;
  ratingCount: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface VideoAsset {
  id: string;
  quality: VideoQuality;
  url: string | null;
  r2Key: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
}

export interface WatchSources {
  contentId: string;
  episodeId: string | null;
  videoAssets: VideoAsset[];
  subtitles: Array<{
    id: string;
    language: string;
    label: string | null;
    url: string | null;
  }>;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  durationDay: number;
  maxDevices: number;
  active: boolean;
}

export interface Subscription {
  id: string;
  status: SubscriptionStatus;
  startedAt: string;
  endsAt: string;
  plan: Plan;
}

export interface MySubscription {
  active: Subscription | null;
  history: Subscription[];
}

export interface QpayInvoice {
  invoiceId: string;
  qrText: string | null;
  qrImage: string | null;
  urls: Array<{ name: string; description: string; link: string }>;
  shortUrl: string | null;
  mock: boolean;
}

export interface CheckoutResult {
  paymentId: string;
  amount: number;
  plan: { id: string; name: string; durationDay: number };
  invoice: QpayInvoice;
}

export interface PaymentCheck {
  status: PaymentStatus;
  subscription: Subscription | null;
}

export interface Payment {
  id: string;
  amount: number;
  method: string;
  status: PaymentStatus;
  invoiceId: string | null;
  paidAt: string | null;
  createdAt: string;
  plan?: { name: string } | null;
  user?: {
    publicId: string;
    name: string | null;
    phone: string;
    email: string | null;
  };
}

export interface WatchlistItem {
  id: string;
  createdAt: string;
  content: ContentCardData;
}

export interface HistoryItem {
  id: string;
  progressSec: number;
  completed: boolean;
  watchedAt: string;
  content: ContentCardData;
  episode: { id: string; number: number; title: string } | null;
}

export interface ContentCardData {
  id: string;
  title: string;
  slug: string;
  type: ContentType;
  posterUrl: string | null;
  releaseYear: number | null;
  durationSec: number | null;
}

export interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  activeSubscriptions: number;
  totalContent: number;
  publishedContent: number;
  revenueTotal: number;
  revenueThisMonth: number;
  pendingPayments: number;
  recentPayments: Payment[];
  recentUsers: User[];
}

export interface AdminUser extends User {
  activeSubscription: { endsAt: string; plan: { name: string } } | null;
}

export interface AdminUserDetail extends User {
  subscriptions: Array<Subscription & { plan: { name: string; price: number } }>;
  payments: Payment[];
}

export interface PresignResult {
  key: string;
  url: string;
  uploadUrl: string;
  expiresIn: number;
}
