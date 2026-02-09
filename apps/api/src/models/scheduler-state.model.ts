import mongoose, { Schema, type InferSchemaType } from "mongoose";

const templateStateSchema = new Schema(
  {
    templateId: { type: String, required: true },
    rollingSentimentScore: { type: Number, required: true, default: 0 },
    avgCompletionLagHours: { type: Number, required: true, default: 0 },
    lastScheduledAt: { type: Date },
    lastCompletedAt: { type: Date }
  },
  { _id: false }
);

const schedulerStateSchema = new Schema(
  {
    profileId: { type: Schema.Types.ObjectId, ref: "Profile", required: true, unique: true },
    perTemplate: { type: [templateStateSchema], default: [] }
  },
  { timestamps: true, collection: "scheduler_state" }
);

export type SchedulerState = InferSchemaType<typeof schedulerStateSchema>;
export type SchedulerStateDocument = mongoose.HydratedDocument<SchedulerState>;

export const SchedulerStateModel =
  (mongoose.models.SchedulerState as mongoose.Model<SchedulerState>) ||
  mongoose.model<SchedulerState>("SchedulerState", schedulerStateSchema);
