import { z } from "zod";
export declare const sendConnectionSchema: z.ZodObject<{
    body: z.ZodObject<{
        receiverId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        receiverId: string;
    }, {
        receiverId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        receiverId: string;
    };
}, {
    body: {
        receiverId: string;
    };
}>;
export declare const respondConnectionSchema: z.ZodObject<{
    body: z.ZodObject<{
        connectionId: z.ZodString;
        action: z.ZodEnum<["ACCEPTED", "DECLINED"]>;
    }, "strip", z.ZodTypeAny, {
        action: "ACCEPTED" | "DECLINED";
        connectionId: string;
    }, {
        action: "ACCEPTED" | "DECLINED";
        connectionId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        action: "ACCEPTED" | "DECLINED";
        connectionId: string;
    };
}, {
    body: {
        action: "ACCEPTED" | "DECLINED";
        connectionId: string;
    };
}>;
