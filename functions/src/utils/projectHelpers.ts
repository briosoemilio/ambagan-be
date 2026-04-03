import * as admin from "firebase-admin";
import {Collection} from "../constants/Collection";

export const isProjectCreator = async (
  userId: string,
  projectId: string,
): Promise<boolean> => {
  const doc = await admin
    .firestore()
    .collection(Collection.PROJECTS)
    .doc(projectId)
    .get();

  if (!doc.exists) return false;

  const projectData = doc.data();
  return projectData?.createdBy === userId;
};
