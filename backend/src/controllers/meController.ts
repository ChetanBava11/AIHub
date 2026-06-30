import type { Request, Response } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import type { AuthService } from "../services/authService";

export const createMeController = (authService: AuthService) => ({
  getMe: asyncHandler(async (req: Request, res: Response) => {
    const currentUser = await authService.getCurrentUser(req.auth!.userId);

    res.json(currentUser);
  })
});
