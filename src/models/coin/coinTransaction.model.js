import mongoose from "mongoose";

const { Schema, model } = mongoose;

const coinTransactionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
      refPath: "userTypeModel",
    },
    userType: {
      type: String,
      enum: ["job-seeker", "recruiter"],
      required: true,
      index: true,
    },
    userTypeModel: {
      type: String,
      enum: ["JobSeeker", "Recruiter"],
      required: true,
    },
    transactionType: {
      type: String,
      enum: ["purchase", "deduction", "refund", "referral"],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      // Positive for purchase/refund, negative for deduction
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
      // INR amount (only for purchases)
    },
    // Razorpay fields (for future integration)
    razorpayOrderId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true
    },

    razorpayPaymentId: {
      type: String,
      trim: true,
    },
    razorpaySignature: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed", "refunded"],
      // default: "success",
      default: "pending",
      index: true,
    },
    description: {
      type: String,
      trim: true,
      required: true,
    },
    // Related entity (job or application)
    relatedEntityId: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    relatedEntityType: {
      type: String,
      enum: ["job", "application"],
    },
    // Balance after this transaction
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
coinTransactionSchema.index({ userId: 1, userType: 1, createdAt: -1 });
coinTransactionSchema.index({ status: 1, createdAt: -1 });
coinTransactionSchema.index({ transactionType: 1, createdAt: -1 });

export const CoinTransaction = model("CoinTransaction", coinTransactionSchema);

