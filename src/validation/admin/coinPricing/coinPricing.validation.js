import Joi from "joi";
import { COIN_PRICING_CATEGORIES } from "../../../models/admin/coinPricing/coinPricing.model.js";

const objectIdSchema = Joi.string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/)
  .message("Invalid object id");

export const categoryParamSchema = Joi.object({
  category: Joi.string()
    .valid(...COIN_PRICING_CATEGORIES)
    .required(),
});

export const categoryWithPackageParamSchema = Joi.object({
  category: Joi.string()
    .valid(...COIN_PRICING_CATEGORIES)
    .required(),
  packageId: objectIdSchema.required(),
});

export const coinPackageSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  coins: Joi.number().integer().min(0).required(),
  price: Joi.number().precision(2).min(0).required(),
  isVisible: Joi.boolean().optional(),
});

export const updateCoinPackageSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).optional(),
  coins: Joi.number().integer().min(0).optional(),
  price: Joi.number().precision(2).min(0).optional(),
  isVisible: Joi.boolean().optional(),
}).min(1);

export const coinRuleSchema = Joi.object({
  baseAmount: Joi.number().min(1).optional(),
  baseCoins: Joi.number().min(1).optional(),
  coinCostPerApplication: Joi.number().min(0).optional(),
  coinPerEmployeeCount: Joi.number().min(0).optional(),
  coinCostPerJobPost: Joi.number().min(0).optional(),
  // Category-wise coin cost for job posting
  coinCostPerJobPostByCategory: Joi.object({
    "Non-Degree Holder": Joi.number().min(0).optional(),
    "Diploma Holder": Joi.number().min(0).optional(),
    "ITI Holder": Joi.number().min(0).optional(),
  }).optional(),
  referralSettings: Joi.object({
    isEnabled: Joi.boolean().optional(),
    referrerCoins: Joi.number().min(0).optional(),
    refereeRewardEnabled: Joi.boolean().optional(),
    refereeCoins: Joi.number().min(0).optional(),
    maxReferralsPerUser: Joi.number().min(0).optional(),
  }).optional(),
}).min(1);
