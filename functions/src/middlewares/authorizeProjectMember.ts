import {Response, NextFunction} from "express";
import {AuthenticatedRequest} from "./authenticated";
import {isProjectMemberOrCreator} from "../utils/projectHelpers";
import {ERROR_MESSAGES} from "../constants/ERROR_MESSAGES";
import * as logger from "firebase-functions/logger";

export const authorizeProjectMember = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).send(ERROR_MESSAGES.UNAUTHORIZED);
    }

    const projectId = (req.query.projectId || req.body.projectId) as string;

    if (!projectId) {
      return res.status(400).send("projectId is required");
    }

    const isMemberOrCreator = await isProjectMemberOrCreator(userId, projectId);

    if (!isMemberOrCreator) {
      return res.status(403).send(ERROR_MESSAGES.FORBIDDEN);
    }

    return next();
  } catch (error) {
    logger.error("Error authorizing project member:", error);
    return res.status(500).send("Error authorizing project member");
  }
};
