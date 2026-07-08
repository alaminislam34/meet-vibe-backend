import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/errors.js";
import { HTTP_STATUS, VERIFICATION_STATUS } from "../../constants/index.js";
import { clearAuthCookie } from "../../utils/cookie.js";
// ─── Get My Profile ──────────────────────────────────────────────────────────
export const getProfile = async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: { subscription: true },
        });
        if (!user) {
            throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);
        }
        res.status(HTTP_STATUS.OK).json({
            status: "success",
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    image: user.image,
                    provider: user.provider,
                    isVerified: user.isVerified,
                    verificationStatus: user.verificationStatus,
                    is18Plus: user.is18Plus,
                    isHuman: user.isHuman,
                    subscription: user.subscription,
                    createdAt: user.createdAt,
                },
            },
        });
    }
    catch (error) {
        next(error);
    }
};
// ─── Update Profile ───────────────────────────────────────────────────────────
export const updateProfile = async (req, res, next) => {
    try {
        const { name, image } = req.body;
        const updated = await prisma.user.update({
            where: { id: req.user.id },
            data: {
                ...(name && { name }),
                ...(image && { image }),
            },
        });
        res.status(HTTP_STATUS.OK).json({
            status: "success",
            message: "Profile updated successfully.",
            data: {
                user: {
                    id: updated.id,
                    email: updated.email,
                    name: updated.name,
                    image: updated.image,
                },
            },
        });
    }
    catch (error) {
        next(error);
    }
};
// ─── Submit Identity Verification ────────────────────────────────────────────
// Accepts govId + selfie uploads. In production, call AWS Rekognition / Stripe Identity.
export const verifyIdentity = async (req, res, next) => {
    try {
        const files = req.files;
        const govId = files?.govId?.[0];
        const selfie = files?.selfie?.[0];
        if (!govId || !selfie) {
            throw new AppError("Both govId and selfie files are required.", HTTP_STATUS.BAD_REQUEST);
        }
        // ── PRODUCTION INTEGRATION POINT ─────────────────────────────────────────
        // 1. Upload files to AWS S3
        // 2. Call AWS Rekognition DetectFaces to confirm selfie contains 1 human face → isHuman
        // 3. Call AWS Rekognition CompareFaces to confirm selfie matches gov ID photo
        // 4. Parse/OCR gov ID date-of-birth → calculate age → is18Plus
        // OR use Stripe Identity for a managed KYC flow
        // ──────────────────────────────────────────────────────────────────────────
        // Simulated successful verification (replace with real logic)
        const govIdUrl = `https://s3.amazonaws.com/meet-vibe-uploads/govid/${req.user.id}.jpg`;
        const faceImageUrl = `https://s3.amazonaws.com/meet-vibe-uploads/selfie/${req.user.id}.jpg`;
        const updated = await prisma.user.update({
            where: { id: req.user.id },
            data: {
                govIdUrl,
                faceImageUrl,
                is18Plus: true, // Set by real AI check in production
                isHuman: true, // Set by face-mesh AI check in production
                verificationStatus: VERIFICATION_STATUS.VERIFIED,
            },
        });
        res.status(HTTP_STATUS.OK).json({
            status: "success",
            message: "Identity verified successfully.",
            data: {
                verificationStatus: updated.verificationStatus,
                is18Plus: updated.is18Plus,
                isHuman: updated.isHuman,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
// ─── Delete Account ───────────────────────────────────────────────────────────
export const deleteAccount = async (req, res, next) => {
    try {
        const { reason } = req.body;
        // Soft delete: mark as deleted rather than hard delete
        await prisma.user.update({
            where: { id: req.user.id },
            data: {
                deletedAt: new Date(),
                deleteReason: reason ?? null,
                // Anonymize PII
                email: `deleted_${req.user.id}@removed.local`,
                name: "Deleted User",
                image: null,
                password: null,
                otpCode: null,
                otpExpiry: null,
            },
        });
        clearAuthCookie(res);
        res.status(HTTP_STATUS.OK).json({
            status: "success",
            message: "Your account has been deleted.",
        });
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=user.controller.js.map