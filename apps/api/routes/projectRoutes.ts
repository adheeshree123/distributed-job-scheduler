import { Router, Response, NextFunction } from 'express';
import { OrgService } from '../services/orgService.ts';
import {
  createProjectSchema,
  updateProjectSchema,
} from '../utils/validation.ts';
import {
  authenticateJwt,
  requireProjectAccess,
  requireRole,
  AuthenticatedRequest,
} from '../middlewares/auth.ts';
import prisma from '../../../src/db/prisma.ts';

export const projectRouter = Router();

// Apply JWT authentication to all project routes
projectRouter.use(authenticateJwt);

projectRouter.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parseResult = createProjectSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid project input',
          details: parseResult.error.flatten(),
        },
      });
      return;
    }

    const { organizationId } = parseResult.data;

    // Verify user membership in organization
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: req.user!.id,
        },
      },
    });

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

    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions. Only OWNER or ADMIN can create projects in this organization.',
        },
      });
      return;
    }

    const project = await OrgService.createProject(organizationId, parseResult.data);
    res.status(201).json({
      success: true,
      data: project,
    });
  } catch (error) {
    next(error);
  }
});

projectRouter.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.query.organizationId as string | undefined;
    const projects = await OrgService.listProjects(req.user!.id, organizationId);
    res.status(200).json({
      success: true,
      data: projects,
    });
  } catch (error) {
    next(error);
  }
});

projectRouter.get('/:id', requireProjectAccess, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const project = await OrgService.getProject(req.params.id);
    res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    next(error);
  }
});

projectRouter.patch(
  '/:id',
  requireProjectAccess,
  requireRole(['OWNER', 'ADMIN']),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const parseResult = updateProjectSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid update input',
            details: parseResult.error.flatten(),
          },
        });
        return;
      }

      const updated = await OrgService.updateProject(req.params.id, parseResult.data);
      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

projectRouter.delete(
  '/:id',
  requireProjectAccess,
  requireRole(['OWNER']),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await OrgService.deleteProject(req.params.id);
      res.status(200).json({
        success: true,
        message: 'Project deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);
