import express, {Request, Response} from "express";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {validateDocument} from "../utils/validateDocument";
import {Collection} from "../constants/Collection";

const router = express.Router();

// GET /ambags - Get all ambags
router.get("/", async (_, res: Response) => {
  try {
    const snapshot = await admin.firestore().collection(Collection.AMBAGS).get();
    const ambags: any[] = [];
    snapshot.forEach((doc) => {
      ambags.push({id: doc.id, ...doc.data()});
    });
    res.status(200).json(ambags);
  } catch (error) {
    logger.error("Error getting ambags:", error);
    res.status(500).send("Error getting ambags");
  }
});

// GET /ambags/:id - Get a single ambag
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const doc = await validateDocument(req.params.id, Collection.AMBAGS, res);
    res.status(200).json({id: doc.id, ...doc.data()});
  } catch (error: any) {
    logger.error("Error getting ambag:", error);
    res.status(500).send("Error getting ambag");
  }
});

// POST /ambags - Create a new ambag
router.post("/", async (req: Request, res: Response) => {
  try {
    const docRef = await admin.firestore().collection(Collection.AMBAGS).add(req.body);
    res.status(201).json({id: docRef.id, message: "Ambag added successfully"});
  } catch (error) {
    logger.error("Error adding ambag:", error);
    res.status(500).send("Error adding ambag");
  }
});

// PATCH /ambags/:id - Update an ambag
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    await validateDocument(req.params.id, Collection.AMBAGS, res);
    await admin.firestore().collection(Collection.AMBAGS).doc(req.params.id).update(req.body);
    res.status(200).json({message: "Ambag updated successfully"});
  } catch (error: any) {
    logger.error("Error updating ambag:", error);
    res.status(500).send("Error updating ambag");
  }
});

// DELETE /ambags/:id - Delete an ambag
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    await validateDocument(req.params.id, Collection.AMBAGS, res);
    await admin.firestore().collection(Collection.AMBAGS).doc(req.params.id).delete();
    res.status(200).json({message: "Ambag deleted successfully"});
  } catch (error: any) {
    logger.error("Error deleting ambag:", error);
    res.status(500).send("Error deleting ambag");
  }
});

export default router;
