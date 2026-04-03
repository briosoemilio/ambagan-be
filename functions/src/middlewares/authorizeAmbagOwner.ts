import {Response, NextFunction} from "express";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {AuthenticatedRequest} from "./authenticated";
import {Collection} from "../constants/Collection";
import {ERROR_MESSAGES} from "../constants/ERROR_MESSAGES";

export const authorizeAmbagOwner = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).send(ERROR_MESSAGES.UNAUTHORIZED);
    }

    const ambagId = req.params.id;
    if (!ambagId) {
      return res.status(400).send("Ambag ID is required.");
    }

    // Get the ambag document
    const ambagRef = admin
      .firestore()
      .collection(Collection.AMBAGS)
      .doc(ambagId);
    const ambagDoc = await ambagRef.get();

    if (!ambagDoc.exists) {
      return res.status(404).send("Ambag not found.");
    }

    const ambagData = ambagDoc.data();

    // Check if the user is the one who created the ambag
    if (ambagData?.createdBy === userId) {
      return next();
    }

    // If not the creator, check if the user is the project owner
    const projectId = ambagData?.projectId;
    if (!projectId) {
      // This indicates a data integrity issue
      logger.error(`Ambag ${ambagId} is missing a projectId.`);
      return res
        .status(500)
        .send("Internal server error: Incomplete ambag data.");
    }

    const projectRef = admin
      .firestore()
      .collection(Collection.PROJECTS)
      .doc(projectId);
    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) {
      // This indicates a data integrity issue (orphaned ambag)
      logger.error(`Project ${projectId} for ambag ${ambagId} not found.`);
      return res.status(500).send("Internal server error: Project not found.");
    }

    const projectData = projectDoc.data();
    if (projectData?.createdBy === userId) {
      return next();
    }

    // If the user is neither, deny access
    return res.status(403).send(ERROR_MESSAGES.FORBIDDEN);
  } catch (error) {
    logger.error("Error authorizing ambag owner:", error);
    return res.status(500).send("Error authorizing ambag owner.");
  }
};
