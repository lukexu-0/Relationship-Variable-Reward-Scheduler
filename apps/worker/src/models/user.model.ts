import mongoose, { Schema, type InferSchemaType } from "mongoose";

const reminderSchema = new Schema(
  {
    emailEnabled: { type: Boolean, required: true, default: true },
    reminderLeadHours: { type: Number, required: true, default: 24 }
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    email: { type: String, required: true },
    timezone: { type: String, required: true, default: "UTC" },
    reminderPreferences: { type: reminderSchema, required: true }
  },
  { timestamps: true, collection: "users" }
);

export type User = InferSchemaType<typeof userSchema>;
export const UserModel =
  (mongoose.models.WorkerUser as mongoose.Model<User>) || mongoose.model<User>("WorkerUser", userSchema);
