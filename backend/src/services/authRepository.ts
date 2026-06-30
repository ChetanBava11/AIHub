import { Prisma, UserRole } from "@prisma/client";
import { prisma as defaultPrisma } from "../prisma/client";
import type { GoogleProfile } from "../lib/oauth";

export const DEFAULT_TENANT_NAME = "My Business";

export interface SessionUser {
  id: string;
  tenantId: string;
  googleId: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  tenant: {
    id: string;
    name: string | null;
    industry: string | null;
    size: string | null;
    createdAt: Date;
  };
}

export interface StoredRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  used: boolean;
  expiresAt: Date;
  createdAt: Date;
}

export interface UpdateTenantInput {
  name: string;
  industry: string;
  size: string;
}

export interface AuthRepository {
  findUserByGoogleId(googleId: string): Promise<SessionUser | null>;
  findUserById(userId: string): Promise<SessionUser | null>;
  findRefreshTokenByHash(tokenHash: string): Promise<StoredRefreshToken | null>;
  createRefreshToken(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  markRefreshTokenUsed(tokenId: string): Promise<boolean>;
  revokeRefreshTokenByHash(tokenHash: string): Promise<boolean>;
  revokeAllRefreshTokensForUser(userId: string): Promise<number>;
  upsertGoogleUser(profile: GoogleProfile): Promise<{ user: SessionUser; created: boolean }>;
  updateTenant(tenantId: string, input: UpdateTenantInput): Promise<SessionUser["tenant"]>;
  createAuditLog(input: {
    tenantId: string;
    userId?: string;
    action: string;
    details?: Prisma.InputJsonValue;
  }): Promise<void>;
}

type PrismaLike = typeof defaultPrisma;

const userInclude = {
  tenant: true
} satisfies Prisma.UserInclude;

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaLike = defaultPrisma) {}

  findUserByGoogleId(googleId: string): Promise<SessionUser | null> {
    return this.prisma.user.findUnique({
      where: { googleId },
      include: userInclude
    }) as Promise<SessionUser | null>;
  }

  findUserById(userId: string): Promise<SessionUser | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: userInclude
    }) as Promise<SessionUser | null>;
  }

  findRefreshTokenByHash(tokenHash: string): Promise<StoredRefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash }
    });
  }

  async createRefreshToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.refreshToken.create({ data: input });
  }

  async markRefreshTokenUsed(tokenId: string): Promise<boolean> {
    const result = await this.prisma.refreshToken.updateMany({
      where: {
        id: tokenId,
        used: false
      },
      data: {
        used: true
      }
    });

    return result.count === 1;
  }

  async revokeRefreshTokenByHash(tokenHash: string): Promise<boolean> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        tokenHash
      }
    });

    return result.count > 0;
  }

  revokeAllRefreshTokensForUser(userId: string): Promise<number> {
    return this.prisma.refreshToken
      .deleteMany({
        where: { userId }
      })
      .then((result) => result.count);
  }

  async upsertGoogleUser(profile: GoogleProfile): Promise<{ user: SessionUser; created: boolean }> {
    const existingUser = await this.findUserByGoogleId(profile.googleId);

    if (existingUser) {
      return { user: existingUser, created: false };
    }

    const createdUser = (await this.prisma.user.create({
      data: {
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
        role: UserRole.OWNER,
        tenant: {
          create: {
            name: DEFAULT_TENANT_NAME
          }
        }
      },
      include: userInclude
    })) as SessionUser;

    return { user: createdUser, created: true };
  }

  async updateTenant(tenantId: string, input: UpdateTenantInput): Promise<SessionUser["tenant"]> {
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: input
    });

    return tenant;
  }

  async createAuditLog(input: {
    tenantId: string;
    userId?: string;
    action: string;
    details?: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        action: input.action,
        details: input.details
      }
    });
  }
}
