import prisma from '../../../src/db/prisma.ts';
import {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  CreateProjectInput,
  UpdateProjectInput,
} from '../utils/validation.ts';

export class OrgService {
  static async createOrganization(userId: string, input: CreateOrganizationInput) {
    const slug =
      input.slug ||
      input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    const existingSlug = await prisma.organization.findUnique({
      where: { slug },
    });

    if (existingSlug) {
      const error: any = new Error('An organization with this slug already exists');
      error.statusCode = 409;
      error.code = 'ORGANIZATION_SLUG_EXISTS';
      throw error;
    }

    return await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: input.name.trim(),
          slug,
        },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId,
          role: 'OWNER',
        },
      });

      return org;
    });
  }

  static async listOrganizations(userId: string) {
    const memberships = await prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: {
          include: {
            _count: {
              select: {
                members: true,
                projects: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return memberships.map((m) => ({
      ...m.organization,
      userRole: m.role,
    }));
  }

  static async getOrganization(orgId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        members: {
          select: {
            id: true,
            role: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        projects: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            createdAt: true,
            _count: {
              select: {
                queues: true,
              },
            },
          },
        },
      },
    });

    return org;
  }

  static async updateOrganization(orgId: string, input: UpdateOrganizationInput) {
    if (input.slug) {
      const existing = await prisma.organization.findFirst({
        where: {
          slug: input.slug,
          NOT: { id: orgId },
        },
      });

      if (existing) {
        const error: any = new Error('An organization with this slug already exists');
        error.statusCode = 409;
        error.code = 'ORGANIZATION_SLUG_EXISTS';
        throw error;
      }
    }

    return await prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(input.name && { name: input.name.trim() }),
        ...(input.slug && { slug: input.slug }),
      },
    });
  }

  // --- Projects ---

  static async createProject(organizationId: string, input: CreateProjectInput) {
    const slug =
      input.slug ||
      input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    const existing = await prisma.project.findFirst({
      where: {
        organizationId,
        OR: [{ name: input.name.trim() }, { slug }],
      },
    });

    if (existing) {
      const error: any = new Error('A project with this name or slug already exists in this organization');
      error.statusCode = 409;
      error.code = 'PROJECT_EXISTS';
      throw error;
    }

    return await prisma.project.create({
      data: {
        organizationId,
        name: input.name.trim(),
        slug,
        description: input.description?.trim() || null,
      },
    });
  }

  static async listProjects(userId: string, organizationId?: string) {
    // If organizationId is provided, check user is member
    if (organizationId) {
      const isMember = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },
      });

      if (!isMember) {
        const error: any = new Error('Organization not found or access denied');
        error.statusCode = 404;
        error.code = 'ORGANIZATION_NOT_FOUND';
        throw error;
      }

      return await prisma.project.findMany({
        where: { organizationId },
        include: {
          _count: {
            select: {
              queues: true,
              scheduledJobs: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Otherwise list all projects across user's organizations
    const userOrgs = await prisma.organizationMember.findMany({
      where: { userId },
      select: { organizationId: true },
    });

    const orgIds = userOrgs.map((o) => o.organizationId);

    return await prisma.project.findMany({
      where: {
        organizationId: { in: orgIds },
      },
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: {
            queues: true,
            scheduledJobs: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getProject(projectId: string) {
    return await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
        queues: {
          include: {
            retryPolicy: true,
            _count: {
              select: { jobs: true },
            },
          },
        },
        scheduledJobs: true,
      },
    });
  }

  static async updateProject(projectId: string, input: UpdateProjectInput) {
    return await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(input.name && { name: input.name.trim() }),
        ...(input.slug && { slug: input.slug }),
        ...(input.description !== undefined && { description: input.description }),
      },
    });
  }

  static async deleteProject(projectId: string) {
    return await prisma.project.delete({
      where: { id: projectId },
    });
  }
}
