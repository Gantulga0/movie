import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** What POST /sessions returns — everything the client needs to act. */
export interface VerifySession {
  sessionId: string;
  phone: string;
  shortcode: string;
  text: string;
  /** "sms:144773?body=..." — offer as a tap-to-open link on mobile. */
  smsUri: string;
  /** Mongolian instruction text to display to the user. */
  displayInstruction: string;
  /** ISO timestamp; the session dies (300s TTL) at this point. */
  expiresAt: string;
}

export type VerifySessionStatus = 'PENDING' | 'VERIFIED' | 'EXPIRED';
export type VerifyCallbackStatus = 'PENDING' | 'SENT' | 'FAILED';

/** What GET /sessions/{id} returns — the poll/callback status check. */
export interface VerifySessionState {
  sessionId: string;
  phone: string;
  sessionStatus: VerifySessionStatus;
  callbackStatus: VerifyCallbackStatus;
  verifiedAt: string | null;
  expiresAt: string;
}

/**
 * verify.mn client — Mongolia-only Mobile-Originated (MO) SMS phone
 * verification.
 *
 * Flow: create a session with a per-session code as the SMS text; the user
 * texts that code to shortcode 144773 from their own phone; verify.mn confirms
 * receipt. We learn of success by polling GET /sessions/{id} (and, optionally,
 * a wake-up callback) until sessionStatus === "VERIFIED".
 *
 * The API key is read from VERIFY_MN_API_KEY and is required — this service
 * fails loudly (no mock mode) if it is missing, because there is no safe
 * offline substitute for a real MO-SMS handshake.
 */
@Injectable()
export class VerifyMnService {
  private readonly logger = new Logger(VerifyMnService.name);

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return this.config
      .get<string>('VERIFY_MN_BASE_URL', 'https://api.verify.mn')
      .replace(/\/$/, '');
  }

  /**
   * Source IPs verify.mn's (load-balanced) callback service sends from. Any
   * other origin should be rejected 403. Empty env disables the check (local).
   */
  private get allowedCallbackIps(): string[] {
    return this.config
      .get<string>('VERIFY_MN_CALLBACK_IP', '3.34.8.248,13.124.219.192')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /** Rejects a callback delivery from any IP other than verify.mn's. */
  assertAllowedIp(ip: string | undefined): void {
    const allowed = this.allowedCallbackIps;
    if (allowed.length === 0) return; // check disabled (e.g. local dev)
    // A proxy may report IPv4 over IPv6 as "::ffff:1.2.3.4" — strip the prefix.
    const normalized = (ip ?? '').replace(/^::ffff:/, '');
    if (!allowed.includes(normalized)) {
      this.logger.warn(`verify.mn callback from disallowed ip: ${ip}`);
      throw new ForbiddenException('Callback эх сурвалж зөвшөөрөгдөөгүй');
    }
  }

  /** Reads the API key or throws — verify.mn cannot run without it. */
  private get apiKey(): string {
    const key = this.config.get<string>('VERIFY_MN_API_KEY', '');
    if (!key) {
      // Fail loudly: a missing key is a deployment error, not a runtime state.
      throw new InternalServerErrorException(
        'VERIFY_MN_API_KEY тохируулаагүй байна. verify.mn утас баталгаажуулалт идэвхгүй.',
      );
    }
    return key;
  }

  // -------------------------------------------------------------- sessions

  /**
   * Opens a verification session. `text` is the per-session code the user must
   * SMS. `callback` is OPTIONAL — pass only a real, reachable https URL; leave
   * it empty when polling (verify.mn retries failed callbacks several times, so
   * a fake URL wastes their retries).
   */
  async createSession(params: {
    phone: string;
    text: string;
    callback?: string;
    responseSms?: string;
  }): Promise<VerifySession> {
    const body: Record<string, string> = {
      phone: params.phone,
      text: params.text,
    };
    if (params.callback) body.callback = params.callback;
    if (params.responseSms) body.responseSms = params.responseSms;

    return this.request<VerifySession>('POST', '/sessions', body);
  }

  /** Current status of a session — the poll/callback check. No auth needed. */
  async getSession(sessionId: string): Promise<VerifySessionState> {
    return this.request<VerifySessionState>(
      'GET',
      `/sessions/${encodeURIComponent(sessionId)}`,
    );
  }

  // -------------------------------------------------------------- internal

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, string>,
  ): Promise<T> {
    const headers: Record<string, string> = {};
    // Only POST /sessions is authenticated; GET /sessions/{id} is public, but
    // sending the bearer there is harmless and keeps one code path.
    headers.Authorization = `Bearer ${this.apiKey}`;
    if (body) headers['Content-Type'] = 'application/json';

    const url = `${this.baseUrl}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      // Transport-level failure (DNS, TLS, empty base URL) — never reached the
      // server. undici puts the real reason (ENOTFOUND, …) on `.cause`.
      const err = e as Error & { cause?: unknown };
      const cause =
        err.cause instanceof Error ? err.cause.message : String(err.cause ?? '');
      // Never log the key — headers are not logged here.
      this.logger.error(
        `verify.mn ${method} ${url} network error: ${err.message} ${cause}`,
      );
      throw new InternalServerErrorException(
        `verify.mn-руу холбогдсонгүй (${this.baseUrl || 'BASE URL хоосон'})`,
      );
    }

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`verify.mn ${method} ${path} failed: ${res.status} ${text}`);
      if (res.status === 401) {
        throw new UnauthorizedException('verify.mn API түлхүүр буруу байна');
      }
      if (res.status === 400) {
        // Surface verify.mn's validation message where possible.
        let detail = text.slice(0, 200);
        try {
          const parsed = JSON.parse(text) as { message?: string; error?: string };
          detail = parsed.message ?? parsed.error ?? detail;
        } catch {
          /* keep raw text */
        }
        throw new BadRequestException(`verify.mn: ${detail}`);
      }
      throw new InternalServerErrorException(`verify.mn: ${res.status}`);
    }

    return (await res.json()) as T;
  }
}
