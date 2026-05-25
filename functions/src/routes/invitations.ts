import express, {Request, Response} from "express";
import * as admin from "firebase-admin";
import {FieldValue, Timestamp} from "firebase-admin/firestore";
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
      const {projectId} = req.body as { projectId?: string };

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

      const docRef = admin.firestore().collection(Collection.INVITATIONS).doc();
      const invitationId = docRef.id;

      const invitationData = {
        ...req.body,
        sentBy,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
        inviteLink: `invite/${invitationId}`,
      };

      const projectData = projectDoc.data();
      const members = Array.isArray(projectData?.members) ?
        [...projectData.members] :
        [];

      members.push({
        invitationId,
        isPending: true,
        addedAt: Timestamp.now(),
      });

      await admin.firestore().runTransaction(async (transaction) => {
        transaction.set(docRef, invitationData);
        transaction.update(
          admin.firestore().collection(Collection.PROJECTS).doc(projectId),
          {members},
        );
      });
      return res
        .status(201)
        .json({id: invitationId, message: "Invitation added successfully"});
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
invitationsRouter.patch(
  "/:id/accept",
  authenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.uid;

      if (!userId) {
        return res.status(401).send("Unauthorized");
      }

      const invitationDoc = await validateDocument(
        req.params.id,
        Collection.INVITATIONS,
        res,
      );
      const invitationData = invitationDoc.data();
      const projectId = invitationData?.projectId as string | undefined;

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

      const projectData = projectDoc.data();
      const isAlreadyMember = Array.isArray(projectData?.members) ?
        projectData.members.some((member) => member?.id === userId) :
        false;

      if (isAlreadyMember) {
        return res.status(401).send("User already a member of the project");
      }

      const userDoc = await admin
        .firestore()
        .collection(Collection.USERS)
        .doc(userId)
        .get();

      const projectRef = admin
        .firestore()
        .collection(Collection.PROJECTS)
        .doc(projectId);
      const invitationRef = admin
        .firestore()
        .collection(Collection.INVITATIONS)
        .doc(req.params.id);

      await admin.firestore().runTransaction(async (transaction) => {
        const projectDoc = await transaction.get(projectRef);

        if (!projectDoc.exists) {
          throw new Error("Project not found");
        }

        const projectData = projectDoc.data();
        const members = Array.isArray(projectData?.members) ?
          [...projectData.members] :
          [];
        const memberIndex = members.findIndex(
          (member) => member?.invitationId === req.params.id,
        );

        if (memberIndex === -1) {
          throw new Error("Invitation member not found");
        }

        members[memberIndex] = {
          ...members[memberIndex],
          id: userId,
          name: userDoc.data()?.displayName || "",
          photoUrl: userDoc.data()?.photoURL || "",
          isPending: false,
          acceptedAt: Timestamp.now(),
          invitationId: req.params.id,
        };

        transaction.update(projectRef, {members});

        transaction.update(invitationRef, {
          status: "accepted",
          acceptedAt: FieldValue.serverTimestamp(),
        });
      });

      return res.status(200).json({
        message: "Invitation accepted successfully",
      });
    } catch (error) {
      logger.error("Error accepting invitation:", error);
      if (error instanceof Error && error.message === "Project not found") {
        return res.status(400).send("Project not found");
      }

      if (
        error instanceof Error &&
        error.message === "Invitation member not found"
      ) {
        return res.status(400).send("Invitation member not found");
      }

      return res.status(500).send("Error accepting invitation");
    }
  },
);

// Reject an invitation
invitationsRouter.patch(
  "/:id/reject",
  authenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.uid;

      if (!userId) {
        return res.status(401).send("Unauthorized");
      }

      const invitationDoc = await validateDocument(
        req.params.id,
        Collection.INVITATIONS,
        res,
      );
      const invitationData = invitationDoc.data();
      const projectId = invitationData?.projectId as string | undefined;

      if (!projectId) {
        return res.status(400).send("Project not found");
      }

      const projectRef = admin
        .firestore()
        .collection(Collection.PROJECTS)
        .doc(projectId);
      const invitationRef = admin
        .firestore()
        .collection(Collection.INVITATIONS)
        .doc(req.params.id);

      await admin.firestore().runTransaction(async (transaction) => {
        const projectDoc = await transaction.get(projectRef);

        if (!projectDoc.exists) {
          throw new Error("Project not found");
        }

        const projectData = projectDoc.data();
        const members = Array.isArray(projectData?.members) ?
          [...projectData.members] :
          [];
        const memberIndex = members.findIndex(
          (member) => member?.invitationId === req.params.id,
        );

        if (memberIndex === -1) {
          throw new Error("Invitation member not found");
        }

        members[memberIndex] = {
          ...members[memberIndex],
          isPending: false,
          rejected: true,
          rejectedAt: Timestamp.now(),
          invitationId: req.params.id,
        };

        transaction.update(projectRef, {members});
        transaction.update(invitationRef, {
          status: "rejected",
          rejectedAt: FieldValue.serverTimestamp(),
        });
      });

      return res.status(200).json({
        message: "Invitation rejected successfully",
      });
    } catch (error) {
      logger.error("Error declining invitation:", error);
      if (error instanceof Error && error.message === "Project not found") {
        return res.status(400).send("Project not found");
      }

      if (
        error instanceof Error &&
        error.message === "Invitation member not found"
      ) {
        return res.status(400).send("Invitation member not found");
      }

      return res.status(500).send("Error declining invitation");
    }
  },
);

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
