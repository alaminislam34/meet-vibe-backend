import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";
import { HTTP_STATUS } from "../constants/index.js";
export const validate = (schema) => {
    return async (req, res, next) => {
        try {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            next();
        }
        catch (error) {
            if (error instanceof ZodError) {
                const formattedErrors = error.errors.map((err) => ({
                    field: err.path.slice(1).join("."), // Strips top-level "body", "query", etc.
                    message: err.message,
                }));
                next(new AppError("Validation failed", HTTP_STATUS.BAD_REQUEST, formattedErrors));
            }
            else {
                next(error);
            }
        }
    };
};
//# sourceMappingURL=validate.js.map