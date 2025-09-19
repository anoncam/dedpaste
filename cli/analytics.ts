import Mixpanel from "mixpanel";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";

interface AnalyticsConfig {
  enabled: boolean;
  userId: string;
  optOutDate?: string;
  firstSeen?: string;
}

interface EventProperties {
  [key: string]: any;
}

interface QueuedEvent {
  name: string;
  properties: EventProperties;
  timestamp: Date;
}

class AnalyticsService {
  private static instance: AnalyticsService;
  private mixpanel: Mixpanel.Mixpanel | null = null;
  private config: AnalyticsConfig;
  private configPath: string;
  private eventQueue: QueuedEvent[] = [];
  private isInitialized = false;
  private flushTimer: NodeJS.Timeout | null = null;

  // Privacy-focused configuration
  private readonly BATCH_SIZE = 10;
  private readonly FLUSH_INTERVAL = 30000; // 30 seconds
  private readonly CONFIG_DIR = ".dedpaste";
  private readonly CONFIG_FILE = "analytics.json";

  // Mixpanel project token
  private readonly PROJECT_TOKEN = "9c4a09e9631e9675165a65a03c54dc6e";

  private constructor() {
    this.configPath = path.join(os.homedir(), this.CONFIG_DIR, this.CONFIG_FILE);
    this.config = this.loadConfig();
    this.initialize();
  }

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  private loadConfig(): AnalyticsConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, "utf8");
        return JSON.parse(data);
      }
    } catch (error) {
      // Silently handle errors - analytics should never break the app
    }

    // Default config with analytics enabled
    return {
      enabled: true,
      userId: this.generateAnonymousId(),
      firstSeen: new Date().toISOString(),
    };
  }

  private saveConfig(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      // Silently handle errors
    }
  }

  private generateAnonymousId(): string {
    // Generate a truly anonymous ID that cannot be traced back to the user
    return uuidv4();
  }

  private initialize(): void {
    // Always enable analytics
    this.config.enabled = true;

    if (!this.PROJECT_TOKEN) {
      return; // No token available
    }

    try {
      this.mixpanel = Mixpanel.init(this.PROJECT_TOKEN, {
        // Use EU servers for better privacy compliance
        host: process.env.DEDPASTE_MIXPANEL_HOST || "api.mixpanel.com",
        protocol: "https",
        // Note: Batching handled internally by the SDK
      });

      this.isInitialized = true;
      this.startFlushTimer();

      // Set user properties
      this.updateUserProperties();
    } catch (error) {
      this.isInitialized = false;
      // Silently handle initialization errors
    }
  }

  private updateUserProperties(): void {
    if (!this.mixpanel || !this.config.enabled) return;

    try {
      this.mixpanel.people.set(this.config.userId, {
        $first_seen: this.config.firstSeen,
        platform: process.platform,
        node_version: process.version,
        cli_version: this.getCliVersion(),
        // Don't track any PII
      });
    } catch (error) {
      // Silently handle errors
    }
  }

  private getCliVersion(): string {
    try {
      const packagePath = path.join(__dirname, "..", "package.json");
      const packageData = JSON.parse(fs.readFileSync(packagePath, "utf8"));
      return packageData.version || "unknown";
    } catch {
      return "unknown";
    }
  }

  private hashValue(value: string): string {
    // Hash sensitive values for privacy
    return crypto.createHash("sha256").update(value).digest("hex").substring(0, 16);
  }

  private sanitizeProperties(properties: EventProperties): EventProperties {
    const sanitized: EventProperties = {};

    for (const [key, value] of Object.entries(properties)) {
      // Skip any potentially sensitive fields
      if (key.toLowerCase().includes("key") ||
          key.toLowerCase().includes("password") ||
          key.toLowerCase().includes("secret") ||
          key.toLowerCase().includes("token") ||
          key.toLowerCase().includes("email") ||
          key.toLowerCase().includes("username")) {
        continue;
      }

      // Hash paste IDs to prevent tracking specific content
      if (key === "paste_id" && typeof value === "string") {
        sanitized[key] = this.hashValue(value);
      } else {
        sanitized[key] = value;
      }
    }

    // Add common properties
    sanitized.platform = process.platform;
    sanitized.node_version = process.version;
    sanitized.cli_version = this.getCliVersion();

    return sanitized;
  }

  private startFlushTimer(): void {
    if (this.flushTimer) return;

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.FLUSH_INTERVAL);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  public track(eventName: string, properties: EventProperties = {}): void {
    if (!this.config.enabled) return;

    // Queue the event
    this.eventQueue.push({
      name: eventName,
      properties: this.sanitizeProperties(properties),
      timestamp: new Date(),
    });

    // Flush if queue is full
    if (this.eventQueue.length >= this.BATCH_SIZE) {
      this.flush();
    }
  }

  public flush(): void {
    if (!this.mixpanel || !this.isInitialized || this.eventQueue.length === 0) {
      return;
    }

    const events = [...this.eventQueue];
    this.eventQueue = [];

    // Send events asynchronously
    for (const event of events) {
      try {
        this.mixpanel.track(event.name, {
          distinct_id: this.config.userId,
          time: event.timestamp,
          ...event.properties,
        });
      } catch (error) {
        // Silently handle tracking errors
      }
    }
  }

  // Removed opt-in/opt-out methods - analytics are always enabled

  public isEnabled(): boolean {
    return this.config.enabled && this.isInitialized;
  }

  public getStatus(): string {
    // Always return a generic status
    return "Running";
  }

  public destroy(): void {
    this.flush();
    this.stopFlushTimer();
    this.mixpanel = null;
    this.isInitialized = false;
  }

  // Convenience methods for common events

  public trackCommand(command: string, subcommand?: string, flags: string[] = []): void {
    this.track("command_executed", {
      command,
      subcommand,
      flags_count: flags.length,
      flags: flags.filter(f => !f.includes("key") && !f.includes("password")),
    });
  }

  public trackPasteCreated(properties: {
    type: "regular" | "encrypted" | "one_time";
    content_type?: string;
    size_bytes?: number;
    encryption_type?: "none" | "RSA" | "PGP";
    method?: "stdin" | "file";
  }): void {
    this.track("paste_created", properties);
  }

  public trackPasteRetrieved(properties: {
    is_encrypted: boolean;
    decryption_method?: string;
    content_type?: string;
    success: boolean;
  }): void {
    this.track("paste_retrieved", properties);
  }

  public trackKeyOperation(operation: string, properties: EventProperties = {}): void {
    this.track(`key_${operation}`, properties);
  }

  public trackError(error_type: string, operation: string, error_code?: string): void {
    this.track("error_occurred", {
      error_type,
      operation,
      error_code,
    });
  }
}

// Export singleton instance
export const analytics = AnalyticsService.getInstance();

// Export type for use in other modules
export type { EventProperties };

// Ensure cleanup on process exit
process.on("exit", () => {
  analytics.destroy();
});

process.on("SIGINT", () => {
  analytics.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  analytics.destroy();
  process.exit(0);
});