import {FieldValue} from "firebase-admin/firestore";
import express, {Response} from "express";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {validateDocument} from "../utils/validateDocument";
import {Collection} from "../constants/Collection";
import {
  authenticated,
  AuthenticatedRequest,
} from "../middlewares/authenticated";
import {ERROR_MESSAGES} from "../constants/ERROR_MESSAGES";
import {isProjectCreator} from "../utils/projectHelpers";

// eslint-disable-next-line new-cap
const projectsRouter = express.Router();

// GET /projects - Get all projects
projectsRouter.get(
  "/",
  authenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.uid;
      const snapshot = await admin
        .firestore()
        .collection(Collection.PROJECTS)
        .get();
      const projects: Record<string, unknown>[] = [];
      snapshot.forEach((doc) => {
        const projectData = doc.data();
        const isMember = projectData?.members?.includes(userId);
        const isCreator = projectData?.createdBy === userId;
        if (isMember || isCreator) {
          projects.push({id: doc.id, ...projectData});
        }
      });
      res.status(200).json(projects);
    } catch (error) {
      logger.error("Error getting projects:", error);
      res.status(500).send("Error getting projects");
    }
  },
);

// GET /projects/:id - Get a single project
projectsRouter.get(
  "/:id",
  authenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id;
      const doc = await validateDocument(id, Collection.PROJECTS, res);
      res.status(200).json({id: doc.id, ...doc.data()});
    } catch (error) {
      logger.error("Error getting project:", error);
      res.status(500).send("Error getting project");
    }
  },
);

// POST /projects - Create a new project
projectsRouter.post(
  "/",
  authenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.uid as string;
      const userRef = admin
        .firestore()
        .collection(Collection.USERS)
        .doc(userId);
      const projectRef = admin
        .firestore()
        .collection(Collection.PROJECTS)
        .doc();

      await admin.firestore().runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error("User not found");
        }

        const owner = {
          name: userDoc.data()?.displayName || "",
          photoUrl: userDoc.data()?.photoURL || "",
        };

        transaction.set(projectRef, {
          ...req.body,
          owner,
          createdBy: userId,
          createdAt: FieldValue.serverTimestamp(),
        });
      });

      res
        .status(201)
        .json({id: projectRef.id, message: "Project added successfully"});
    } catch (error) {
      logger.error("Error adding project:", error);
      if (error instanceof Error && error.message === "User not found") {
        res.status(404).send("User not found");
      } else {
        res.status(500).send("Error adding project");
      }
    }
  },
);

// PATCH /projects/:id - Update a project
projectsRouter.patch(
  "/:id",
  authenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.uid;
      const projectId = req.params.id;

      if (!userId) {
        return res.status(401).send(ERROR_MESSAGES.UNAUTHORIZED);
      }

      const creator = await isProjectCreator(userId, projectId);

      if (!creator) {
        return res.status(403).send(ERROR_MESSAGES.FORBIDDEN);
      }

      await admin
        .firestore()
        .collection(Collection.PROJECTS)
        .doc(projectId)
        .update({
          ...req.body,
          updatedAt: FieldValue.serverTimestamp(),
        });
      return res.status(200).json({message: "Project updated successfully"});
    } catch (error) {
      logger.error("Error updating project:", error);
      return res.status(500).send("Error updating project");
    }
  },
);

// DELETE /projects/:id - Delete a project
projectsRouter.delete(
  "/:id",
  authenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.uid;
      const projectId = req.params.id;

      if (!userId) {
        return res.status(401).send("Unauthorized");
      }

      const creator = await isProjectCreator(userId, projectId);

      if (!creator) {
        return res.status(403).send(ERROR_MESSAGES.FORBIDDEN);
      }

      await admin
        .firestore()
        .collection(Collection.PROJECTS)
        .doc(projectId)
        .delete();
      return res.status(200).json({message: "Project deleted successfully"});
    } catch (error) {
      logger.error("Error deleting project:", error);
      return res.status(500).send("Error deleting project");
    }
  },
);

export default projectsRouter;
