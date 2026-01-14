// functions/src/routes/users.ts
import express, {Request, Response} from "express";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {validateDocument} from "../utils/validateDocument";
import {Collection} from "../constants/Collection";

const router = express.Router();

// GET /users - Get all users
router.get("/", async (_, res: Response) => {
  try {
    const snapshot = await admin.firestore().collection("users").get();
    const users: any[] = [];
    snapshot.forEach((doc) => {
      users.push({id: doc.id, ...doc.data()});
    });
    res.status(200).json(users);
  } catch (error) {
    logger.error("Error getting users:", error);
    res.status(500).send("Error getting users");
  }
});

// GET /users/:id - Get a single user
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const doc = await validateDocument(req.params.id, Collection.USERS);
    res.status(200).json({id: doc.id, ...doc.data()});
  } catch (error: any) {
    logger.error("Error getting user:", error);
    if (error.message === "Document not found") {
      res.status(404).send(error.message);
    } else {
      res.status(500).send("Error getting user");
    }
  }
});

// POST /users - Create a new user
router.post("/", async (req: Request, res: Response) => {
  try {
    const docRef = await admin.firestore().collection("users").add(req.body);
    res.status(201).json({id: docRef.id, message: "User added successfully"});
  } catch (error) {
    logger.error("Error adding user:", error);
    res.status(500).send("Error adding user");
  }
});

// PATCH /users/:id - Update a user
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    await validateDocument(req.params.id, Collection.USERS); // Validate before updating
    await admin.firestore().collection(Collection.USERS).doc(req.params.id).update(req.body);
    res.status(200).json({message: "User updated successfully"});
  } catch (error: any) {
    logger.error("Error updating user:", error);
    if (error.message === "Document not found") {
      res.status(404).send(error.message);
    } else {
      res.status(500).send("Error updating user");
    }
  }
});

// DELETE /users/:id - Delete a user
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    await validateDocument(req.params.id, Collection.USERS); // Validate before deleting
    await admin.firestore().collection(Collection.USERS).doc(req.params.id).delete();
    res.status(200).json({message: "User deleted successfully"});
  } catch (error: any) {
    logger.error("Error deleting user:", error);
    if (error.message === "Document not found") {
      res.status(404).send(error.message);
    } else {
      res.status(500).send("Error deleting user");
    }
  }
});

export default router;
