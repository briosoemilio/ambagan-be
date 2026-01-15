import * as admin from "firebase-admin";
import { Response } from "express";
import { Collection } from "../constants/Collection";

export const validateDocument = async (id: string, collection: Collection, res: Response) => {
  if (!Object.values(Collection).includes(collection)) {
    const error = new Error("Invalid collection");
    (error as any).statusCode = 400;
    throw error;
  }

  const doc = await admin.firestore().collection(collection).doc(id).get();
  if (!doc.exists) {
    const NOT_FOUND_CODE = 404;
    const error = new Error(`${collection} not found`);
    (error as any).statusCode = NOT_FOUND_CODE;
    res.status(NOT_FOUND_CODE).send({ code: NOT_FOUND_CODE, message: `${collection} not found` });
    throw error;
  }
  return doc;
};
