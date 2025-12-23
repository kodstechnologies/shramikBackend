import ApiError from "../utils/ApiError.js";

const feedbackValidation = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body, {
        abortEarly: true,      // stop at first error
        stripUnknown: true,   // remove extra fields
    });

    if (error) {
        throw new ApiError(400, error.details[0].message);
    }

    next();
};

export default feedbackValidation;
