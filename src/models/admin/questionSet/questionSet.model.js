import mongoose from "mongoose";

const { Schema, model } = mongoose;

const questionOptionSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: false }
);

const questionSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    options: {
      type: [questionOptionSchema],
      validate: {
        validator: (value) => Array.isArray(value) && value.length >= 2,
        message: "Each question must have at least two options",
      },
      default: [],
    },
  },
  { _id: false }
);

const questionSetSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    specializationIds: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "Specialization",
          required: true,
        },
      ],
      default: [],
    },
    questions: {
      type: [questionSchema],
      default: [],
    },
    totalQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

questionSetSchema.pre("save", function (next) {
  this.totalQuestions = Array.isArray(this.questions)
    ? this.questions.length
    : 0;
  next();
});



export const QuestionSet = model("QuestionSet", questionSetSchema);


