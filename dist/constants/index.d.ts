export declare const HTTP_STATUS: {
    readonly OK: 200;
    readonly CREATED: 201;
    readonly ACCEPTED: 202;
    readonly NO_CONTENT: 204;
    readonly BAD_REQUEST: 400;
    readonly UNAUTHORIZED: 401;
    readonly FORBIDDEN: 403;
    readonly NOT_FOUND: 404;
    readonly CONFLICT: 409;
    readonly UNPROCESSABLE_ENTITY: 422;
    readonly TOO_MANY_REQUESTS: 429;
    readonly INTERNAL_SERVER_ERROR: 500;
};
export declare const SUB_PLANS: {
    readonly FREE: "FREE";
    readonly PREMIUM: "PREMIUM";
};
export declare const SUB_STATUS: {
    readonly ACTIVE: "ACTIVE";
    readonly EXPIRED: "EXPIRED";
    readonly CANCELLED: "CANCELLED";
};
export declare const EVENT_STATUS: {
    readonly DRAFT: "DRAFT";
    readonly PUBLISHED: "PUBLISHED";
    readonly CANCELLED: "CANCELLED";
};
export declare const PARTICIPANT_STATUS: {
    readonly PENDING_PAYMENT: "PENDING_PAYMENT";
    readonly PENDING_APPROVAL: "PENDING_APPROVAL";
    readonly APPROVED: "APPROVED";
    readonly REJECTED: "REJECTED";
};
export declare const CONNECTION_STATUS: {
    readonly PENDING: "PENDING";
    readonly ACCEPTED: "ACCEPTED";
    readonly DECLINED: "DECLINED";
};
export declare const AUTH_PROVIDERS: {
    readonly LOCAL: "LOCAL";
    readonly GOOGLE: "GOOGLE";
    readonly APPLE: "APPLE";
};
