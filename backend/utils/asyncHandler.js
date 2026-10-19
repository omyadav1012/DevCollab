
import { ApiError } from "./ApiError.js";
import { ApiResponse } from "./ApiResponse.js";

const asyncHandler = (requestHandler) => {
    return async (req, res, next) => {
        try {
            await requestHandler(req, res, next);
        } catch (err) {
            const statusCode =
                err instanceof ApiError ? err.statusCode : 500;

            const message =
                err.message || "Internal Server Error";

            if (res.headersSent) {
                return next(err);
            }

            return res.status(statusCode).json(
                new ApiResponse(statusCode, null, message)
            );
        }
    };
};

export { asyncHandler };
