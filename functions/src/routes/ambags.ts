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
import {AmbagSchema} from "../schemas/AmbagSchema";
import {validateBody} from "../middlewares/validateBody";
import {authorizeProjectMember} from "../middlewares/authorizeProjectMember";
import {authorizeAmbagOwner} from "../middlewares/authorizeAmbagOwner";
import _busboy from "busboy";

// eslint-disable-next-line new-cap
const ambagsRouter = express.Router();

ambagsRouter.use(authenticated);

// GET /ambags - Get all ambags
ambagsRouter.get(
  "/",
  authenticated,
  authorizeProjectMember,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {projectId} = req.query;
      const query = admin
        .firestore()
        .collection(Collection.AMBAGS)
        .where("projectId", "==", projectId);
      const snapshot = await query.get();
      const ambags: Record<string, unknown>[] = [];
      snapshot.forEach((doc) => {
        ambags.push({id: doc.id, ...doc.data()});
      });
      return res.status(200).json(ambags);
    } catch (error) {
      logger.error("Error getting ambags:", error);
      return res.status(500).send("Error getting ambags");
    }
  },
);

// GET /ambags/:id - Get a single ambag
ambagsRouter.get(
  "/:id",
  authenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const doc = await validateDocument(req.params.id, Collection.AMBAGS, res);
      res.status(200).json({id: doc.id, ...doc.data()});
    } catch (error) {
      logger.error("Error getting ambag:", error);
      res.status(500).send("Error getting ambag");
    }
  });

// POST /ambags - Create a new ambag
ambagsRouter.post(
  "/",
  authenticated,
  validateBody(AmbagSchema),
  authorizeProjectMember,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.uid as string;
      const userRef = admin
        .firestore()
        .collection(Collection.USERS)
        .doc(userId);
      const ambagRef = admin
        .firestore()
        .collection(Collection.AMBAGS).doc();
      const projectRef = admin
        .firestore()
        .collection(Collection.PROJECTS)
        .doc(req.body.projectId);

      await admin.firestore().runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error("User not found");
        }

        const projectDoc = await transaction.get(projectRef);
        if (!projectDoc.exists) {
          throw new Error("Project not found");
        }

        const contributor = {
          name: userDoc.data()?.displayName || "",
          photoUrl: userDoc.data()?.photoURL || "",
        };

        transaction.set(ambagRef, {
          ...req.body,
          contributor,
          createdBy: userId,
          createdAt: FieldValue.serverTimestamp(),
        });
      });

      res
        .status(201)
        .json({id: ambagRef.id, message: "Ambag added successfully"});
    } catch (error) {
      logger.error("Error adding ambag:", error);
      if (error instanceof Error && error.message === "User not found") {
        res.status(404).send("User not found");
      }
      if (error instanceof Error && error.message === "Project not found") {
        res.status(404).send("Project not found");
      }
      res.status(500).send("Error adding ambag");
    }
  },
);

// PATCH /ambags/:id - Update an ambag
ambagsRouter.patch(
  "/:id",
  authenticated,
  authorizeAmbagOwner,
  validateBody(AmbagSchema.partial()),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await validateDocument(req.params.id, Collection.AMBAGS, res);
      await admin
        .firestore()
        .collection(Collection.AMBAGS)
        .doc(req.params.id)
        .update({
          ...req.body,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: req.user?.uid,
        });
      res.status(200).json({message: "Ambag updated successfully"});
    } catch (error) {
      logger.error("Error updating ambag:", error);
      res.status(500).send("Error updating ambag");
    }
  },
);

// DELETE /ambags/:id - Delete an ambag
ambagsRouter.delete(
  "/:id",
  authenticated,
  authorizeAmbagOwner,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await validateDocument(req.params.id, Collection.AMBAGS, res);
      await admin
        .firestore()
        .collection(Collection.AMBAGS)
        .doc(req.params.id)
        .delete();
      res.status(200).json({message: "Ambag deleted successfully"});
    } catch (error) {
      logger.error("Error deleting ambag:", error);
      res.status(500).send("Error deleting ambag");
    }
  });

export default ambagsRouter;

// POST /ambags/upload - Upload a photo for an ambag
ambagsRouter.post("/upload", (req: AuthenticatedRequest, res: Response) => {
  const busboy = _busboy({headers: req.headers});
  const bucket = admin.storage().bucket();

  busboy.on(
    "file",
    (
      fieldname: string,
      file: NodeJS.ReadableStream,
      filename: {filename: string; encoding: string; mimeType: string},
    ) => {
      const storageFile = bucket.file(filename.filename);
      const stream = storageFile.createWriteStream();

      file.pipe(stream);

      stream.on("error", (err) => {
        logger.error("Storage stream error:", err);
        res.status(500).send("Error uploading file.");
      });

      stream.on("finish", async () => {
        try {
          // Make the file publicly readable
          await storageFile.makePublic();

          // Construct the permanent public URL
          const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storageFile.name}`;

          // Log the upload to Firestore
          await admin.firestore().collection(Collection.UPLOADS).add({
            photoUrl: publicUrl, // Use the new public URL
            storagePath: storageFile.name,
            uploadedBy: req.user?.uid,
            createdAt: FieldValue.serverTimestamp(),
          });

          res.status(200).json({
            photoUrl: publicUrl,
          });
        } catch (error) {
          logger.error("Error in finish event:", error);
          res.status(500).send("Error processing file after upload.");
        }
      });
    },
  );

  busboy.end(req.rawBody);
});
