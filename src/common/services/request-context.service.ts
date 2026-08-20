import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { CurrentUser } from '../../modules/auth/interfaces/current-user.interface';

export interface RequestContextStore {
  correlationId: string;
  startTime: number;
  user?: CurrentUser | null;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
  loginSessionId?: string | null;
  path: string;
  method: string;
}

@Injectable()
export class RequestContextService {
  private static readonly storage =
    new AsyncLocalStorage<RequestContextStore>();

  /**
   * Runs a function within the specified request context store.
   */
  static run<R>(store: RequestContextStore, callback: () => R): R {
    return this.storage.run(store, callback);
  }

  /**
   * Gets the current request context store.
   */
  getStore(): RequestContextStore | undefined {
    return RequestContextService.storage.getStore();
  }

  /**
   * Sets or updates current context store attributes.
   */
  setUser(user: CurrentUser | null) {
    const store = this.getStore();
    if (store) {
      store.user = user;
      if (user?.loginSessionId) {
        store.loginSessionId = user.loginSessionId;
      }
    }
  }

  getCorrelationId(): string {
    return this.getStore()?.correlationId || 'no-correlation-id';
  }

  getStartTime(): number {
    return this.getStore()?.startTime || Date.now();
  }

  getDurationMs(): number {
    const start = this.getStartTime();
    return Date.now() - start;
  }

  getUser(): CurrentUser | null {
    return this.getStore()?.user || null;
  }

  getUserId(): string | null {
    return this.getStore()?.user?.userId || null;
  }

  getLoginSessionId(): string | null {
    return (
      this.getStore()?.loginSessionId ||
      this.getStore()?.user?.loginSessionId ||
      null
    );
  }

  getIpAddress(): string {
    return this.getStore()?.ipAddress || '0.0.0.0';
  }

  getUserAgent(): string {
    return this.getStore()?.userAgent || 'UNKNOWN';
  }

  getDeviceFingerprint(): string {
    return this.getStore()?.deviceFingerprint || this.getUserAgent();
  }

  getPath(): string {
    return this.getStore()?.path || '';
  }

  getMethod(): string {
    return this.getStore()?.method || '';
  }
}
