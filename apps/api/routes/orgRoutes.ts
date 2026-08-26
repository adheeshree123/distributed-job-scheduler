import { Router, Response, NextFunction } from 'express';
import { OrgService } from '../services/orgService.ts';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
} from '../utils/validation.ts';
import {
  authenticateJwt,
  requireOrganizationAccess,
  requireRole,
  AuthenticatedRequest,
} from '../middlewares/auth.ts';

export const orgRouter = Router();

// Apply JWT authentication to all organization routes
orgRouter.use(authenticateJwt);

orgRouter.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parseResult = createOrganizationSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid organization input',
          details: parseResult.error.flatten(),
        },
      });
      return;
    }

    const org = await OrgService.createOrganization(req.user!.id, parseResult.data);
    res.status(201).json({
      success: true,
      data: org,
    });
  } catch (error) {
    next(error);
  }
});

orgRouter.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgs = await OrgService.listOrganizations(req.user!.id);
    res.status(200).json({
      success: true,
      data: orgs,
    });
  } catch (error) {
    next(error);
  }
});

orgRouter.get('/:id', requireOrganizationAccess, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const org = await OrgService.getOrganization(req.params.id);
    res.status(200).json({
      success: true,
      data: org,
    });
  } catch (error) {
    next(error);
  }
});

orgRouter.patch(
  '/:id',
  requireOrganizationAccess,
  requireRole(['OWNER', 'ADMIN']),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const parseResult = updateOrganizationSchema.safeParse(req.body);
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

      const updated = await OrgService.updateOrganization(req.params.id, parseResult.data);
      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);
