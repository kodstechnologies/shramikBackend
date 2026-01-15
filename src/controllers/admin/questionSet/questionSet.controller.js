import mongoose from "mongoose";
import { QuestionSet } from "../../../models/admin/questionSet/questionSet.model.js";
import { Specialization } from "../../../models/admin/specialization/specialization.model.js";
import ApiError from "../../../utils/ApiError.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

const normalizeNumber = (value, defaultValue = 0) => {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return defaultValue;
};

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeSpecializations = (values) => {
  if (!Array.isArray(values)) return [];
  const ids = values
    .map((value) => {
      if (typeof value === "string" && mongoose.Types.ObjectId.isValid(value)) {
        return new mongoose.Types.ObjectId(value);
      }
      if (value instanceof mongoose.Types.ObjectId) {
        return value;
      }
      return null;
    })
    .filter(Boolean);

  return [...new Set(ids)];
};

const normalizeOptions = (options) => {
  if (!Array.isArray(options)) return [];
  return options
    .map((option) => ({
      text: normalizeString(option?.text ?? option?.label),
      isCorrect: Boolean(option?.isCorrect ?? option?.correct),
    }))
    .filter((option) => option.text);
};

const normalizeQuestions = (questions) => {
  if (!Array.isArray(questions)) return [];

  return questions
    .map((question) => ({
      text: normalizeString(question?.text),
      options: normalizeOptions(question?.options),
    }))
    .filter(
      (question) =>
        question.text &&
        Array.isArray(question.options) &&
        question.options.length >= 2 &&
        question.options.some((option) => option.isCorrect)
    );
};

const buildQuestionSetPayload = (body, userId, options = {}) => {
  const { includeCreatedBy = false } = options;

  const payload = {
    totalQuestions: normalizeNumber(body?.totalQuestions ?? body?.questions, 0),
    specializationIds: normalizeSpecializations(
      body?.specializationIds ?? body?.specializations
    ),
    questions: normalizeQuestions(body?.questions),
  };

  if (typeof body?.name === "string") {
    payload.name = normalizeString(body.name);
  }

  if (userId) {
    payload.updatedBy = userId;
    if (includeCreatedBy) {
      payload.createdBy = userId;
    }
  }

  return payload;
};

export const createQuestionSet = asyncHandler(async (req, res) => {
  const normalizedName = normalizeString(req.body?.name);
  const specializationIds = normalizeSpecializations(
    req.body?.specializationIds ?? req.body?.specializations
  );

  if (!specializationIds.length) {
    throw new ApiError(400, "At least one specialization is required");
  }

  const specializationDocs = await Specialization.find({
    _id: { $in: specializationIds },
  }).select("name");

  if (specializationDocs.length !== specializationIds.length) {
    throw new ApiError(400, "One or more specialization ids are invalid");
  }

  let finalName = normalizedName;
  if (!finalName) {
    finalName = specializationDocs.map((doc) => doc.name).filter(Boolean).join(" / ");
    if (!finalName) {
      finalName = `Question Set ${Date.now()}`;
    }
  }

  const existing = await QuestionSet.findOne({ name: finalName });
  if (existing) {
    finalName = `${finalName} ${Date.now()}`;
  }

  const payload = buildQuestionSetPayload(
    {
      ...req.body,
      name: finalName,
      specializationIds,
    },
    req.user?._id,
    { includeCreatedBy: true }
  );

  if (!payload.name || !payload.specializationIds.length) {
    throw new ApiError(400, "Invalid question set payload");
  }

  payload.totalQuestions = Array.isArray(payload.questions)
    ? payload.questions.length
    : 0;

  const questionSet = await QuestionSet.create(payload);

  return res
    .status(201)
    .json(
      ApiResponse.success(
        { questionSet },
        "Question set created successfully"
      )
    );
});

export const getQuestionSets = asyncHandler(async (req, res) => {
  const questionSets = await QuestionSet.find({})
    .populate("specializationIds", "name status skills userType")
    .sort({ createdAt: -1 })
    .lean();

  return res
    .status(200)
    .json(
      ApiResponse.success(
        { questionSets },
        "Question sets fetched successfully"
      )
    );
});

export const getQuestionSetById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const questionSet = await QuestionSet.findById(id)
    .populate("specializationIds", "name status skills userType")
    .lean();
  if (!questionSet) {
    throw new ApiError(404, "Question set not found");
  }

  return res
    .status(200)
    .json(
      ApiResponse.success(
        { questionSet },
        "Question set fetched successfully"
      )
    );
});

export const updateQuestionSet = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const specializationIds = normalizeSpecializations(
    req.body?.specializationIds ?? req.body?.specializations
  );

  const questionSet = await QuestionSet.findById(id);
  if (!questionSet) {
    throw new ApiError(404, "Question set not found");
  }

  const payload = buildQuestionSetPayload(req.body, req.user?._id);

  let specializationDocs = [];
  if (specializationIds.length) {
    specializationDocs = await Specialization.find({
      _id: { $in: specializationIds },
    }).select("name");
    if (specializationDocs.length !== specializationIds.length) {
      throw new ApiError(400, "One or more specialization ids are invalid");
    }
  }

  if (
    (req.body?.specializationIds || req.body?.specializations) &&
    !specializationIds.length
  ) {
    throw new ApiError(
      400,
      "Question set must target at least one specialization"
    );
  }

  let finalName = payload.name ? payload.name : questionSet.name;
  if (!payload.name) {
    const baseDocs = specializationDocs.length
      ? specializationDocs
      : await Specialization.find({
        _id: { $in: questionSet.specializationIds },
      }).select("name");
    const generatedName = baseDocs
      .map((doc) => doc.name)
      .filter(Boolean)
      .join(" / ");
    finalName = generatedName || questionSet.name || `Question Set ${Date.now()}`;
  }

  if (finalName && questionSet.name.toLowerCase() !== finalName.toLowerCase()) {
    const duplicate = await QuestionSet.findOne({
      name: finalName,
      _id: { $ne: id },
    });
    if (duplicate) {
      finalName = `${finalName} ${Date.now()}`;
    }
  }

  Object.assign(questionSet, {
    ...payload,
    specializationIds:
      specializationIds.length > 0
        ? specializationIds
        : questionSet.specializationIds,
    name: finalName,
  });

  questionSet.totalQuestions = Array.isArray(questionSet.questions)
    ? questionSet.questions.length
    : 0;

  await questionSet.save();

  return res
    .status(200)
    .json(
      ApiResponse.success(
        { questionSet },
        "Question set updated successfully"
      )
    );
});

export const deleteQuestionSet = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const questionSet = await QuestionSet.findByIdAndDelete(id);
  if (!questionSet) {
    throw new ApiError(404, "Question set not found");
  }

  return res
    .status(200)
    .json(ApiResponse.success(null, "Question set deleted successfully"));
});


