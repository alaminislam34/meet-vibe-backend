import { z } from "zod";
export const sendConnectionSchema = z.object({
    body: z.object({
        receiverId: z.string().uuid("Valid user ID required"),
        requestMessage: z.string().max(300).optional(),
    }),
});
export const respondConnectionSchema = z.object({
    body: z.object({
        connectionId: z.string().uuid("Valid connection ID required"),
        action: z.enum(["ACCEPTED", "DECLINED"]),
    }),
});
//# sourceMappingURL=connection.validator.js.map