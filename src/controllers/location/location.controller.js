import { State } from "../../models/location/state.model.js";
import { City } from "../../models/location/city.model.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import ApiError from "../../utils/ApiError.js";

/**
 * Get All States (Public endpoint)
 * Returns all active states for dropdown selection
 * Supports multi-language via ?lang= query parameter (default: en)
 * Supported languages: en, hi, mr, ta, te, bn, gu, kn, ml, or, pa
 */
export const getAllStates = asyncHandler(async (req, res) => {
  const lang = req.query.lang || "en"; // Default to English

  const states = await State.find({ status: "Active" })
    .select("_id name code translations")
    .sort({ name: 1 })
    .lean();

  const formattedStates = states.map((state) => {
    // Get name in requested language, fallback to English if not available
    const localizedName = lang === "en"
      ? state.name
      : (state.translations?.[lang] || state.name);

    return {
      _id: state._id,
      value: state._id.toString(),
      label: localizedName,
      name: localizedName,
      nameEn: state.name, // Always include English name for reference
      code: state.code,
    };
  });

  return res
    .status(200)
    .json(
      ApiResponse.success(
        { states: formattedStates, language: lang },
        "States fetched successfully"
      )
    );
});

/**
 * Get Cities by State (Public endpoint)
 * Returns all active cities for a specific state
 * Supports multi-language via ?lang= query parameter (default: en)
 * Supported languages: en, hi, mr, ta, te, bn, gu, kn, ml, or, pa
 */
export const getCitiesByState = asyncHandler(async (req, res) => {
  const { stateId } = req.params;
  const lang = req.query.lang || "en"; // Default to English

  if (!stateId) {
    throw new ApiError(400, "State ID is required");
  }

  // Verify state exists (include translations)
  const state = await State.findById(stateId).select("_id name code translations");
  if (!state) {
    throw new ApiError(404, "State not found");
  }

  // Get localized state name
  const localizedStateName = lang === "en"
    ? state.name
    : (state.translations?.[lang] || state.name);

  // Get cities for this state (include translations)
  const cities = await City.find({
    stateId: stateId,
    status: "Active",
  })
    .select("_id name stateId stateName translations")
    .sort({ name: 1 })
    .lean();

  const formattedCities = cities.map((city) => {
    // Get name in requested language, fallback to English if not available
    const localizedCityName = lang === "en"
      ? city.name
      : (city.translations?.[lang] || city.name);

    return {
      _id: city._id,
      value: city._id.toString(),
      label: localizedCityName,
      name: localizedCityName,
      nameEn: city.name, // Always include English name for reference
      stateId: city.stateId,
      stateName: localizedStateName,
    };
  });

  return res
    .status(200)
    .json(
      ApiResponse.success(
        {
          state: {
            _id: state._id,
            name: localizedStateName,
            nameEn: state.name, // Always include English name
            code: state.code,
          },
          cities: formattedCities,
          language: lang,
        },
        "Cities fetched successfully"
      )
    );
});

/**
 * Get Cities by State Name (Alternative endpoint)
 * Returns all active cities for a specific state by state name
 */
export const getCitiesByStateName = asyncHandler(async (req, res) => {
  const { stateName } = req.params;

  if (!stateName) {
    throw new ApiError(400, "State name is required");
  }

  // Find state by name (case-insensitive)
  const state = await State.findOne({
    name: { $regex: new RegExp(`^${stateName}$`, "i") },
    status: "Active",
  });

  if (!state) {
    throw new ApiError(404, "State not found");
  }

  // Get cities for this state
  const cities = await City.find({
    stateId: state._id,
    status: "Active",
  })
    .select("_id name stateId stateName")
    .sort({ name: 1 })
    .lean();

  const formattedCities = cities.map((city) => ({
    _id: city._id,
    value: city._id.toString(),
    label: city.name,
    name: city.name,
    stateId: city.stateId,
    stateName: city.stateName,
  }));

  return res
    .status(200)
    .json(
      ApiResponse.success(
        {
          state: {
            _id: state._id,
            name: state.name,
            code: state.code,
          },
          cities: formattedCities,
        },
        "Cities fetched successfully"
      )
    );
});

/**
 * Get Years for Year of Passing Dropdown (Public endpoint)
 * Returns last 100 years from current year, auto-incrementing
 * Years are in descending order (most recent first)
 */
export const getYears = asyncHandler(async (req, res) => {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 99; // Last 100 years (including current year)

  // Generate years array from startYear to currentYear (descending order)
  const years = [];
  for (let year = currentYear; year >= startYear; year--) {
    years.push({
      value: year.toString(),
      label: year.toString(),
      year: year,
    });
  }

  return res
    .status(200)
    .json(
      ApiResponse.success(
        {
          years: years,
          currentYear: currentYear,
          startYear: startYear,
          totalYears: years.length,
        },
        "Years fetched successfully"
      )
    );
});

