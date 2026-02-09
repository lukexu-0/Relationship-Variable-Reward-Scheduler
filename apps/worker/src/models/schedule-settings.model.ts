import mongoose, { Schema, type InferSchemaType } from "mongoose";

const allowedWindowSchema = new Schema(
  {
    weekday: { type: Number, required: true },
    startLocalTime: { type: String, required: true },
    endLocalTime: { type: String, required: true }
  },
  { _id: false }
);

const blackoutSchema = new Schema(
  {
    startAt: { type: Date, required: true },
    endAt: { type: Date },
    allDay: { type: Boolean, default: false },
    note: { type: String }
  },
  { _id: false }
);

const scheduleSettingsSchema = new Schema(
  {
    profileId: { type: Schema.Types.ObjectId, ref: "Profile", required: true, unique: true },
    timezone: { type: String, required: true },
    reminderLeadHours: { type: Number, required: true, default: 24 },
    minGapHours: { type: Number, required: true, default: 24 },
    allowedWindows: { type: [allowedWindowSchema], default: [] },
    blackoutDates: { type: [blackoutSchema], default: [] }
  },
  { timestamps: true, collection: "schedule_settings" }
);

export type ScheduleSettings = InferSchemaType<typeof scheduleSettingsSchema>;
export const ScheduleSettingsModel =
  (mongoose.models.WorkerScheduleSettings as mongoose.Model<ScheduleSettings>) ||
  mongoose.model<ScheduleSettings>("WorkerScheduleSettings", scheduleSettingsSchema);
