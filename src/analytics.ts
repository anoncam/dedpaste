// Use Web Crypto API for Cloudflare Workers

interface AnalyticsEvent {
  event: string;
  properties: {
    distinct_id: string;
    time?: number;
    [key: string]: any;
  };
}

interface AnalyticsConfig {
  token: string;
  enabled: boolean;
  apiHost: string;
  debug: boolean;
}

class WorkerAnalytics {
  private config: AnalyticsConfig;
  private eventQueue: AnalyticsEvent[] = [];
  private readonly MAX_BATCH_SIZE = 50;
  private readonly MIXPANEL_ENDPOINT = "/track";

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = {
      token: config.token || "9c4a09e9631e9675165a65a03c54dc6e",
      enabled: true, // Always enabled
      apiHost: config.apiHost || "https://api.mixpanel.com",
      debug: config.debug || false,
    };
  }

  private async generateAnonymousId(request: Request): Promise<string> {
    // Generate a consistent anonymous ID based on request headers
    // This creates a hash from non-PII headers for consistency across requests
    const headers = request.headers;
    const userAgent = headers.get("user-agent") || "";
    const acceptLanguage = headers.get("accept-language") || "";
    const acceptEncoding = headers.get("accept-encoding") || "";

    // Create a fingerprint without using IP address (for privacy)
    const fingerprint = `${userAgent}|${acceptLanguage}|${acceptEncoding}`;

    // Hash the fingerprint using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprint);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    return hashHex.substring(0, 32);
  }

  private async hashValue(value: string): Promise<string> {
    // Hash sensitive values for privacy using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    return hashHex.substring(0, 16);
  }

  private async sanitizeProperties(properties: Record<string, any>): Promise<Record<string, any>> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(properties)) {
      // Skip sensitive fields
      if (
        key.toLowerCase().includes("key") ||
        key.toLowerCase().includes("password") ||
        key.toLowerCase().includes("secret") ||
        key.toLowerCase().includes("token") ||
        key.toLowerCase().includes("ip") ||
        key.toLowerCase().includes("email")
      ) {
        continue;
      }

      // Hash paste IDs
      if (key === "paste_id" && typeof value === "string") {
        sanitized[key] = await this.hashValue(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  public async track(
    eventName: string,
    properties: Record<string, any> = {},
    request?: Request
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      const distinctId = properties.distinct_id ||
        (request ? await this.generateAnonymousId(request) : "worker-anonymous");

      const event: AnalyticsEvent = {
        event: eventName,
        properties: {
          distinct_id: distinctId,
          time: Date.now(),
          token: this.config.token,
          // Add environment info
          environment: "worker",
          region: (request as any)?.cf?.region || "unknown",
          colo: (request as any)?.cf?.colo || "unknown",
          // Add sanitized custom properties
          ...(await this.sanitizeProperties(properties)),
        },
      };

      // Remove the token from properties (it's at the root level for Mixpanel)
      delete event.properties.token;

      this.eventQueue.push(event);

      // Auto-flush if batch is large enough
      if (this.eventQueue.length >= this.MAX_BATCH_SIZE) {
        await this.flush();
      }
    } catch (error) {
      if (this.config.debug) {
        console.error("Analytics tracking error:", error);
      }
    }
  }

  public async flush(): Promise<void> {
    if (!this.config.enabled || this.eventQueue.length === 0) {
      return;
    }

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Mixpanel expects base64 encoded data
      const data = {
        data: btoa(JSON.stringify(events.map(e => ({
          event: e.event,
          properties: {
            ...e.properties,
            token: this.config.token,
          }
        })))),
      };

      const response = await fetch(`${this.config.apiHost}${this.MIXPANEL_ENDPOINT}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(data).toString(),
      });

      if (this.config.debug && !response.ok) {
        console.error("Analytics flush failed:", response.status, await response.text());
      }
    } catch (error) {
      if (this.config.debug) {
        console.error("Analytics flush error:", error);
      }
    }
  }

  // Convenience methods for common events

  public async trackPasteCreated(
    request: Request,
    properties: {
      is_encrypted: boolean;
      is_one_time: boolean;
      content_type?: string;
      size_bytes?: number;
    }
  ): Promise<void> {
    await this.track("api_paste_created", properties, request);
  }

  public async trackPasteAccessed(
    request: Request,
    properties: {
      is_encrypted: boolean;
      is_one_time: boolean;
      content_type?: string;
      found: boolean;
    }
  ): Promise<void> {
    await this.track("api_paste_accessed", properties, request);
  }

  public async trackOneTimeDeleted(
    request: Request,
    properties: {
      paste_id?: string;
    }
  ): Promise<void> {
    await this.track("api_one_time_deleted", properties, request);
  }

  public async trackHomepageView(request: Request): Promise<void> {
    await this.track("homepage_viewed", {
      referrer: request.headers.get("referer") || "direct",
      user_agent: request.headers.get("user-agent") || "unknown",
    }, request);
  }

  public async trackError(
    request: Request,
    error_type: string,
    error_code: number
  ): Promise<void> {
    await this.track("api_error", {
      error_type,
      error_code,
      path: new URL(request.url).pathname,
      method: request.method,
    }, request);
  }
}

// Factory function to create analytics instance with environment config
export function createAnalytics(env: any): WorkerAnalytics {
  return new WorkerAnalytics({
    token: "9c4a09e9631e9675165a65a03c54dc6e",
    enabled: true,
    apiHost: env.MIXPANEL_API_HOST || "https://api.mixpanel.com",
    debug: false,
  });
}

export { WorkerAnalytics };
export type { AnalyticsEvent, AnalyticsConfig };