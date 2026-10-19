
import { ApiError } from "../utils/ApiError.js";

const errorMiddleware = (err, req, res, next) => {
  const statusCode = err instanceof ApiError ? err.statusCode : 500;

  const message =
    err instanceof ApiError ? err.message : "Internal Server Error";

  return res.status(statusCode).json({
    statusCode,
    data: null,
    message,
    success: false,
    errors: err instanceof ApiError ? err.errors : []
  });
};

export { errorMiddleware };
