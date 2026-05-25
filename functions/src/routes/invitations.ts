import express, {Request, Response} from "express";
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {validateDocument} from "../utils/validateDocument";
import {Collection} from "../constants/Collection";
import {
  authenticated,
  AuthenticatedRequest,
} from "../middlewares/authenticated";

// eslint-disable-next-line new-cap
const invitationsRouter = express.Router();

// GET /invitations - Get all invitations
invitationsRouter.get("/", async (_, res: Response) => {
  try {
    const snapshot = await admin
      .firestore()
      .collection(Collection.INVITATIONS)
      .get();
    const invitations: Record<string, unknown>[] = [];
    snapshot.forEach((doc) => {
      invitations.push({id: doc.id, ...doc.data()});
    });
    res.status(200).json(invitations);
  } catch (error) {
    logger.error("Error getting invitations:", error);
    res.status(500).send("Error getting invitations");
  }
});

// GET /invitations/:id - Get a single invitation
invitationsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const doc = await validateDocument(
      req.params.id,
      Collection.INVITATIONS,
      res,
    );
    res.status(200).json({id: doc.id, ...doc.data()});
  } catch (error) {
    logger.error("Error getting invitation:", error);
    res.status(500).send("Error getting invitation");
  }
});

// POST /invitations - Create a new invitation
invitationsRouter.post(
  "/",
  authenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.uid;
      const {projectId} = req.body as {projectId?: string};

      if (!userId) {
        return res.status(401).send("Unauthorized");
      }

      if (!projectId) {
        return res.status(400).send("Project not found");
      }

      const projectDoc = await admin
        .firestore()
        .collection(Collection.PROJECTS)
        .doc(projectId)
        .get();

      if (!projectDoc.exists) {
        return res.status(400).send("Project not found");
      }

      const userDoc = await admin
        .firestore()
        .collection(Collection.USERS)
        .doc(userId)
        .get();

      const sentBy = {
        userId,
        name: userDoc.data()?.displayName || "",
        photoUrl: userDoc.data()?.photoURL || "",
      };

      const docRef = admin
        .firestore()
        .collection(Collection.INVITATIONS)
        .doc();

      const invitationData = {
        ...req.body,
        sentBy,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
        inviteLink: `invite/${docRef.id}`,
      };

      await docRef.set(invitationData);
      return res
        .status(201)
        .json({id: docRef.id, message: "Invitation added successfully"});
    } catch (error) {
      logger.error("Error adding invitation:", error);
      return res.status(500).send("Error adding invitation");
    }
  },
);

// PATCH /invitations/:id - Update an invitation
invitationsRouter.patch("/:id", async (req: Request, res: Response) => {
  try {
    await validateDocument(req.params.id, Collection.INVITATIONS, res);
    await admin
      .firestore()
      .collection(Collection.INVITATIONS)
      .doc(req.params.id)
      .update(req.body);
    res.status(200).json({message: "Invitation updated successfully"});
  } catch (error) {
    logger.error("Error updating invitation:", error);
    res.status(500).send("Error updating invitation");
  }
});

// Accept an invitation

// DELETE /invitations/:id - Delete an invitation
invitationsRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    await validateDocument(req.params.id, Collection.INVITATIONS, res);
    await admin
      .firestore()
      .collection(Collection.INVITATIONS)
      .doc(req.params.id)
      .delete();
    res.status(200).json({message: "Invitation deleted successfully"});
  } catch (error) {
    logger.error("Error deleting invitation:", error);
    res.status(500).send("Error deleting invitation");
  }
});

export default invitationsRouter;
