import mongoose, { Schema, type InferSchemaType } from "mongoose";

const profileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    profileName: { type: String, required: true, trim: true },
    partnerName: { type: String, trim: true },
    active: { type: Boolean, required: true, default: true }
  },
  { timestamps: true, collection: "profiles" }
);

export type Profile = InferSchemaType<typeof profileSchema>;
export type ProfileDocument = mongoose.HydratedDocument<Profile>;

export const ProfileModel =
  (mongoose.models.Profile as mongoose.Model<Profile>) ||
  mongoose.model<Profile>("Profile", profileSchema);
