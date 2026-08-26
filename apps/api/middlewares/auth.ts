import { Request, Response, NextFunction } from 'express';
import { OrganizationRole } from '@prisma/client';
import { verifyToken } from '../utils/jwt.ts';
import prisma from '../../../src/db/prisma.ts';
import { AuthUser, TenantContext } from '../types.ts';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  tenant?: TenantContext;
  project?: {
    id: string;
    organizationId: string;
    name: string;
    slug: string;
  };
  queue?: {
    id: string;
    projectId: string;
    name: string;
    isPaused: boolean;
    concurrencyLimit: number;
    priority: number;
  };
}

export async function authenticateJwt(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token is required',
        },
      });
      return;
    }

    const token = authHeader.substring(7);
    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired authentication token',
        },
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Authenticated user no longer exists',
        },
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

// Role hierarchy rank for authorization check
const ROLE_RANK: Record<OrganizationRole, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1,
};

export function requireRole(allowedRoles: OrganizationRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.tenant) {
      res.status(401).json({
        success: false,
        error: {
          code: 'TENANT_REQUIRED',
          message: 'Tenant context is required for this operation',
        },
      });
      return;
    }

    const userRoleRank = ROLE_RANK[req.tenant.role];
    const minRequiredRank = Math.min(...allowedRoles.map((r) => ROLE_RANK[r]));

    if (userRoleRank < minRequiredRank) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Insufficient role. Required: ${allowedRoles.join(' or ')}. Current: ${req.tenant.role}`,
        },
      });
      return;
    }

    next();
  };
}

export async function requireOrganizationAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    const orgId = req.params.organizationId || req.params.id || (req.headers['x-organization-id'] as string) || (req.query.organizationId as string);
    if (!orgId) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Organization ID is required' },
      });
      return;
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: req.user.id,
        },
      },
      include: {
        organization: true,
      },
    });

    // Tenant isolation: if not a member, return 404 to avoid leaking organization existence
    if (!membership) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ORGANIZATION_NOT_FOUND',
          message: 'Organization not found or access denied',
        },
      });
      return;
    }

    req.tenant = {
      userId: req.user.id,
      organizationId: membership.organizationId,
      role: membership.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export async function requireProjectAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    const projectId = req.params.projectId || req.params.id;
    if (!projectId) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Project ID is required' },
      });
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        organization: {
          include: {
            members: {
              where: { userId: req.user.id },
            },
          },
        },
      },
    });

    if (!project || project.organization.members.length === 0) {
      // 404 for tenant isolation
      res.status(404).json({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or access denied',
        },
      });
      return;
    }

    const member = project.organization.members[0];
    req.tenant = {
      userId: req.user.id,
      organizationId: project.organizationId,
      role: member.role,
      projectId: project.id,
    };
    req.project = {
      id: project.id,
      organizationId: project.organizationId,
      name: project.name,
      slug: project.slug,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export async function requireQueueAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    const queueId = req.params.queueId || req.params.id;
    if (!queueId) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Queue ID is required' },
      });
      return;
    }

    const queue = await prisma.queue.findUnique({
      where: { id: queueId },
      include: {
        project: {
          include: {
            organization: {
              include: {
                members: {
                  where: { userId: req.user.id },
                },
              },
            },
          },
        },
      },
    });

    if (!queue || queue.project.organization.members.length === 0) {
      // 404 for tenant isolation
      res.status(404).json({
        success: false,
        error: {
          code: 'QUEUE_NOT_FOUND',
          message: 'Queue not found or access denied',
        },
      });
      return;
    }

    const member = queue.project.organization.members[0];
    req.tenant = {
      userId: req.user.id,
      organizationId: queue.project.organizationId,
      role: member.role,
      projectId: queue.projectId,
    };
    req.project = {
      id: queue.project.id,
      organizationId: queue.project.organizationId,
      name: queue.project.name,
      slug: queue.project.slug,
    };
    req.queue = {
      id: queue.id,
      projectId: queue.projectId,
      name: queue.name,
      isPaused: queue.isPaused,
      concurrencyLimit: queue.concurrencyLimit,
      priority: queue.priority,
    };

    next();
  } catch (error) {
    next(error);
  }
}
