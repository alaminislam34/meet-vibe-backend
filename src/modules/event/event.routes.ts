import { Router } from "express";
import {
  saveStep1,
  saveStep2,
  saveStep3,
  saveStep4,
  publishEvent,
  getEvent,
  listEvents,
  myEvents,
  deleteEvent,
} from "./event.controller.js";
import { requireAuth } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
} from "./event.validator.js";
import { upload } from "../../utils/uploader.js";

const router = Router();

router.use(requireAuth as any);

// 5-Step wizard
router.post("/step1", upload.single("coverImage"), validate(step1Schema), saveStep1);
router.post("/step2", validate(step2Schema), saveStep2);
router.post("/step3", validate(step3Schema), saveStep3);
router.post("/step4", validate(step4Schema), saveStep4);
router.post("/publish/:id", publishEvent);

// CRUD
router.get("/", listEvents);
router.get("/mine", myEvents);
router.get("/:id", getEvent);
router.delete("/:id", deleteEvent);

export default router;
