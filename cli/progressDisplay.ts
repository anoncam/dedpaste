/**
 * Progress display module for large file uploads.
 * Provides a visual progress bar with speed and ETA calculations.
 */

import type { UploadProgress } from "../src/types/index.js";

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Format seconds to human-readable time string.
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "--:--";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

/**
 * Progress bar configuration.
 */
export interface ProgressBarOptions {
  /** Width of the progress bar in characters (default: 30) */
  width?: number;
  /** Character for filled portion (default: █) */
  filledChar?: string;
  /** Character for empty portion (default: ░) */
  emptyChar?: string;
  /** Whether to show speed (default: true) */
  showSpeed?: boolean;
  /** Whether to show ETA (default: true) */
  showEta?: boolean;
  /** Whether to show part progress (default: true) */
  showParts?: boolean;
  /** Stream to write to (default: process.stderr) */
  stream?: NodeJS.WriteStream;
}

/**
 * Progress bar for upload tracking.
 */
export class ProgressBar {
  private width: number;
  private filledChar: string;
  private emptyChar: string;
  private showSpeed: boolean;
  private showEta: boolean;
  private showParts: boolean;
  private stream: NodeJS.WriteStream;
  private startTime: number;
  private lastUpdate: number;
  private lastBytes: number;
  private speedSamples: number[] = [];
  private maxSamples = 10;

  constructor(options: ProgressBarOptions = {}) {
    this.width = options.width ?? 30;
    this.filledChar = options.filledChar ?? "█";
    this.emptyChar = options.emptyChar ?? "░";
    this.showSpeed = options.showSpeed ?? true;
    this.showEta = options.showEta ?? true;
    this.showParts = options.showParts ?? true;
    this.stream = options.stream ?? process.stderr;
    this.startTime = Date.now();
    this.lastUpdate = this.startTime;
    this.lastBytes = 0;
  }

  /**
   * Calculate smoothed upload speed using moving average.
   */
  private calculateSpeed(currentBytes: number): number {
    const now = Date.now();
    const timeDiff = (now - this.lastUpdate) / 1000;

    if (timeDiff > 0.1) {
      // Only update every 100ms
      const bytesDiff = currentBytes - this.lastBytes;
      const instantSpeed = bytesDiff / timeDiff;

      this.speedSamples.push(instantSpeed);
      if (this.speedSamples.length > this.maxSamples) {
        this.speedSamples.shift();
      }

      this.lastUpdate = now;
      this.lastBytes = currentBytes;
    }

    // Return average speed
    if (this.speedSamples.length === 0) {
      const elapsed = (now - this.startTime) / 1000;
      return elapsed > 0 ? currentBytes / elapsed : 0;
    }
    return (
      this.speedSamples.reduce((a, b) => a + b, 0) / this.speedSamples.length
    );
  }

  /**
   * Update the progress display.
   */
  update(progress: UploadProgress): void {
    const { totalBytes, uploadedBytes, currentPart, totalParts } = progress;

    // Calculate percentage
    const percent = totalBytes > 0 ? (uploadedBytes / totalBytes) * 100 : 0;

    // Calculate speed and ETA
    const speed = this.calculateSpeed(uploadedBytes);
    const remainingBytes = totalBytes - uploadedBytes;
    const eta = speed > 0 ? remainingBytes / speed : Infinity;

    // Build progress bar
    const filled = Math.round((this.width * percent) / 100);
    const empty = this.width - filled;
    const bar =
      this.filledChar.repeat(filled) + this.emptyChar.repeat(empty);

    // Build status line
    let status = `\r[${bar}] ${percent.toFixed(1)}%`;
    status += ` | ${formatBytes(uploadedBytes)}/${formatBytes(totalBytes)}`;

    if (this.showSpeed) {
      status += ` | ${formatBytes(speed)}/s`;
    }

    if (this.showEta) {
      status += ` | ETA: ${formatTime(eta)}`;
    }

    if (this.showParts) {
      status += ` | Part ${currentPart}/${totalParts}`;
    }

    // Pad to overwrite any previous longer line
    const padding = " ".repeat(Math.max(0, 100 - status.length));
    this.stream.write(status + padding);
  }

  /**
   * Mark progress as complete.
   */
  complete(totalBytes: number): void {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const avgSpeed = elapsed > 0 ? totalBytes / elapsed : 0;

    // Clear the line and write final message
    this.stream.write("\r" + " ".repeat(120) + "\r");
    console.log(
      `✓ Upload complete: ${formatBytes(totalBytes)} in ${formatTime(elapsed)} (${formatBytes(avgSpeed)}/s average)`,
    );
  }

  /**
   * Mark progress as failed.
   */
  fail(error: string): void {
    this.stream.write("\r" + " ".repeat(120) + "\r");
    console.error(`✗ Upload failed: ${error}`);
  }

  /**
   * Clear the progress line.
   */
  clear(): void {
    this.stream.write("\r" + " ".repeat(120) + "\r");
  }
}

/**
 * Create a progress callback function that updates the progress bar.
 */
export function createProgressCallback(
  options: ProgressBarOptions = {},
): {
  callback: (progress: UploadProgress) => void;
  complete: (totalBytes: number) => void;
  fail: (error: string) => void;
  bar: ProgressBar;
} {
  const bar = new ProgressBar(options);

  return {
    callback: (progress: UploadProgress) => bar.update(progress),
    complete: (totalBytes: number) => bar.complete(totalBytes),
    fail: (error: string) => bar.fail(error),
    bar,
  };
}

/**
 * Simple spinner for indeterminate progress.
 */
export class Spinner {
  private frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private frameIndex = 0;
  private interval: NodeJS.Timeout | null = null;
  private message: string;
  private stream: NodeJS.WriteStream;

  constructor(message: string, stream: NodeJS.WriteStream = process.stderr) {
    this.message = message;
    this.stream = stream;
  }

  start(): void {
    this.interval = setInterval(() => {
      this.stream.write(
        `\r${this.frames[this.frameIndex]} ${this.message}`,
      );
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }, 80);
  }

  update(message: string): void {
    this.message = message;
  }

  stop(finalMessage?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.stream.write("\r" + " ".repeat(80) + "\r");
    if (finalMessage) {
      console.log(finalMessage);
    }
  }

  succeed(message: string): void {
    this.stop(`✓ ${message}`);
  }

  fail(message: string): void {
    this.stop(`✗ ${message}`);
  }
}
