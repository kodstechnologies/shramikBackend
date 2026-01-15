import { Router } from "express";
import {
  createCoinPackage,
  deleteCoinPackage,
  getCoinPricing,
  getPackagePopularity,
  updateCoinPackage,
  updateCoinRules,
} from "../../../controllers/admin/coinPricing/coinPricing.controller.js";
import { validateRequest } from "../../../middlewares/admin/coinPricing/validateCoinPricing.js";
import {
  categoryParamSchema,
  categoryWithPackageParamSchema,
  coinPackageSchema,
  coinRuleSchema,
  updateCoinPackageSchema,
} from "../../../validation/admin/coinPricing/coinPricing.validation.js";
import { verifyJWT } from "../../../middlewares/authMiddleware.js";

const router = Router();

router.use(verifyJWT());

router.get(
  "/:category",
  validateRequest(categoryParamSchema, "params"),
  getCoinPricing
);

router.post(
  "/:category/packages",
  validateRequest(categoryParamSchema, "params"),
  validateRequest(coinPackageSchema),
  createCoinPackage
);

router.put(
  "/:category/packages/:packageId",
  validateRequest(categoryWithPackageParamSchema, "params"),
  validateRequest(updateCoinPackageSchema),
  updateCoinPackage
);

router.delete(
  "/:category/packages/:packageId",
  validateRequest(categoryWithPackageParamSchema, "params"),
  deleteCoinPackage
);

router.put(
  "/:category/rules",
  validateRequest(categoryParamSchema, "params"),
  validateRequest(coinRuleSchema),
  updateCoinRules
);

router.get(
  "/:category/popularity",
  validateRequest(categoryParamSchema, "params"),
  getPackagePopularity
);

export default router;
