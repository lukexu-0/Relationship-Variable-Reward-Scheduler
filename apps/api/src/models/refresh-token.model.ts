import mongoose, { Schema, type InferSchemaType } from "mongoose";

const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenId: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date }
  },
  { timestamps: true, collection: "refresh_tokens" }
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshToken = InferSchemaType<typeof refreshTokenSchema>;
export type RefreshTokenDocument = mongoose.HydratedDocument<RefreshToken>;

export const RefreshTokenModel =
  (mongoose.models.RefreshToken as mongoose.Model<RefreshToken>) ||
  mongoose.model<RefreshToken>("RefreshToken", refreshTokenSchema);
