import express, {Request, Response} from "express";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {validateDocument} from "../utils/validateDocument";
import {Collection} from "../constants/Collection";

// eslint-disable-next-line new-cap
const projectsRouter = express.Router();

// GET /projects - Get all projects
projectsRouter.get("/", async (_, res: Response) => {
  try {
    const snapshot = await admin
      .firestore()
      .collection(Collection.PROJECTS)
      .get();
    const projects: Record<string, unknown>[] = [];
    snapshot.forEach((doc) => {
      projects.push({id: doc.id, ...doc.data()});
    });
    res.status(200).json(projects);
  } catch (error) {
    logger.error("Error getting projects:", error);
    res.status(500).send("Error getting projects");
  }
});

// GET /projects/:id - Get a single project
projectsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const doc = await validateDocument(req.params.id, Collection.PROJECTS, res);
    res.status(200).json({id: doc.id, ...doc.data()});
  } catch (error) {
    logger.error("Error getting project:", error);
    res.status(500).send("Error getting project");
  }
});

// POST /projects - Create a new project
projectsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const docRef = await admin
      .firestore()
      .collection(Collection.PROJECTS)
      .add(req.body);
    res
      .status(201)
      .json({id: docRef.id, message: "Project added successfully"});
  } catch (error) {
    logger.error("Error adding project:", error);
    res.status(500).send("Error adding project");
  }
});

// PATCH /projects/:id - Update a project
projectsRouter.patch("/:id", async (req: Request, res: Response) => {
  try {
    await validateDocument(req.params.id, Collection.PROJECTS, res);
    await admin
      .firestore()
      .collection(Collection.PROJECTS)
      .doc(req.params.id)
      .update(req.body);
    res.status(200).json({message: "Project updated successfully"});
  } catch (error) {
    logger.error("Error updating project:", error);
    res.status(500).send("Error updating project");
  }
});

// DELETE /projects/:id - Delete a project
projectsRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    await validateDocument(req.params.id, Collection.PROJECTS, res);
    await admin
      .firestore()
      .collection(Collection.PROJECTS)
      .doc(req.params.id)
      .delete();
    res.status(200).json({message: "Project deleted successfully"});
  } catch (error) {
    logger.error("Error deleting project:", error);
    res.status(500).send("Error deleting project");
  }
});

export default projectsRouter;
