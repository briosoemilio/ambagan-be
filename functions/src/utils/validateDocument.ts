import * as admin from "firebase-admin";
import {Collection} from "../constants/Collection";

export const validateDocument = async (id: string, collection: Collection) => {
  if (!Object.values(Collection).includes(collection)) {
    const error = new Error("Invalid collection");
    (error as any).statusCode = 400;
    throw error;
  }

  const doc = await admin.firestore().collection(collection).doc(id).get();
  if (!doc.exists) {
    const error = new Error(`${collection} not found`);
    (error as any).statusCode = 404;
    throw error;
  }
  return doc;
};
