import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import express from "express";
import cors from "cors";
import * as admin from "firebase-admin";

// Routes
import usersRouter from "./routes/users";

setGlobalOptions({maxInstances: 10});

// initialize app
const app = express();

// initialize firebase admin
if (!admin.apps.length) {
  admin.initializeApp();
}

// enable cors
app.use(cors({origin: true}));
app.use(express.json());

// routes
app.get("/hello", (_, res) => {
  logger.info("Hello logs!", {structuredData: true});
  res.send("Hello ambagan.io!!!");
});

// users route
app.use("/users", usersRouter);

exports.api = onRequest({region: "asia-southeast1"}, app);
