import { z } from "zod";
// Step 1 – Basic Info
export const step1Schema = z.object({
    body: z.object({
        eventId: z.string().uuid().optional(), // Present when updating existing draft
        title: z.string().min(3, "Title must be at least 3 characters"),
        category: z.string().min(1, "Category is required"),
        eventType: z.string().min(1, "Event type is required"),
        capacity: z.coerce.number().int().min(1, "Capacity must be at least 1"),
        isFree: z.preprocess((val) => {
            if (typeof val === "string") {
                if (val.toLowerCase() === "true")
                    return true;
                if (val.toLowerCase() === "false")
                    return false;
            }
            return val;
        }, z.boolean()),
        price: z.coerce.number().min(0).optional(),
        isDepositModel: z.preprocess((val) => {
            if (typeof val === "string") {
                if (val.toLowerCase() === "true")
                    return true;
                if (val.toLowerCase() === "false")
                    return false;
            }
            return val;
        }, z.boolean()).optional(),
        refundPenaltyRate: z.coerce.number().min(0).max(1).optional(),
    }),
});
// Step 2 – Date & Time
export const step2Schema = z.object({
    body: z.object({
        eventId: z.string().uuid("Valid event ID required"),
        startDate: z.string().min(1, "Start date is required"),
        startTime: z.string().min(1, "Start time is required"),
        endDate: z.string().optional(),
        endTime: z.string().optional(),
        timezone: z.string().min(1, "Timezone is required"),
    }),
});
// Step 3 – Location
export const step3Schema = z.object({
    body: z.object({
        eventId: z.string().uuid("Valid event ID required"),
        venueType: z.enum(["ONLINE", "OFFLINE"]),
        venueName: z.string().optional(),
        address: z.string().optional(),
        mapLat: z.coerce.number().optional(),
        mapLng: z.coerce.number().optional(),
        onlineLink: z.string().url().optional(),
    }),
});
// Step 4 – Details
export const step4Schema = z.object({
    body: z.object({
        eventId: z.string().uuid("Valid event ID required"),
        agenda: z.string().optional(),
        whatToBring: z.string().optional(),
        tags: z.array(z.string()).optional(),
        visibility: z.enum(["PUBLIC", "FRIENDS_ONLY"]).optional(),
    }),
});
// Publish event
export const publishSchema = z.object({
    params: z.object({
        id: z.string().uuid("Valid event ID required"),
    }),
});
//# sourceMappingURL=event.validator.js.map