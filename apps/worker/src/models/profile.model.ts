import mongoose, { Schema, type InferSchemaType } from "mongoose";

const profileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    profileName: { type: String, required: true },
    partnerName: { type: String },
    active: { type: Boolean, required: true, default: true }
  },
  { timestamps: true, collection: "profiles" }
);

export type Profile = InferSchemaType<typeof profileSchema>;
export const ProfileModel =
  (mongoose.models.WorkerProfile as mongoose.Model<Profile>) ||
  mongoose.model<Profile>("WorkerProfile", profileSchema);
