import { Router, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService.ts';
import { registerSchema, loginSchema } from '../utils/validation.ts';
import { authenticateJwt, AuthenticatedRequest } from '../middlewares/auth.ts';

export const authRouter = Router();

authRouter.post('/register', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid registration input',
          details: parseResult.error.flatten(),
        },
      });
      return;
    }

    const result = await AuthService.register(parseResult.data);
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid login input',
          details: parseResult.error.flatten(),
        },
      });
      return;
    }

    const result = await AuthService.login(parseResult.data);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', authenticateJwt, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = await AuthService.getMe(req.user!.id);
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
});
