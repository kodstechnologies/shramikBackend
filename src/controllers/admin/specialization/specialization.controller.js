import { Specialization } from "../../../models/admin/specialization/specialization.model.js";
import ApiError from "../../../utils/ApiError.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

const normalizeSkills = (values) => {
  if (!Array.isArray(values)) return [];
  const normalized = values
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length);
  return [...new Set(normalized)];
};

const buildSpecializationPayload = (body, userId, options = {}) => {
  const { includeCreatedBy = false } = options;

  const payload = {
    status: body?.status ?? "Active",
  };

  if (body?.skills !== undefined) {
    payload.skills = normalizeSkills(body.skills);
  }

  if (typeof body?.name === "string") {
    payload.name = body.name.trim();
  }

  if (typeof body?.userType === "string") {
    payload.userType = body.userType;
  }

  if (userId) {
    payload.updatedBy = userId;
    if (includeCreatedBy) {
      payload.createdBy = userId;
    }
  }

  return payload;
};

export const createSpecialization = asyncHandler(async (req, res) => {
  const rawName = req.body?.name;
  const normalizedName = typeof rawName === "string" ? rawName.trim() : "";

  if (!normalizedName) {
    throw new ApiError(400, "Name is required");
  }

  const existing = await Specialization.findOne({
    name: normalizedName,
  });

  if (existing) {
    throw new ApiError(409, "Specialization with this name already exists");
  }

  const payload = buildSpecializationPayload(
    { ...req.body, name: normalizedName },
    req.user?._id,
    {
      includeCreatedBy: true,
    }
  );

  if (!payload.skills) {
    payload.skills = [];
  }

  const specialization = await Specialization.create(payload);

  return res
    .status(201)
    .json(
      ApiResponse.success(
        { specialization },
        "Specialization created successfully"
      )
    );
});

export const getAllSpecializations = asyncHandler(async (req, res) => {
  const { status, userType } = req.query;

  const query = {};
  if (status && ["Active", "Inactive"].includes(status)) {
    query.status = status;
  }
  if (userType && ["Non-Degree Holder", "Diploma Holder", "ITI Holder"].includes(userType)) {
    query.userType = userType;
  }

  const specializations = await Specialization.find(query)
    .sort({ createdAt: -1 })
    .lean();

  return res
    .status(200)
    .json(
      ApiResponse.success(
        { specializations },
        "Specializations fetched successfully"
      )
    );
});

export const getSpecializationById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const specialization = await Specialization.findById(id).lean();

  if (!specialization) {
    throw new ApiError(404, "Specialization not found");
  }

  return res
    .status(200)
    .json(
      ApiResponse.success(
        { specialization },
        "Specialization fetched successfully"
      )
    );
});

export const updateSpecialization = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const specialization = await Specialization.findById(id);

  if (!specialization) {
    throw new ApiError(404, "Specialization not found");
  }

  const payload = buildSpecializationPayload(req.body, req.user?._id);

  if (payload.name) {
    if (specialization.name.toLowerCase() !== payload.name.toLowerCase()) {
      const duplicate = await Specialization.findOne({
        name: payload.name,
        _id: { $ne: id },
      });

      if (duplicate) {
        throw new ApiError(
          409,
          "Another specialization with this name exists"
        );
      }
    }
  }

  Object.assign(specialization, {
    ...payload,
    name: payload.name ?? specialization.name,
  });

  await specialization.save();

  return res
    .status(200)
    .json(
      ApiResponse.success(
        { specialization },
        "Specialization updated successfully"
      )
    );
});

export const deleteSpecialization = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const specialization = await Specialization.findByIdAndDelete(id);

  if (!specialization) {
    throw new ApiError(404, "Specialization not found");
  }

  return res
    .status(200)
    .json(ApiResponse.success(null, "Specialization deleted successfully"));
});


