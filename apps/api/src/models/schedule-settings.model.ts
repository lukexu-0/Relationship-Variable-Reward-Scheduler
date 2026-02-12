import mongoose, { Schema, type InferSchemaType } from "mongoose";

const allowedWindowSchema = new Schema(
  {
    weekday: { type: Number, required: true, min: 0, max: 6 },
    startLocalTime: { type: String, required: true },
    endLocalTime: { type: String, required: true }
  },
  { _id: false }
);

const blackoutDateSchema = new Schema(
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
    timezone: { type: String, required: true, default: "UTC" },
    reminderLeadHours: { type: Number, required: true, default: 24, min: 1, max: 168 },
    minGapHours: { type: Number, required: true, default: 24, min: 1, max: 720 },
    allowedWindows: { type: [allowedWindowSchema], default: [] },
    recurringBlackoutWeekdays: { type: [Number], default: [] },
    blackoutDates: { type: [blackoutDateSchema], default: [] }
  },
  { timestamps: true, collection: "schedule_settings" }
);

export type ScheduleSettings = InferSchemaType<typeof scheduleSettingsSchema>;
export type ScheduleSettingsDocument = mongoose.HydratedDocument<ScheduleSettings>;

export const ScheduleSettingsModel =
  (mongoose.models.ScheduleSettings as mongoose.Model<ScheduleSettings>) ||
  mongoose.model<ScheduleSettings>("ScheduleSettings", scheduleSettingsSchema);
