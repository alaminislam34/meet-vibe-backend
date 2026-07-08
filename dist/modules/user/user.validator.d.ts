import { z } from "zod";
export declare const updateProfileSchema: z.ZodObject<{
    body: z.ZodObject<{
        fullName: z.ZodOptional<z.ZodString>;
        avatarUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        fullName?: string | undefined;
        avatarUrl?: string | undefined;
    }, {
        fullName?: string | undefined;
        avatarUrl?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        fullName?: string | undefined;
        avatarUrl?: string | undefined;
    };
}, {
    body: {
        fullName?: string | undefined;
        avatarUrl?: string | undefined;
    };
}>;
