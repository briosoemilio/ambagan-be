import {Request, Response, NextFunction} from "express";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

export interface AuthenticatedRequest extends Request {
  user?: admin.auth.DecodedIdToken;
}

export const authenticated = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const {authorization} = req.headers;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).send("Unauthorized");
  }

  const idToken = authorization.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    logger.error("Error verifying token:", error);
    return res.status(401).send("Unauthorized");
  }

  return;
};
