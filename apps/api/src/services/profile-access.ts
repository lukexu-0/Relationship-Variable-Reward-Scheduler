import { HttpError } from "../lib/http-error.js";
import { ProfileModel, type ProfileDocument } from "../models/profile.model.js";

export async function getOwnedProfile(profileId: string, userId: string): Promise<ProfileDocument> {
  const profile = await ProfileModel.findById(profileId);
  if (!profile || profile.userId.toString() !== userId) {
    throw new HttpError(404, "Profile not found");
  }

  return profile;
}
