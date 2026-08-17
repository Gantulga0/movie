export type Role = "USER" | "ADMIN";
export type ContentType = "MOVIE" | "SERIES" | "NOVEL";
export type ContentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type ReleaseStatus = "RELEASING" | "COMPLETED";
export type ContentSort = "new" | "year" | "title" | "watched" | "rated";
export type VideoQuality = "P480" | "P720" | "P1080" | "P4K";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";
export type SubscriptionStatus = "ACTIVE" | "EXPIRED" | "CANCELLED";
export type PhoneVerifyStatus = "PENDING" | "VERIFIED" | "EXPIRED";

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
  refreshToken: string;
}

/** What the client shows so the user can send the MO-SMS to verify.mn. */
export interface VerificationPrompt {
  sessionId: string;
  /** The code the user must SMS (shown big; also embedded in smsUri). */
  code: string;
  /** Shortcode to send it to — "144773". */
  shortcode: string;
  /** "sms:144773?body=..." — a tap-to-open link on mobile. */
  smsUri: string;
  /** verify.mn's Mongolian instruction text. */
  displayInstruction: string;
  /** ISO timestamp; the session expires at this point. */
  expiresAt: string;
}

export interface PendingVerification {
  requiresVerification: true;
  verification: VerificationPrompt;
}

/** Polled while the user texts the code; carries tokens once verified. */
export interface VerifyStatus {
  status: PhoneVerifyStatus;
  verified: boolean;
  auth?: AuthResult;
}

export interface Genre {
  id: string;
  name: string;
  slug: string;
  /** Which content types the genre applies to (empty = any). */
  types?: ContentType[];
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

/** Chapter row in the detail payload — the body stays behind the read route. */
export interface ChapterSummary {
  id: string;
  number: number;
  title: string;
  createdAt: string;
}

/** Raw chapter row (with body) from the admin editor endpoint. */
export interface AdminChapter {
  id: string;
  contentId: string;
  number: number;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

/** A readable chapter from GET /content/:id/chapters/:chapterId. */
export interface ChapterDetail {
  id: string;
  number: number;
  title: string;
  body: string;
  contentId: string;
  isFree: boolean;
  content: { title: string; slug: string };
  prevId: string | null;
  nextId: string | null;
}

export interface Content {
  id: string;
  title: string;
  originalTitle: string | null;
  slug: string;
  description: string | null;
  type: ContentType;
  status: ContentStatus;
  releaseStatus: ReleaseStatus;
  releaseYear: number | null;
  durationSec: number | null;
  ageRating: string | null;
  language: string | null;
  country: string | null;
  director: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  trailerUrl: string | null;
  cast: string[];
  featured: boolean;
  isRentable: boolean;
  rentalPrice: number | null;
  rentalDurationHours: number;
  subscriptionIncluded: boolean;
  /** NOVEL only: the first N chapters are readable without a subscription. */
  freeChapterCount: number;
  genres: Array<{ genre: Genre }>;
  createdAt: string;
  updatedAt: string;
}

/** The caller's access state for one title — drives Watch/Rent buttons. */
export interface ContentAccess {
  contentId: string;
  canWatch: boolean;
  viaSubscription: boolean;
  viaRental: boolean;
  rentalEndsAt: string | null;
  subscriptionIncluded: boolean;
  isRentable: boolean;
  rentalPrice: number | null;
  rentalDurationHours: number;
}

export interface ContentDetail extends Content {
  seasons: Season[];
  chapters: ChapterSummary[];
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

export interface PaymentInvoice {
  invoiceId: string;
  qrText: string | null;
  qrImage: string | null;
  urls: Array<{
    name: string;
    description: string;
    link: string;
    logo?: string;
  }>;
  shortUrl: string | null;
  /** wire.mn hosted-checkout URL to redirect to; null in mock mode. */
  checkoutUrl?: string | null;
  mock: boolean;
}

export interface CheckoutResult {
  paymentId: string;
  amount: number;
  plan: { id: string; name: string; durationDay: number };
  invoice: PaymentInvoice;
}

export interface RentCheckoutResult {
  paymentId: string;
  amount: number;
  content: {
    id: string;
    title: string;
    slug: string;
    rentalDurationHours: number;
  };
  invoice: PaymentInvoice;
}

export interface Rental {
  id: string;
  startsAt: string;
  endsAt: string;
  content: ContentCardData;
}

export interface PaymentCheck {
  status: PaymentStatus;
  subscription: Subscription | null;
  rental: Rental | null;
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
  episode: {
    id: string;
    number: number;
    title: string;
    durationSec: number | null;
    seasonId: string;
    season: { number: number };
  } | null;
  chapter: {
    id: string;
    number: number;
    title: string;
  } | null;
}

export interface ContentCardData {
  id: string;
  title: string;
  slug: string;
  type: ContentType;
  posterUrl: string | null;
  releaseYear: number | null;
  durationSec: number | null;
  /** Rental info for the poster price tag; absent on older payloads. */
  isRentable?: boolean;
  rentalPrice?: number | null;
  subscriptionIncluded?: boolean;
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
