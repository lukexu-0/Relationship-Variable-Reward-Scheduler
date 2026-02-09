import mongoose, { Schema, type InferSchemaType } from "mongoose";

const idempotencyKeySchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    kind: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true, collection: "idempotency_keys" }
);

export type IdempotencyKey = InferSchemaType<typeof idempotencyKeySchema>;
export const IdempotencyKeyModel =
  (mongoose.models.WorkerIdempotencyKey as mongoose.Model<IdempotencyKey>) ||
  mongoose.model<IdempotencyKey>("WorkerIdempotencyKey", idempotencyKeySchema);
