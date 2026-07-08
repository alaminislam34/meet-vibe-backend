import { z } from "zod";
export declare const joinEventSchema: z.ZodObject<{
    body: z.ZodObject<{
        eventId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        eventId: string;
    }, {
        eventId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        eventId: string;
    };
}, {
    body: {
        eventId: string;
    };
}>;
export declare const submitPaymentSchema: z.ZodObject<{
    body: z.ZodObject<{
        eventId: z.ZodString;
        transactionId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        eventId: string;
        transactionId: string;
    }, {
        eventId: string;
        transactionId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        eventId: string;
        transactionId: string;
    };
}, {
    body: {
        eventId: string;
        transactionId: string;
    };
}>;
export declare const reviewParticipationSchema: z.ZodObject<{
    body: z.ZodObject<{
        participantId: z.ZodString;
        action: z.ZodEnum<["APPROVED", "REJECTED"]>;
    }, "strip", z.ZodTypeAny, {
        participantId: string;
        action: "APPROVED" | "REJECTED";
    }, {
        participantId: string;
        action: "APPROVED" | "REJECTED";
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        participantId: string;
        action: "APPROVED" | "REJECTED";
    };
}, {
    body: {
        participantId: string;
        action: "APPROVED" | "REJECTED";
    };
}>;
