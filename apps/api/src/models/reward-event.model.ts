import mongoose, { Schema, type InferSchemaType } from "mongoose";

const eventAdjustmentSchema = new Schema(
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
    eventConfigId: { type: Schema.Types.ObjectId, ref: "RewardEventConfig", index: true },
    // Deprecated field kept while migration backfills eventConfigId.
    templateId: { type: Schema.Types.ObjectId, ref: "RewardTemplate", index: true },
    scheduledAt: { type: Date, required: true, index: true },
    originalScheduledAt: { type: Date, required: true },
    hasExplicitTime: { type: Boolean, required: true, default: false },
    status: {
      type: String,
      required: true,
      enum: ["SCHEDULED", "COMPLETED", "MISSED", "RESCHEDULED", "CANCELED"],
      default: "SCHEDULED"
    },
    completedAt: { type: Date },
    missedAt: { type: Date },
    sentimentLevel: {
      type: String,
      enum: ["VERY_POOR", "POOR", "NEUTRAL", "WELL", "VERY_WELL"]
    },
    notes: { type: String },
    adjustments: { type: [eventAdjustmentSchema], default: [] }
  },
  { timestamps: true, collection: "reward_events" }
);

export type RewardEvent = InferSchemaType<typeof rewardEventSchema>;
export type RewardEventDocument = mongoose.HydratedDocument<RewardEvent>;

export const RewardEventModel =
  (mongoose.models.RewardEvent as mongoose.Model<RewardEvent>) ||
  mongoose.model<RewardEvent>("RewardEvent", rewardEventSchema);
