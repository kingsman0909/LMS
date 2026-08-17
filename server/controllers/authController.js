const authService = require("../services/authService");
const scheduler = require("../services/scheduleService");
const Subjects = require("../model/Subjects");
const Announcement = require('../model/Announce');
const allCourses = require('../model/Courses');
const allPrograms = require('../model/Programs');
const academic = require("../model/AcademicTerm");
const checker = require("../services/capacityCheckerService");

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

        const schedules =
            await scheduler.autoGenerateSchedule(
                1, // section ID
                1  // academic term ID
            );

        console.log(
            "GENERATED SCHEDULE:",
            JSON.stringify(schedules, null, 2)
        );

        console.log("controller:", schedules);
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


const getStudents = async (req, res) => {

    try {

        const students =
            await authService.getStudents();

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

const checkEnrollmentCapacity = async (
    req,
    res
) => {

    try {

        const {
            programId,
            yearLevel,
            academicTermId,
            pendingApplicants
        } = req.query;


        if (
            !programId ||
            !yearLevel ||
            !academicTermId ||
            pendingApplicants === undefined
        ) {

            return res.status(400).json({
                message:
                    "programId, yearLevel, academicTermId, and pendingApplicants are required."
            });
        }


        const result =
            await checker
                .checkEnrollmentFeasibility({

                    programId:
                        Number(programId),

                    yearLevel:
                        Number(yearLevel),

                    academicTermId:
                        Number(academicTermId),

                    pendingApplicants:
                        Number(pendingApplicants)
                });


        return res.status(200).json(
            result
        );

    } catch (error) {

        console.error(
            "Capacity checker error:",
            error
        );

        return res.status(500).json({
            message:
                error.message
        });
    }
};



module.exports = {
    login,
    me,
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
    getSectionById,
    getAcademicTerm,
    createSubject,
    createProgram,
    getProgramsWithSections,
    generateSchedule,
    getSchedules,
    getScheduleSections,
    checkEnrollmentCapacity
};

