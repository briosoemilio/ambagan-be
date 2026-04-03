import {z} from "zod";
import {Request, Response, NextFunction} from "express";

export const validateBody = <T extends z.ZodTypeAny>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: "Validation failed",
          details: error,
        });
        return;
      }
      next(error);
    }
  };
};
