import mongoose from "mongoose";

import { config } from "../config.js";

export async function connectDatabase(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(config.MONGODB_URI);
}
