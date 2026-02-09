import mongoose, { Schema, type InferSchemaType } from "mongoose";

const reminderPreferencesSchema = new Schema(
  {
    emailEnabled: { type: Boolean, required: true, default: true },
    reminderLeadHours: { type: Number, required: true, default: 24, min: 1, max: 168 }
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    timezone: { type: String, required: true, default: "UTC" },
    reminderPreferences: { type: reminderPreferencesSchema, required: true }
  },
  { timestamps: true, collection: "users" }
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDocument = mongoose.HydratedDocument<User>;

export const UserModel =
  (mongoose.models.User as mongoose.Model<User>) || mongoose.model<User>("User", userSchema);
