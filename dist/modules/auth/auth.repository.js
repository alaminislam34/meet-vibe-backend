import { prisma } from "../../config/db.js";
/**
 * AuthRepository — the single point of contact between the auth domain
 * and the database. Contains NO business logic; only data access operations.
 *
 * Keeping DB calls isolated here means:
 *   - The service layer is DB-agnostic and fully unit-testable with mocks.
 *   - Any ORM/DB migration only touches this file.
 */
export class AuthRepository {
    // ─── User Operations ──────────────────────────────────────────────────────
    /**
     * Finds a user by their unique email address.
     * Used for duplicate-check on registration and credential lookup on login.
     */
    async findUserByEmail(email) {
        return prisma.user.findUnique({ where: { email } });
    }
    /**
     * Finds a user by their unique ID.
     * Used primarily by the auth middleware to rehydrate the session user.
     */
    async findUserById(id) {
        return prisma.user.findUnique({ where: { id } });
    }
    /**
     * Finds a user by email and eagerly loads their LOCAL provider account.
     * The join is filtered to the LOCAL provider to avoid loading OAuth accounts
     * during password-based login — minimizes data transfer.
     */
    async findUserWithLocalAccount(email) {
        return prisma.user.findUnique({
            where: { email },
            include: {
                accounts: {
                    where: { providerId: "LOCAL" },
                },
            },
        });
    }
    /**
     * Creates a new User record. The paired Account record is created separately
     * via createAccount() to maintain single-responsibility per method.
     */
    async createUser(data) {
        return prisma.user.create({
            data: {
                email: data.email,
                name: data.name,
                isVerified: false,
            },
        });
    }
    /**
     * Marks a user's email as verified by setting `isVerified = true`.
     * Called after successful OTP validation to unlock full account access.
     */
    async markUserVerified(userId) {
        return prisma.user.update({
            where: { id: userId },
            data: { isVerified: true },
        });
    }
    /**
     * Updates MFA status and secrets.
     */
    async updateUserMfaStatus(userId, mfaEnabled, mfaSecret, mfaRecoveryCodes) {
        await prisma.user.update({
            where: { id: userId },
            data: {
                mfaEnabled,
                mfaSecret,
                mfaRecoveryCodes: mfaRecoveryCodes ?? [],
            },
        });
    }
    /**
     * Updates MFA recovery codes.
     */
    async updateUserRecoveryCodes(userId, mfaRecoveryCodes) {
        await prisma.user.update({
            where: { id: userId },
            data: { mfaRecoveryCodes },
        });
    }
    // ─── Account Operations ───────────────────────────────────────────────────
    /**
     * Creates a credentials/provider account record linked to a user.
     * For LOCAL provider: `password` is the Argon2 hash.
     * For OAuth providers: `password` is null; `accountId` is the provider's user ID.
     */
    async createAccount(data) {
        return prisma.account.create({
            data: {
                userId: data.userId,
                providerId: data.providerId,
                accountId: data.accountId,
                password: data.password ?? null,
            },
        });
    }
    /**
     * Looks up an OAuth provider account by provider name + provider-specific ID.
     * Includes the parent User so the service can read user data without
     * a second round-trip to the database.
     */
    async findAccountByProvider(providerId, accountId) {
        return prisma.account.findUnique({
            where: {
                providerId_accountId: { providerId, accountId },
            },
            include: { user: true },
        });
    }
    /**
     * Updates the hashed password for a user's LOCAL provider account.
     * Uses `updateMany` because there is no unique constraint on userId alone,
     * even though in practice each user has at most one LOCAL account.
     */
    async updateAccountPassword(userId, hashedPassword) {
        await prisma.account.updateMany({
            where: { userId, providerId: "LOCAL" },
            data: { password: hashedPassword },
        });
    }
    /**
     * Removes ALL account records for a user — called during hard account cleanup
     * or soft-delete anonymization so no credentials remain in the system.
     */
    async deleteAccountsByUserId(userId) {
        await prisma.account.deleteMany({ where: { userId } });
    }
    /**
     * Increments failed login attempts for brute-force protection.
     * If it passes the threshold, sets the lockedUntil timestamp.
     */
    async incrementFailedLoginAttempts(accountId, lockedUntil) {
        await prisma.account.update({
            where: { id: accountId },
            data: {
                failedLoginAttempts: { increment: 1 },
                lockedUntil,
            },
        });
    }
    /**
     * Resets failed login attempts and clears any active lock.
     * Called upon successful authentication.
     */
    async resetFailedLoginAttempts(accountId) {
        await prisma.account.update({
            where: { id: accountId },
            data: {
                failedLoginAttempts: 0,
                lockedUntil: null,
            },
        });
    }
    // ─── Session Operations ───────────────────────────────────────────────────
    /**
     * Persists a new session token to the database.
     * `token` is a cryptographically random hex string (not a JWT).
     * `expiresAt` is enforced at the application layer on every request.
     */
    async createSession(data) {
        return prisma.session.create({ data });
    }
    /**
     * Retrieves a session and its associated user in a single query.
     * This is the core of the `requireAuth` middleware — one DB round-trip
     * validates the token AND loads the user for `req.user`.
     */
    async findSessionWithUser(token) {
        return prisma.session.findUnique({
            where: { token },
            include: { user: true },
        });
    }
    /**
     * Deletes a single session by its token value.
     * Called on explicit logout to invalidate the current device's session.
     * Uses `deleteMany` to avoid throwing if the token was already cleaned up.
     */
    async deleteSessionByToken(token) {
        await prisma.session.deleteMany({ where: { token } });
    }
    /**
     * Marks a session as revoked (used during token rotation).
     * We keep the record to detect if this token is ever reused.
     */
    async revokeSession(id) {
        await prisma.session.update({
            where: { id },
            data: { isRevoked: true },
        });
    }
    /**
     * Deletes all sessions belonging to a specific token family.
     * Called when token reuse is detected to invalidate the entire chain.
     */
    async revokeTokenFamily(familyId) {
        await prisma.session.deleteMany({ where: { familyId } });
    }
    /**
     * Deletes ALL active sessions for a user.
     * Used during account deletion or a forced "logout everywhere" action.
     */
    async deleteSessionsByUserId(userId) {
        await prisma.session.deleteMany({ where: { userId } });
    }
    // ─── Verification (OTP) Operations ────────────────────────────────────────
    /**
     * Persists a new verification token (OTP) to the database.
     * Each OTP record has an `identifier` (email), `value` (the code),
     * `purpose` (scopes it to one flow), and `expiresAt` (10-minute window).
     */
    async createVerification(data) {
        return prisma.verification.create({ data });
    }
    /**
     * Looks up a verification record by the compound key (identifier + value).
     * The unique constraint on `@@unique([identifier, value])` ensures this
     * returns at most one result and prevents OTP collision across users.
     */
    async findVerification(input) {
        return prisma.verification.findUnique({
            where: {
                identifier_value: {
                    identifier: input.identifier,
                    value: input.value,
                },
            },
        });
    }
    /**
     * Deletes a specific verification record by its primary key.
     * Called immediately after a successful OTP validation so codes
     * are single-use — prevents replay attacks.
     */
    async deleteVerificationById(id) {
        await prisma.verification.delete({ where: { id } });
    }
    /**
     * Removes all existing OTP records for a given email + purpose combination.
     * Called before creating a new OTP (resend, forgot-password) to ensure
     * only one active code exists at any time per flow — prevents code hoarding.
     */
    async deleteVerificationsByIdentifier(identifier, purpose) {
        await prisma.verification.deleteMany({ where: { identifier, purpose } });
    }
}
//# sourceMappingURL=auth.repository.js.map