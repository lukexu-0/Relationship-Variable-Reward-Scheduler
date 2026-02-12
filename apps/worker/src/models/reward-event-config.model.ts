import mongoose, { Schema, type InferSchemaType } from "mongoose";

const rewardEventConfigSchema = new Schema(
  {
    profileId: { type: Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    baseIntervalDays: { type: Number, required: true, min: 1, max: 365 },
    jitterPct: { type: Number, required: true, min: 0, max: 0.9 },
    enabled: { type: Boolean, required: true, default: true }
  },
  { timestamps: true, collection: "reward_templates" }
);

rewardEventConfigSchema.index({ profileId: 1, slug: 1 }, { unique: true });
rewardEventConfigSchema.index({ profileId: 1, name: 1 }, { unique: true });

export type RewardEventConfig = InferSchemaType<typeof rewardEventConfigSchema>;
export const RewardEventConfigModel =
  (mongoose.models.WorkerRewardEventConfig as mongoose.Model<RewardEventConfig>) ||
  mongoose.model<RewardEventConfig>("WorkerRewardEventConfig", rewardEventConfigSchema);
