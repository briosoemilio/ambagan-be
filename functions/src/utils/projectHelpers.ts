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

export const isProjectMemberOrCreator = async (
  userId: string,
  projectId: string,
): Promise<boolean> => {
  const projectDoc = await admin
    .firestore()
    .collection(Collection.PROJECTS)
    .doc(projectId)
    .get();

  if (!projectDoc.exists) {
    return false;
  }

  const projectData = projectDoc.data();
  const isCreator = projectData?.createdBy === userId;
  const isMember = Array.isArray(projectData?.members) ?
    projectData.members.some((member) => member?.id === userId) :
    false;

  return isCreator || isMember;
};
