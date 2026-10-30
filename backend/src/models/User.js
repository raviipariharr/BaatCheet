import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { SUPPORTED_LANGUAGES } from "../lib/languages.js";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    bio: { type: String, default: "", maxlength: 200 },
    profilePic: {
      type: String,
      default: "",
    },
    nativeLanguage: { type: String, enum: ["", ...SUPPORTED_LANGUAGES], default: "" },
    learningLanguage: { type: String, enum: ["", ...SUPPORTED_LANGUAGES], default: "" },
    knownLanguages: {
      type: [{ type: String, enum: SUPPORTED_LANGUAGES }],
      default: [],
    },

    avatarData: {
      type: Buffer,
      select: false,
    },
    location: {
      type: String,
      default: "",
    },
    isOnboarded: {
      type: Boolean,
      default: false,
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  const isPasswordCorrect = await bcrypt.compare(enteredPassword, this.password);
  return isPasswordCorrect;
};

userSchema.index({ nativeLanguage: 1, learningLanguage: 1 });

const User = mongoose.model("User", userSchema);

export default User;
