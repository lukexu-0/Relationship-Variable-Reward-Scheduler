import mongoose, { Schema, type InferSchemaType } from "mongoose";

const rewardTemplateSchema = new Schema(
  {
    profileId: { type: Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    baseIntervalDays: { type: Number, required: true },
    jitterPct: { type: Number, required: true },
    enabled: { type: Boolean, required: true, default: true }
  },
  { timestamps: true, collection: "reward_templates" }
);

export type RewardTemplate = InferSchemaType<typeof rewardTemplateSchema>;
export const RewardTemplateModel =
  (mongoose.models.WorkerRewardTemplate as mongoose.Model<RewardTemplate>) ||
  mongoose.model<RewardTemplate>("WorkerRewardTemplate", rewardTemplateSchema);
