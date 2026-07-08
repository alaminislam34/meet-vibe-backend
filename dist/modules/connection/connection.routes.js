import { Router } from "express";
import { sendConnectionRequest, respondToConnection, getConnections, getPendingRequests, removeConnection, } from "./connection.controller.js";
import { requireAuth } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { sendConnectionSchema, respondConnectionSchema, } from "./connection.validator.js";
const router = Router();
router.use(requireAuth);
router.post("/request", validate(sendConnectionSchema), sendConnectionRequest);
router.post("/respond", validate(respondConnectionSchema), respondToConnection);
router.get("/", getConnections);
router.get("/pending", getPendingRequests);
router.delete("/:id", removeConnection);
export default router;
//# sourceMappingURL=connection.routes.js.map