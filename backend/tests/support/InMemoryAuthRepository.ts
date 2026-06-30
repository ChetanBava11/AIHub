import { UserRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { GoogleProfile } from "../../src/lib/oauth";
import {
  AuthRepository,
  DEFAULT_TENANT_NAME,
  type SessionUser,
  type StoredRefreshToken,
  type UpdateTenantInput
} from "../../src/services/authRepository";

const now = () => new Date();

const createId = (): string => Math.random().toString(36).slice(2, 12);

export class InMemoryAuthRepository implements AuthRepository {
  public readonly users = new Map<string, SessionUser>();
  public readonly usersByGoogleId = new Map<string, string>();
  public readonly refreshTokens = new Map<string, StoredRefreshToken>();
  public readonly refreshTokensByHash = new Map<string, string>();
  public readonly auditLogs: Array<{
    tenantId: string;
    userId?: string;
    action: string;
    details?: Prisma.InputJsonValue;
  }> = [];

  async findUserByGoogleId(googleId: string): Promise<SessionUser | null> {
    const userId = this.usersByGoogleId.get(googleId);
    return userId ? this.cloneUser(this.users.get(userId) ?? null) : null;
  }

  async findUserById(userId: string): Promise<SessionUser | null> {
    return this.cloneUser(this.users.get(userId) ?? null);
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<StoredRefreshToken | null> {
    const tokenId = this.refreshTokensByHash.get(tokenHash);
    if (!tokenId) {
      return null;
    }

    const token = this.refreshTokens.get(tokenId);
    return token ? { ...token } : null;
  }

  async createRefreshToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    const id = createId();
    const token: StoredRefreshToken = {
      id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      used: false,
      expiresAt: new Date(input.expiresAt),
      createdAt: now()
    };

    this.refreshTokens.set(id, token);
    this.refreshTokensByHash.set(token.tokenHash, id);
  }

  async markRefreshTokenUsed(tokenId: string): Promise<boolean> {
    const token = this.refreshTokens.get(tokenId);

    if (!token || token.used) {
      return false;
    }

    token.used = true;
    return true;
  }

  async revokeRefreshTokenByHash(tokenHash: string): Promise<boolean> {
    const tokenId = this.refreshTokensByHash.get(tokenHash);

    if (!tokenId) {
      return false;
    }

    this.refreshTokensByHash.delete(tokenHash);
    return this.refreshTokens.delete(tokenId);
  }

  async revokeAllRefreshTokensForUser(userId: string): Promise<number> {
    let removed = 0;

    for (const [tokenId, token] of this.refreshTokens.entries()) {
      if (token.userId === userId) {
        this.refreshTokens.delete(tokenId);
        this.refreshTokensByHash.delete(token.tokenHash);
        removed += 1;
      }
    }

    return removed;
  }

  async upsertGoogleUser(profile: GoogleProfile): Promise<{ user: SessionUser; created: boolean }> {
    const existing = await this.findUserByGoogleId(profile.googleId);

    if (existing) {
      return { user: existing, created: false };
    }

    const tenantId = createId();
    const userId = createId();
    const user: SessionUser = {
      id: userId,
      tenantId,
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      role: UserRole.OWNER,
      createdAt: now(),
      tenant: {
        id: tenantId,
        name: DEFAULT_TENANT_NAME,
        industry: null,
        size: null,
        createdAt: now()
      }
    };

    this.users.set(userId, user);
    this.usersByGoogleId.set(profile.googleId, userId);

    return { user: this.cloneUser(user)!, created: true };
  }

  async updateTenant(tenantId: string, input: UpdateTenantInput): Promise<SessionUser["tenant"]> {
    for (const user of this.users.values()) {
      if (user.tenantId === tenantId) {
        user.tenant = {
          ...user.tenant,
          ...input
        };
        return { ...user.tenant };
      }
    }

    throw new Error(`Tenant ${tenantId} not found`);
  }

  async createAuditLog(input: {
    tenantId: string;
    userId?: string;
    action: string;
    details?: Prisma.InputJsonValue;
  }): Promise<void> {
    this.auditLogs.push(input);
  }

  private cloneUser(user: SessionUser | null): SessionUser | null {
    if (!user) {
      return null;
    }

    return {
      ...user,
      tenant: {
        ...user.tenant
      },
      createdAt: new Date(user.createdAt)
    };
  }
}
