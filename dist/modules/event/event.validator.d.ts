import { z } from "zod";
export declare const draftStepSchema: z.ZodObject<{
    body: z.ZodObject<{
        eventId: z.ZodOptional<z.ZodString>;
        step: z.ZodNumber;
        title: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        dateTime: z.ZodOptional<z.ZodString>;
        location: z.ZodOptional<z.ZodString>;
        price: z.ZodOptional<z.ZodNumber>;
        maxParticipants: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        step: number;
        eventId?: string | undefined;
        title?: string | undefined;
        description?: string | undefined;
        dateTime?: string | undefined;
        location?: string | undefined;
        price?: number | undefined;
        maxParticipants?: number | undefined;
    }, {
        step: number;
        eventId?: string | undefined;
        title?: string | undefined;
        description?: string | undefined;
        dateTime?: string | undefined;
        location?: string | undefined;
        price?: number | undefined;
        maxParticipants?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        step: number;
        eventId?: string | undefined;
        title?: string | undefined;
        description?: string | undefined;
        dateTime?: string | undefined;
        location?: string | undefined;
        price?: number | undefined;
        maxParticipants?: number | undefined;
    };
}, {
    body: {
        step: number;
        eventId?: string | undefined;
        title?: string | undefined;
        description?: string | undefined;
        dateTime?: string | undefined;
        location?: string | undefined;
        price?: number | undefined;
        maxParticipants?: number | undefined;
    };
}>;
