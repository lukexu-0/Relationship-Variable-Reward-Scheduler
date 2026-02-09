import mongoose, { Schema, type InferSchemaType } from "mongoose";

const emailLogSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, required: true, index: true },
    recipient: { type: String, required: true },
    template: { type: String, required: true },
    status: { type: String, required: true },
    providerMessageId: { type: String },
    sentAt: { type: Date, required: true }
  },
  { timestamps: true, collection: "email_logs" }
);

export type EmailLog = InferSchemaType<typeof emailLogSchema>;
export const EmailLogModel =
  (mongoose.models.WorkerEmailLog as mongoose.Model<EmailLog>) ||
  mongoose.model<EmailLog>("WorkerEmailLog", emailLogSchema);
