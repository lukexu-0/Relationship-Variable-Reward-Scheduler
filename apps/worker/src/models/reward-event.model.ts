import mongoose, { Schema, type InferSchemaType } from "mongoose";

const adjustmentSchema = new Schema(
  {
    fromAt: { type: Date, required: true },
    toAt: { type: Date, required: true },
    reason: { type: String, required: true },
    adjustedByUserId: { type: String, required: true },
    adjustedAt: { type: Date, required: true }
  },
  { _id: false }
);

const rewardEventSchema = new Schema(
  {
    profileId: { type: Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
    templateId: { type: Schema.Types.ObjectId, ref: "RewardTemplate", required: true, index: true },
    scheduledAt: { type: Date, required: true, index: true },
    originalScheduledAt: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: ["SCHEDULED", "COMPLETED", "MISSED", "RESCHEDULED", "CANCELED"],
      default: "SCHEDULED"
    },
    completedAt: { type: Date },
    missedAt: { type: Date },
    sentimentLevel: { type: String },
    notes: { type: String },
    adjustments: { type: [adjustmentSchema], default: [] }
  },
  { timestamps: true, collection: "reward_events" }
);

export type RewardEvent = InferSchemaType<typeof rewardEventSchema>;
export const RewardEventModel =
  (mongoose.models.WorkerRewardEvent as mongoose.Model<RewardEvent>) ||
  mongoose.model<RewardEvent>("WorkerRewardEvent", rewardEventSchema);
