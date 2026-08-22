const authService = require("../services/authService");
const scheduler = require("../services/scheduleService");
const Subjects = require("../model/Subjects");
const Announcement = require('../model/Announce');
const allCourses = require('../model/Courses');
const allPrograms = require('../model/Programs');
const academic = require("../model/AcademicTerm");
const checker = require("../services/capacityCheckerService");
const Student = require("../model/Student");

const login = async (req, res) => {
   

    try {

        const result = await authService.loginUser(req.body, "student");

        res.json(result);

    } catch(error) {

        res.status(401).json({
            message: error.message
        });

    }
};

const loginAdmin = async (req, res) => {
   
    try {

        const result = await authService.loginUser(req.body, "admin");

        res.json(result);

    } catch(error) {

        res.status(401).json({
            message: error.message
        });

    }

};

const loginProf = async (req, res) => {
   

    try {

        const result = await authService.loginUser(req.body, "professor");
        res.json(result);

    } catch(error) {

        res.status(401).json({
            message: error.message
        });

    }

};

const me = (req, res) => {

    res.json({
        message: "Token is valid!",
        user: req.user
    });

};

const announcement = async (req, res) => {

    try {
        const role = req.user.role;

        const announcements =
            await Announcement.getAnnouncementsByRole(role);

        res.status(200).json({
            announcements
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Failed to fetch announcements'
        });
    }

};



const createAnnounce = async (req, res) => {
 
    try{
        const result = await authService.createAnnounce(req.body, req.user);
        res.status(201).json(result);
    }
    catch(error){
        res.status(400).json({
            message: error.message
        });
    }

};

const createSubject = async (req, res) => {
 
    try{
        const result = await authService.createSubject(req.body);

        res.status(201).json(result);
    }
    catch(error){
        res.status(400).json({
            message: error.message
        });
    }

};

// =====================================================
// GET SUBJECTS BY PROGRAM
// For Professor Subject Assignment
// =====================================================

const getCurriculumSubjects = async (req, res) => {

    try {

        const { programId, professorId } = req.query;


        if (!programId) {

            return res.status(400).json({
                success: false,
                message: "Program ID is required."
            });

        }

        const subjects =
            await Subjects.getCurriculumSubjects(programId, professorId);

        return res.status(200).json({

            success: true,

            subjects

        });

    } catch (error) {

        console.error(
            "Error getting subjects by program:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to get subjects by program."

        });

    }

};

const createSections = async (req, res) => {
 
    try{
        const result = await authService.createSections(req.body);

        res.status(201).json(result);
    }
    catch(error){
        res.status(400).json({
            message: error.message
        });
    }

};

const createProgram = async (req, res) => {
 
    try{
        const result = await authService.createProgram(req.body);

        res.status(201).json(result);
    }
    catch(error){
        res.status(400).json({
            message: error.message
        });
    }

};


const enroll = async (req, res) => {

    try {

        const result = await authService.apply(req.body);

        res.status(201).json(result);

    } catch (error) {

        res.status(400).json({
            message: error.message
        });

    }

};


const approveApplicant  = async (req, res) => {

    try {

        const result = await authService.approveApplicant (req);
        res.status(201).json(result);

    } catch (error) {

        res.status(400).json({
            message: error.message
        });

    }

};

const getPrograms = async(req, res) => {
    try{
        const programs = await allPrograms.getPrograms();

        res.status(200).json({
            programs
        });
    }
    catch(error){
        res.status(500).json({
            message: "Failed to fetch programs"
        });
    }
}

const generateSchedule = async (req, res) => {

    try {

        const result =
            await scheduler.generateSchedules(req);

        res.status(200).json({
            message: "Schedules generated successfully.",
            ...result
        });

    } catch (error) {

        console.error(
            "Generate schedules error:",
            error
        );

        res.status(500).json({
            message: error.message
        });
    }
};

const getProgramsWithSections = async(req, res) => {
    try{
        const { academicTermId } = req.query;

        const programs = await allPrograms.getProgramsWithSections(academicTermId);

        res.status(200).json({
            programs
        });
    }
    catch(error){
        res.status(500).json({
            message: "Failed to fetch programs"
        });
    }
}


const getCourses = async (req, res) => {
    try{
        const courses = await allCourses.getCourses();
        res.status(200).json({
            courses
        });
    }
    catch(error){
        res.status(500).json({
            message: "Failed to fetch courses"
        });
    }
}

const getSubjects = async (req, res) => {
    
    try{

        const userRole = req.user.role;
        const term = await academic.getActiveAcademicTerm();
        const semester = term.semester;

        
        let subjects = null;
        if(userRole === "admin"){
            subjects = await Subjects.getSubjectsAdmin();
        }
        else{
            subjects = await Subjects.getSubjects(semester)
        }
        res.status(200).json({
            subjects
        });
    }
    catch(error){
        res.status(500).json({
            message: "Failed to fetch subjects"
        });
    }
}

const getStudentSubjects = async (req, res) => {
    
    try{

        const {academicTermId, studentId} = req.query;
        const subjects = await Subjects.getSubjectsByStudent(studentId, academicTermId);
        
        res.status(200).json({
            subjects
        });
    }
    catch(error){
        res.status(500).json({
            message: "Failed to fetch subjects"
        });
    }
}

const getStudents = async (req, res) => {

    try {

        const page =
            parseInt(req.query.page) || 1;

        const limit =
            parseInt(req.query.limit) || 50;

        const search =
            req.query.search || "";


        const result =
            await authService.getStudents(
                page,
                limit,
                search
            );


        res.json(result);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: error.message
        });

    }
};

const getProfStudent = async (req, res) => {

    try {

        const {academicTermId, profId} = req.query;
        const students =
            await authService.getProfStudent(academicTermId, profId);

        res.json({
            students
        });

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }

};

const getApplicants = async (req, res) => {

    try {

        const applicants =
            await authService.getApplicants();

        res.json({
            applicants
        });

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }

};

const getProfessor = async(req, res) => {
    try {

        const professor =
            await authService.getProfessor();

        res.json({
            professor
        });

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }
}

const getSchedulesBySection = async (req, res) => {

    try {

        const { academicTermId, sectionId } = req.query;

        console.log(academicTermId, sectionId);
        
        if (!academicTermId) {

            return res.status(400).json({
                message: "academicTermId is required."
            });

        }

        if(!sectionId){
            return res.status(400).json({
                message: "Section ID is required."
            });
        }

        const schedules =
            await authService.getSchedulesBySection(
                academicTermId, sectionId
            );

        return res.status(200).json({
            message: "Schedules fetched successfully.",
            academicTermId,
            schedules
        });

    } catch (error) {

        console.error(
            "Get schedules error:",
            error
        );

        return res.status(500).json({
            message: error.message
        });
    }
};

const getSchedules = async (req, res) => {

    try {

        const { academicTermId } = req.query;

        if (!academicTermId) {

            return res.status(400).json({
                message: "academicTermId is required."
            });

        }

        const schedules =
            await authService.getSchedulesByTerm(
                academicTermId
            );

        return res.status(200).json({
            message: "Schedules fetched successfully.",
            academicTermId,
            schedules
        });

    } catch (error) {

        console.error(
            "Get schedules error:",
            error
        );

        return res.status(500).json({
            message: error.message
        });
    }
};

const getAcademicTerm = async(req, res) => {
    try {

        const term =
            await academic.getAcademicTerm();

        res.json({
            term
        });

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }
}

const getSectionById = async(req, res) => {
    try {

        const sectionId = req.params.id;
        const sections =
            await authService.getSectionById(sectionId);

        res.json({
            sections
        });

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }
}

const getScheduleSections = async (req, res) => {

    try {

        const { academicTermId } = req.query;

        if (!academicTermId) {

            return res.status(400).json({
                message: "academicTermId is required."
            });
        }

        const sections =
            await authService.getSectionsForSchedule(
                academicTermId
            );

        return res.status(200).json({
            academicTermId,
            sections
        });

    } catch (error) {

        console.error(
            "Get schedule sections error:",
            error
        );

        return res.status(500).json({
            message: error.message
        });
    }
};

const getSection = async(req, res) => {
    try {

        const sections =
            await authService.getSection(req);

        res.json({
            sections
        });

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }
}

const deleteSubject = async(req, res) => {
    try{
        const subjectId = req.params.id;
        const response = await authService.deleteSubject(subjectId);
        res.status(204).json({
            message: "deleted successfully"
        })
    }
    catch(err){
        return ({
            message: err.message
        })
    }
}

const deleteCurriculum = async(req, res) => {
    try{
        const subjectId = req.params.id;
        const response = await authService.deleteCurriculum(subjectId);
        res.status(204).json({
            message: "deleted successfully"
        })

    }
    catch(err){
        return ({
            message: err.message
        })
    }
}

const getEnrollmentCapacity = async (
    req,
    res
) => {

    try {

        const {
            programId,
            yearLevel,
            academicTermId
        } = req.query;

        if (
            !programId ||
            !yearLevel ||
            !academicTermId
        ) {

            return res.status(400).json({
                message:
                    "programId, yearLevel, and academicTermId are required."
            });
        }

        const capacity =
            await sectionService.getEnrollmentCapacity(
                Number(programId),
                Number(yearLevel),
                Number(academicTermId)
            );

        return res.status(200).json({
            capacity
        });

    } catch (error) {

        console.error(
            "Get enrollment capacity error:",
            error
        );

        return res.status(500).json({
            message: error.message
        });
    }
};

const getEnrollmentCapacities = async (
    req,
    res
) => {

    try {

        const {
            academicTermId
        } = req.query;

        if (!academicTermId) {
            return res.status(400).json({
                message:
                    "academicTermId is required."
            });
        }

        const capacities =
            await authService.getEnrollmentCapacities(
                academicTermId
            );

        return res.status(200).json({
            capacities
        });

    } catch (error) {

        console.error(
            "Get enrollment capacities error:",
            error
        );

        return res.status(500).json({
            message: error.message
        });
    }
};




// ============================================================
// CHECK UNIVERSITY CAPACITY
// ============================================================

const checkUniversityCapacity = async (
    req,
    res
) => {

    try {

        const {
            academicTermId
        } = req.query;


        // ==============================================
        // VALIDATION
        // ==============================================

        if (!academicTermId) {

            return res.status(400).json({

                success: false,

                message:
                    "Academic term ID is required."
            });
        }


        // ==============================================
        // SERVICE
        // ==============================================

        const result =
            await authService.checkUniversityCapacity(
                academicTermId
            );


        // ==============================================
        // RESPONSE
        // ==============================================

        return res.status(200).json({

            success: true,

            message:
                "University capacity successfully simulated.",

            data: result
        });

    }

    catch (error) {

        console.error(
            "Check University Capacity Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message ||
                "Failed to check university capacity."
        });
    }
};


const getTotalStudents = async (req, res) => {
    try {
        const totalStudents = await Student.getTotalStudents();

        res.status(200).json({
            totalStudents
        });

    } catch (error) {
        console.error("Error getting total students:", error);

        res.status(500).json({
            message: "Failed to get total students"
        });
    }
};


// =========================================================
// GET CURRICULUM
// =========================================================
const getCurriculum = async (req, res) => {

    try {

        const {
            programId,
            yearLevel,
            semester
        } = req.query;

        console.log("getCurriculum params:", {
            programId,
            yearLevel,
            semester
        });

        if (!programId) {

            return res.status(400).json({
                success: false,
                message: "Program ID is required"
            });

        }

        const curriculum =
            await authService.getCurriculum({

                programId,

                yearLevel:
                    yearLevel || null,

                semester:
                    semester || null

            });

        return res.status(200).json({

            success: true,

            curriculum

        });

    } catch (error) {

        console.error(
            "Get curriculum error:",
            error
        );

        return res.status(
            error.statusCode || 500
        ).json({

            success: false,

            message:
                error.message ||
                "Failed to get curriculum"

        });

    }

};
// =========================================================
// POST CURRICULUM
// =========================================================

const addCurriculum = async (req, res) => {

    try {

        const {
            programId,
            subjectIds,
            yearLevel,
            semester
        } = req.body;


        // =====================================================
        // VALIDATE
        // =====================================================

        if (!programId) {
            return res.status(400).json({
                success: false,
                message: "Program ID is required."
            });
        }

        if (
            !Array.isArray(subjectIds) ||
            subjectIds.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "At least one subject is required."
            });
        }

        if (!yearLevel) {
            return res.status(400).json({
                success: false,
                message: "Year level is required."
            });
        }

        if (!semester) {
            return res.status(400).json({
                success: false,
                message: "Semester is required."
            });
        }


        // =====================================================
        // SERVICE
        // =====================================================

        const result =
            await authService.addCurriculum({
                programId,
                subjectIds,
                yearLevel,
                semester
            });


        return res.status(201).json({

            success: true,

            message:
                `${result.insertedCount} subject(s) successfully added to curriculum.`,

            insertedCount:
                result.insertedCount,

            curriculumIds:
                result.curriculumIds

        });

    } catch (error) {

        console.error(
            "Add curriculum error:",
            error
        );

        return res.status(
            error.statusCode || 500
        ).json({

            success: false,

            message:
                error.message ||
                "Failed to add subjects to curriculum."

        });
    }
};


// =====================================================
// GET SUBJECTS FOR CURRICULUM BUILDER
//
// Returns all subjects that:
// - belong to a program
// - have an assigned professor
//
// Curriculum is NOT involved here.
// =====================================================
const getSubjectsForCurriculum = async (req, res) => {

    try {

        const { programId } = req.query;

        if (!programId) {
            return res.status(400).json({
                success: false,
                message: "programId is required"
            });
        }

        const subjects =
            await Subjects.getSubjectsForCurriculum(
                programId
            );

        return res.status(200).json({
            success: true,
            subjects
        });

    } catch (error) {

        console.error(
            "Get subjects for curriculum error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to get subjects for curriculum"
        });
    }
};

// =========================================================
// ASSIGN SUBJECTS TO PROFESSOR
// =========================================================

const assignSubjectsToProfessor = async (req, res) => {

    try {

        const { professorId, subjectIds } = req.body;

        const result =
            await authService.assignSubjectsToProfessor(
                professorId,
                subjectIds
            );

        return res.status(201).json({
            success: true,
            message: "Subjects assigned to professor successfully",
            data: result
        });

    } catch (error) {

        console.error(
            "Error assigning subjects to professor:",
            error
        );

        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};






module.exports = {
    login,
    me,
    getSubjectsForCurriculum,
    assignSubjectsToProfessor,
    getCurriculum,
    addCurriculum,
    deleteSubject,
    enroll,
    getEnrollmentCapacity,
    getEnrollmentCapacities,
    loginProf,
    announcement,
    createAnnounce,
    getCourses,
    loginAdmin,
    getApplicants,
    approveApplicant,
    getPrograms,
    getStudents,
    getSubjects,
    createSections,
    getProfessor,
    getSection,
    getTotalStudents,
    getSectionById,
    getAcademicTerm,
    createSubject,
    getCurriculumSubjects,
    createProgram,
    getProgramsWithSections,
    generateSchedule,
    getSchedules,
    getScheduleSections,
    checkUniversityCapacity,
    getSchedulesBySection,
    getStudentSubjects,
    getProfStudent,
    deleteCurriculum
};

