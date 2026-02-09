import mongoose, { Schema, type InferSchemaType } from "mongoose";

const rewardTemplateSchema = new Schema(
  {
    profileId: { type: Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    baseIntervalDays: { type: Number, required: true, min: 1, max: 365 },
    jitterPct: { type: Number, required: true, min: 0, max: 0.9 },
    enabled: { type: Boolean, required: true, default: true }
  },
  { timestamps: true, collection: "reward_templates" }
);

rewardTemplateSchema.index({ profileId: 1, name: 1 }, { unique: true });
rewardTemplateSchema.index({ profileId: 1, category: 1 }, { unique: true });

export type RewardTemplate = InferSchemaType<typeof rewardTemplateSchema>;
export type RewardTemplateDocument = mongoose.HydratedDocument<RewardTemplate>;

export const RewardTemplateModel =
  (mongoose.models.RewardTemplate as mongoose.Model<RewardTemplate>) ||
  mongoose.model<RewardTemplate>("RewardTemplate", rewardTemplateSchema);
