
const express = require("express");

const router = express.Router();

const {loginProf, login, me, enroll,//this enroll is just a mistake it should be apply(Student applications)
     getCourses, loginAdmin, getApplicants,
     approveApplicant , getPrograms, getStudents,
     getSubjects, createSections, getProfessor,
     getSection, getSectionById, getAcademicTerm,
     createSubject, createProgram, deleteSubject,
     getProgramsWithSections, generateSchedule,
     getSchedules, getScheduleSections, getEnrollmentCapacity,
     getEnrollmentCapacities, checkEnrollmentCapacity,
     announcement, createAnnounce } = require("../controllers/authController");
const verifyToken = require("../middleware/authMiddleware");
const checkRole = require("../middleware/CheckRole");
const { verify } = require("jsonwebtoken");


router.post("/login", login);
router.post("/login/prof", loginProf);
router.post("/enroll", enroll);
router.post("/admin/login", loginAdmin);
router.post("/admin/applicants/:id/approvedApplicant", verifyToken, checkRole("admin"), approveApplicant );
router.post("/createAnnouncement", verifyToken, checkRole("admin", "professor"), createAnnounce);
router.post("/admin/createSections", verifyToken,  checkRole("admin"), createSections);
router.post("/admin/createSubject", verifyToken,  checkRole("admin"), createSubject); 
router.post("/admin/createProgram", verifyToken, checkRole("admin"), createProgram);
router.post("/admin/schedule/generate", verifyToken, checkRole("admin"), generateSchedule);

router.delete("/admin/:id/deleteSubject", verifyToken, checkRole("admin"), deleteSubject);

router.get("/admin/checkEnrollmentCapacity", verifyToken, checkRole("admin"), checkEnrollmentCapacity);
router.get("/admin/getEnrollmentCapacities", verifyToken, checkRole("admin"), getEnrollmentCapacities);
router.get("/admin/getEnrollmentCapacity", verifyToken, checkRole("admin"), getEnrollmentCapacity);
router.get("/admin/getScheduleSections", verifyToken, checkRole("admin"), getScheduleSections);
router.get("/admin/getSchedules", verifyToken, checkRole("admin"), getSchedules);
router.get("/getAcademicTerm", verifyToken, getAcademicTerm)
router.get("/admin/getSections", verifyToken, getSection);
router.get("/admin/getSectionById/:id", verifyToken, getSectionById)
router.get('/getSubjects', verifyToken, getSubjects);
router.get("/applicants", verifyToken,  checkRole("admin"), getApplicants)
router.get("/announcements", verifyToken, announcement);
router.get("/admin/getStudents", verifyToken,  checkRole("admin"), getStudents);
router.get("/admin/getProfessor", verifyToken,  checkRole("admin"), getProfessor);
router.get("/getPrograms", getPrograms);
router.get("/admin/getProgramsWithSections", verifyToken, checkRole("admin"), getProgramsWithSections);
router.get("/me", verifyToken, me);

module.exports = router;

