const User = require("../model/User");
const Prof = require("../model/Prof");
const Announce = require("../model/Announce");
const Student = require("../model/Student");
const Enrollment = require("../model/Enrolment");
const StudentApplication = require("../model/Application");
const Course = require("../model/Courses");
const Programs = require("../model/Programs");
const Section = require("../model/Sections");
const Academic = require("../model/AcademicTerm");
const Subject = require("../model/Subjects");
const scheduleModel = require("../model/Schedule");
const capacityChecker = require("../services/capacityCheckerService");
const Curriculum = require("../model/Curriculum");
const assignment = require("../model/Assignment");
const db = require("../config/db");
const jwt = require("jsonwebtoken");
const { getIO } = require("../realtimeConn/socket");


// =========================================================
// LOGIN
// =========================================================

const loginUser = async ({ username, password }, allowedRole) => {

    const result =
        await User.findByUsername(username);

    if (!result) {
        throw new Error("User not found");
    }

    const { user, profile } = result;

    if (user.role !== allowedRole) {
        throw new Error("User role not allowed");
    }

    // Development password check
    if (password !== user.password) {
        console.log("password error");

        throw new Error(
            "Wrong password"
        );
    }

    console.log("creating token");

    const {
        password: pass,
        ...userData
    } = user;

    const token =
        jwt.sign(
            {
                user: {
                    ...userData,
                    profile
                }
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d"
            }
        );

    return {

        token,

        user: {
            ...userData,
            profile
        }

    };
};


// =========================================================
// CREATE ANNOUNCEMENT
// =========================================================

const createAnnounce = async (data, user) => {

    const {
        title,
        content
    } = data;

    const {
        id,
        role
    } = user;

    await Announce.createAnnouncement({

        title,
        content,

        created_by:
            id,

        created_role:
            role,

        target_role:
            "student"

    });

    return {
        message:
            "announcement added!"
    };
};


// =========================================================
// CREATE SECTION
// =========================================================

const createSections = async (data) => {

    const academicTerm =
        await Academic.getActiveAcademicTerm();

    try {

        await Section.createSection({

            ...data,

            academic_term_id:
                academicTerm.id

        });

        return {
            message:
                "Sections successfully added!"
        };

    } catch (err) {

        throw new Error(
            err.message
        );
    }
};


// =========================================================
// CREATE PROGRAM
// =========================================================

const createProgram = async (data) => {

    try {

        await Programs.createProgram(
            data
        );

        return {
            message:
                "Sections successfully added!"
        };

    } catch (err) {

        throw new Error(
            err.message
        );
    }
};


// =========================================================
// DELETE SUBJECT
// =========================================================

const deleteSubject = async (id) => {

    try {

        await Subject.deleteSubject(
            id
        );

        return {
            message:
                "succesfully deleted subject"
        };

    } catch (err) {

        return {
            message:
                "Error in deleting subject in controller"
        };
    }
};


// =========================================================
// DELETE CURRICULUM
// =========================================================

const deleteCurriculum = async (id) => {

    try {

        await Curriculum.deleteCurriculum(
            id
        );

        return {
            message:
                "succesfully deleted Curriculum Subject"
        };

    } catch (err) {

        return {
            message:
                "Error in deleting subject in controller"
        };
    }
};


// =========================================================
// CREATE SUBJECT
// =========================================================

const createSubject = async (data) => {

    try {

        for (
            let i = 0;
            i < data.programs.length;
            i++
        ) {

            const programId =
                data.programs[i];

            const subject_code =
                await Subject.findByCodeAndProgram(
                    data.subject_code,
                    programId
                );

            if (subject_code) {

                throw new Error(
                    "Subject already exist"
                );
            }

            await Subject.createSubject(
                data,
                programId
            );
        }

        return {
            message:
                "Subject successfully added!"
        };

    } catch (err) {

        throw new Error(
            err.message
        );
    }
};


// =========================================================
// APPLY / STUDENT APPLICATION
// =========================================================

const apply = async (data) => {

    const {
        firstname,
        middlename,
        lastname,
        email,
        username,
        password,
        program_id,
        year_level,
        phone,
        gender,
        birthdate,
        address
    } = data;


    // =====================================================
    // CHECK USERNAME
    // =====================================================

    const existingUser =
        await User.findByUsername(
            username
        );

    if (existingUser) {

        throw new Error(
            "Username already exists."
        );
    }


    // =====================================================
    // CHECK EMAIL
    // =====================================================

    const existingEmail =
        await User.findByEmail(
            email
        );

    if (existingEmail) {

        throw new Error(
            "Email already exists."
        );
    }


    // =====================================================
    // CHECK APPLICATION USERNAME
    // =====================================================

    const existingApplication =
        await StudentApplication.findByUsername(
            username
        );

    if (existingApplication) {

        throw new Error(
            "An application with this username already exists."
        );
    }


    // =====================================================
    // CHECK APPLICATION EMAIL
    // =====================================================

    const existingApplicationEmail =
        await StudentApplication.findByEmail(
            email
        );

    if (existingApplicationEmail) {

        throw new Error(
            "An application with this email already exists."
        );
    }


    // =====================================================
    // CHECK PROGRAM
    // =====================================================

    console.log(
        program_id,
        "service"
    );

    const program =
        await Programs.findById(
            program_id
        );

    if (!program) {

        throw new Error(
            "Selected course does not exist."
        );
    }


    // =====================================================
    // CREATE APPLICATION
    // =====================================================

    await StudentApplication.createApplication({

        firstname,
        middlename,
        lastname,

        email,
        username,
        password,

        program_id,
        year_level,

        phone,
        gender,
        birthdate,
        address

    });


    // =====================================================
    // REALTIME NOTIFICATION
    // =====================================================

    const io =
        getIO();

    io.to("admins").emit(
        "new_application",
        {
            message:
                "A new student application has been submitted.",

            firstname,
            lastname,
            username
        }
    );


    return {

        message:
            "Application submitted successfully. Please wait for admin approval."

    };
};


// =========================================================
// GENERATE STUDENT ID
// =========================================================

const generateStudentId = (userId) => {

    return `2026-${String(userId).padStart(4, "0")}`;
};


// =========================================================
// GENERATE SECTION NAME
// =========================================================

const generateSectionName = (number) => {

    let name = "";

    while (number > 0) {

        number--;

        name =
            String.fromCharCode(
                65 + (number % 26)
            ) + name;

        number =
            Math.floor(
                number / 26
            );
    }

    return name;
};


// =========================================================
// GET SECTIONS FOR SCHEDULE
// =========================================================

const getSectionsForSchedule = async (
    academicTermId
) => {

    if (!academicTermId) {

        throw new Error(
            "Academic term ID is required."
        );
    }

    return await Section.getSectionsForSchedule(
        academicTermId
    );
};


// =========================================================
// GET SCHEDULES BY TERM
// =========================================================

const getSchedulesByTerm = async (
    academicTermId
) => {

    if (!academicTermId) {

        throw new Error(
            "Academic term ID is required."
        );
    }

    return await scheduleModel.getSchedulesByTerm(
        academicTermId
    );
};


// =========================================================
// GET SCHEDULES BY SECTION
// =========================================================

const getSchedulesBySection = async (
    academicTermId,
    sectionId
) => {

    if (!academicTermId) {

        throw new Error(
            "Academic term ID is required."
        );
    }

    if (!sectionId) {

        throw new Error(
            "Section ID is required."
        );
    }

    return await scheduleModel.getSchedulesBySection(
        academicTermId,
        sectionId
    );
};


// =========================================================
// ASSIGN SECTION
// =========================================================

async function assignSection(
    admin_id,
    student_id,
    course_id,
    year_level,
    academicTermId
) {

    console.log(
        "Start assigning section:",
        {
            course_id,
            year_level,
            academicTermId
        }
    );


    // =====================================================
    // FIND AVAILABLE SECTION
    // =====================================================

    let section =
        await Section.getAvailableSections(
            course_id,
            year_level,
            academicTermId
        );


    console.log(
        "SECTION RETURNED:",
        section
    );


    // =====================================================
    // CREATE NEW SECTION IF NEEDED
    // =====================================================

    if (!section) {

        console.log(
            "NO AVAILABLE SECTION - CREATING NEW SECTION"
        );

        const sections =
            await Section.getByProgramYearAndTerm(
                course_id,
                year_level,
                academicTermId
            );


        console.log(
            "EXISTING SECTIONS:",
            sections
        );


        const usedLetters =
            new Set(
                sections.map(
                    section =>
                        String(
                            section.section_name
                        ).toUpperCase()
                )
            );


        let sectionNumber = 1;

        let sectionLetter =
            generateSectionName(
                sectionNumber
            );


        while (
            usedLetters.has(
                sectionLetter
            )
        ) {

            sectionNumber++;

            sectionLetter =
                generateSectionName(
                    sectionNumber
                );
        }


        console.log(
            "NEW SECTION:",
            {
                course_id,
                year_level,
                sectionLetter,
                academicTermId
            }
        );


        const sectionId =
            await Section.create(
                course_id,
                year_level,
                sectionLetter,
                academicTermId,
                50
            );


        console.log(
            "CREATED SECTION ID:",
            sectionId
        );


        section = {

            id:
                sectionId,

            section_name:
                sectionLetter,

            year_level

        };
    }


    // =====================================================
    // ASSIGN STUDENT TO SECTION
    // =====================================================

    await db.query(
        `
        INSERT INTO student_sections
        (
            student_id,
            section_id,
            academic_term_id
        )
        VALUES (?, ?, ?)
        `,
        [
            student_id,
            section.id,
            academicTermId
        ]
    );


    // =====================================================
    // UPDATE STUDENT SECTION
    // =====================================================

    await db.query(
        `
        UPDATE student
        SET section_id = ?
        WHERE id = ?
        `,
        [
            section.id,
            student_id
        ]
    );


    console.log(
        "Student assigned to section:",
        section
    );


    // =====================================================
    // CREATE ENROLLMENT
    // =====================================================

    await Enrollment.createEnrollment({

        student_id:
            student_id,

        section_id:
            section.id,

        status:
            "approved",

        approved_by:
            admin_id

    });


    return section;
}


// =========================================================
// APPROVE SINGLE APPLICANT
// =========================================================

const approveApplicant = async (req) => {

    const applicantId =
        req.params.id;

    const term =
        await Academic.getAcademicTerm();

    const applicantData =
        await StudentApplication.findById(
            applicantId
        );

    if (!applicantData) {

        throw new Error(
            "Applicant not found."
        );
    }


    const program =
        await Programs.findById(
            applicantData.course_id
        );

    if (!program) {

        throw new Error(
            "Program not found."
        );
    }


    // =====================================================
    // CREATE USER
    // =====================================================

    const userId =
        await User.createUser({

            ...applicantData,

            role:
                "student",

            status:
                "active"

        });


    const course_id =
        applicantData.course_id;


    console.log(
        "done create user"
    );


    // =====================================================
    // CREATE STUDENT
    // =====================================================

    const student =
        await Student.createStudent({

            ...applicantData,

            course_name:
                program.program_code,

            user_id:
                userId.insertId,

            student_id:
                generateStudentId(
                    userId.insertId
                )

        });


    console.log(
        "done create student"
    );


    // =====================================================
    // ASSIGN SECTION
    // =====================================================

    await assignSection(

        req.user.id,

        student.insertId,

        course_id,

        applicantData.year_level,

        term.id

    );


    console.log(
        "done create section."
    );


    // =====================================================
    // UPDATE APPLICATION
    // =====================================================

    await StudentApplication.updateStatus(

        applicantId,

        "approved",

        req.user.id

    );


    console.log(
        "done update status"
    );


    return {

        message:
            "Application approved! You can now login to your account."

    };
};


// =========================================================
// BULK APPLICANT APPROVAL
// =========================================================

let bulkApprovalRunning = false;
let bulkApprovalAdminId = null;

const BATCH_SIZE = 500;
const PROGRESS_INTERVAL = 5;


const approveAllApplicants = async (adminId) => {

    // =====================================================
    // GLOBAL LOCK
    // =====================================================

    if (bulkApprovalRunning) {

        const error =
            new Error(
                "Bulk approval is already in progress."
            );

        error.statusCode =
            409;

        throw error;
    }


    bulkApprovalRunning =
        true;

    bulkApprovalAdminId =
        adminId;


    const io =
        getIO();


    try {

        // =================================================
        // GET ACTIVE ACADEMIC TERM
        // =================================================

        const term =
            await Academic.getAcademicTerm();

        if (!term) {

            throw new Error(
                "No active academic term found."
            );
        }


        // =================================================
        // GLOBAL STATUS
        // =================================================

        io.to("admins").emit(
            "bulk_approval_status",
            {
                isApproving:
                    true,

                adminId
            }
        );


        let lastId = 0;

        let totalProcessed = 0;

        let totalApproved = 0;

        let totalFailed = 0;

        let totalBatches = 0;


        // =================================================
        // TOTAL PENDING
        // =================================================

        const totalPending =
            await StudentApplication
                .countPendingApplications();


        // =================================================
        // OWNER START EVENT
        // =================================================

        io.to(`admin:${adminId}`).emit(
            "bulk_approval_progress",
            {

                status:
                    "started",

                isApproving:
                    true,

                processed:
                    0,

                total:
                    totalPending,

                approved:
                    0,

                failed:
                    0,

                percentage:
                    0

            }
        );


        // =================================================
        // PROGRAM CACHE
        // =================================================

        const programCache =
            new Map();


        // =================================================
        // PROCESS BATCHES
        // =================================================

        while (true) {

            const applicants =
                await StudentApplication
                    .getPendingApplicationsBatch(

                        BATCH_SIZE,

                        lastId

                    );


            if (
                applicants.length === 0
            ) {
                break;
            }


            totalBatches++;


            const successfulIds =
                [];


            // =================================================
            // PROCESS APPLICANTS
            // =================================================

            for (
                const applicantData
                of applicants
            ) {

                totalProcessed++;


                try {

                    // =========================================
                    // GET PROGRAM FROM CACHE
                    // =========================================

                    let program =
                        programCache.get(
                            applicantData.course_id
                        );


                    if (!program) {

                        program =
                            await Programs.findById(
                                applicantData.course_id
                            );

                        if (!program) {

                            throw new Error(
                                `Program ${applicantData.course_id} not found.`
                            );
                        }

                        programCache.set(
                            applicantData.course_id,
                            program
                        );
                    }


                    // =========================================
                    // CREATE USER
                    // =========================================

                    const userResult =
                        await User.createUser({

                            ...applicantData,

                            role:
                                "student",

                            status:
                                "active"

                        });


                    if (
                        !userResult?.insertId
                    ) {

                        throw new Error(
                            "Failed to create user."
                        );
                    }


                    // =========================================
                    // CREATE STUDENT
                    // =========================================

                    const studentResult =
                        await Student.createStudent({

                            ...applicantData,

                            course_name:
                                program.program_code,

                            user_id:
                                userResult.insertId,

                            student_id:
                                generateStudentId(
                                    userResult.insertId
                                )

                        });


                    if (
                        !studentResult?.insertId
                    ) {

                        throw new Error(
                            "Failed to create student."
                        );
                    }


                    // =========================================
                    // ASSIGN SECTION
                    // =========================================

                    await assignSection(

                        adminId,

                        studentResult.insertId,

                        applicantData.course_id,

                        applicantData.year_level,

                        term.id

                    );


                    // =========================================
                    // MARK FOR APPROVAL
                    // =========================================

                    successfulIds.push(
                        applicantData.id
                    );


                    totalApproved++;


                } catch (error) {

                    totalFailed++;


                    console.error(

                        `Applicant ${applicantData.id} failed:`,

                        error.message

                    );
                }


                // =================================================
                // PROGRESS EVERY 5 APPLICANTS
                // =================================================

                if (

                    totalProcessed %
                        PROGRESS_INTERVAL ===
                        0

                    ||

                    totalProcessed ===
                        totalPending

                ) {

                    const percentage =
                        totalPending > 0

                            ? Math.round(

                                (
                                    totalProcessed /
                                    totalPending
                                ) * 100

                            )

                            : 100;


                    io.to(`admin:${adminId}`).emit(

                        "bulk_approval_progress",

                        {

                            status:
                                "processing",

                            isApproving:
                                true,

                            processed:
                                totalProcessed,

                            total:
                                totalPending,

                            approved:
                                totalApproved,

                            failed:
                                totalFailed,

                            percentage

                        }

                    );
                }
            }


            // =================================================
            // APPROVE SUCCESSFUL APPLICATIONS
            // =================================================

            if (
                successfulIds.length > 0
            ) {

                await StudentApplication
                    .approveBatch(

                        successfulIds,

                        adminId

                    );
            }


            // =================================================
            // UPDATE KEYSET PAGINATION
            // =================================================

            lastId =
                applicants[
                    applicants.length - 1
                ].id;
        }


        // =================================================
        // OWNER COMPLETED EVENT
        // =================================================

        io.to(`admin:${adminId}`).emit(

            "bulk_approval_progress",

            {

                status:
                    "completed",

                isApproving:
                    false,

                processed:
                    totalProcessed,

                total:
                    totalPending,

                approved:
                    totalApproved,

                failed:
                    totalFailed,

                percentage:
                    100

            }

        );


        return {

            processed:
                totalProcessed,

            approved:
                totalApproved,

            failed:
                totalFailed,

            batches:
                totalBatches

        };


    } finally {

        // =================================================
        // RELEASE GLOBAL LOCK
        // =================================================

        bulkApprovalRunning =
            false;

        bulkApprovalAdminId =
            null;


        // =================================================
        // TELL ALL ADMINS
        // =================================================

        io.to("admins").emit(

            "bulk_approval_status",

            {

                isApproving:
                    false,

                adminId:
                    null

            }

        );


        console.log(
            "🔓 Bulk approval lock released."
        );
    }
};


// =========================================================
// GET BULK APPROVAL STATUS
// =========================================================

const getBulkApprovalStatus = () => {

    return {

        isApproving:
            bulkApprovalRunning,

        adminId:
            bulkApprovalAdminId

    };
};


// =========================================================
// REMOVE SENSITIVE FIELDS
// =========================================================

const removeSensitiveFields = (user) => {

    const {
        password,
        ...safeUser
    } = user;

    return safeUser;
};


// =========================================================
// GET APPLICANTS
// =========================================================

const getApplicants = async (
    limit = 1000,
    lastId = 0
) => {

    const applicants =
        await StudentApplication
            .getPendingApplicationsBatch(
                limit,
                lastId
            );

    return applicants.map(
        removeSensitiveFields
    );
};


// =========================================================
// GET STUDENTS
// =========================================================

const getStudents = async (
    page,
    limit,
    search
) => {

    console.log(
        "service reach",
        "page:",
        page,
        "limit:",
        limit,
        "search:",
        search
    );


    const result =
        await Student.getAllStudent(
            page,
            limit,
            search
        );


    return {

        students:
            result.students.map(
                removeSensitiveFields
            ),

        total:
            result.total,

        page:
            result.page,

        limit:
            result.limit,

        hasMore:
            result.hasMore

    };
};


// =========================================================
// GET PROFESSOR STUDENTS
// =========================================================

const getProfStudent = async (
    termId,
    profId
) => {

    const students =
        await Student.getProfStudents(
            termId,
            profId
        );

    return students.map(
        removeSensitiveFields
    );
};


// =========================================================
// GET PROFESSORS
// =========================================================

const getProfessor = async () => {

    console.log(
        "service reach professor"
    );

    const professor =
        await Prof.getProfessor();

    console.log(
        professor,
        "prof"
    );

    return professor.map(
        removeSensitiveFields
    );
};


// =========================================================
// GET SECTIONS
// =========================================================

const getSection = async () => {

    console.log(
        "service reach"
    );

    const sections =
        await Section.getAllSections();

    console.log(
        sections
    );

    return sections;
};


// =========================================================
// GET SECTION BY ID
// =========================================================

const getSectionById = async (
    id
) => {

    console.log(
        "service reach"
    );

    const sections =
        await Section.getSectionById(
            id
        );

    console.log(
        sections
    );

    return sections;
};


// =========================================================
// CHECK UNIVERSITY CAPACITY
// =========================================================

const checkUniversityCapacity = async (
    academicTermId
) => {

    const id =
        Number(academicTermId);


    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {

        throw new Error(
            "Academic term ID is required and must be a valid positive integer."
        );
    }


    return await capacityChecker
        .checkEnrollmentCapacity(
            id
        );
};


// =========================================================
// GET CURRICULUM
// =========================================================

const getCurriculum = async ({
    programId,
    yearLevel = null,
    semester = null
}) => {

    if (!programId) {

        throw new Error(
            "Program ID is required"
        );
    }


    return await Curriculum.getCurriculum({

        programId,

        yearLevel,

        semester

    });
};


// =========================================================
// ADD SUBJECT TO CURRICULUM
// =========================================================

const addCurriculum = async ({
    programId,
    subjectIds,
    yearLevel,
    semester
}) => {

    // =====================================================
    // VALIDATION
    // =====================================================

    if (!programId) {

        throw new Error(
            "Program ID is required"
        );
    }


    if (
        !Array.isArray(subjectIds) ||
        subjectIds.length === 0
    ) {

        throw new Error(
            "At least one subject is required"
        );
    }


    if (!yearLevel) {

        throw new Error(
            "Year level is required"
        );
    }


    if (!semester) {

        throw new Error(
            "Semester is required"
        );
    }


    // =====================================================
    // VALID YEAR LEVEL
    // =====================================================

    const validYearLevels = [

        "1st Year",
        "2nd Year",
        "3rd Year",
        "4th Year"

    ];


    const yearLevelMap = {

        1:
            "1st Year",

        2:
            "2nd Year",

        3:
            "3rd Year",

        4:
            "4th Year"

    };


    const normalizedYear =
        yearLevelMap[
            Number(yearLevel)
        ] ||
        yearLevel;


    if (
        !validYearLevels.includes(
            normalizedYear
        )
    ) {

        throw new Error(
            "Invalid year level"
        );
    }


    // =====================================================
    // VALID SEMESTER
    // =====================================================

    const validSemesters = [

        "1st Semester",
        "2nd Semester",
        "Summer"

    ];


    const semesterMap = {

        1:
            "1st Semester",

        2:
            "2nd Semester",

        3:
            "Summer"

    };


    const normalizedSemester =
        semesterMap[
            Number(semester)
        ] ||
        semester;


    if (
        !validSemesters.includes(
            normalizedSemester
        )
    ) {

        throw new Error(
            "Invalid semester"
        );
    }


    // =====================================================
    // REMOVE DUPLICATES
    // =====================================================

    const uniqueSubjectIds = [

        ...new Set(

            subjectIds

                .map(
                    id =>
                        Number(id)
                )

                .filter(
                    id =>
                        id > 0
                )

        )

    ];


    if (
        uniqueSubjectIds.length === 0
    ) {

        throw new Error(
            "No valid subject IDs provided"
        );
    }


    // =====================================================
    // INSERT
    // =====================================================

    const curriculumIds = [];


    try {

        for (
            const subjectId
            of uniqueSubjectIds
        ) {

            const result =
                await Curriculum.addToCurriculum({

                    programId,

                    subjectId,

                    yearLevel:
                        normalizedYear,

                    semester:
                        normalizedSemester

                });


            curriculumIds.push(
                result.insertId
            );
        }


        return {

            insertedCount:
                curriculumIds.length,

            curriculumIds

        };

    } catch (error) {

        if (
            error.code ===
            "ER_DUP_ENTRY"
        ) {

            const duplicateError =
                new Error(

                    "One or more selected subjects are already added to this curriculum."

                );


            duplicateError.statusCode =
                409;


            throw duplicateError;
        }


        throw error;
    }
};


// =========================================================
// ASSIGN SUBJECTS TO PROFESSOR
// =========================================================

const assignSubjectsToProfessor = async (
    professorId,
    subjectIds
) => {

    if (!professorId) {

        throw new Error(
            "Professor ID is required"
        );
    }


    if (
        !Array.isArray(subjectIds) ||
        subjectIds.length === 0
    ) {

        throw new Error(
            "At least one subject must be selected"
        );
    }


    return await Prof.assignSubjectsToProfessor(
        professorId,
        subjectIds
    );
};


// =========================================================
// CREATE ASSIGNMENT
// =========================================================

const createAssignmentService = async (
    data
) => {

    const {

        professor_id,
        subject_id,
        section_id,
        title,
        description,
        file_path,
        points,
        due_date

    } = data;


    if (!professor_id) {

        throw new Error(
            "Professor ID is required."
        );
    }


    if (!subject_id) {

        throw new Error(
            "Subject ID is required."
        );
    }


    if (!section_id) {

        throw new Error(
            "Section ID is required."
        );
    }


    if (
        !title ||
        !title.trim()
    ) {

        throw new Error(
            "Assignment title is required."
        );
    }


    if (!due_date) {

        throw new Error(
            "Due date is required."
        );
    }


    const assignmentPoints =
        Number(points);


    if (
        Number.isNaN(
            assignmentPoints
        ) ||
        assignmentPoints < 0
    ) {

        throw new Error(
            "Points must be a valid non-negative number."
        );
    }


    return await assignment.createAssignment({

        professor_id,

        subject_id,

        section_id,

        title:
            title.trim(),

        description:
            description?.trim() ||
            null,

        file_path:
            file_path ||
            null,

        points:
            assignmentPoints,

        due_date,

        status:
            "open"

    });
};


// =========================================================
// UPDATE ASSIGNMENT
// =========================================================

const updateAssignment = async (
    assignmentId,
    professorId,
    data
) => {

    console.log(
        "assignment service"
    );


    const assign =
        await assignment.getAssignmentById(
            assignmentId
        );


    if (!assign) {

        throw new Error(
            "Assignment not found."
        );
    }


    if (
        Number(assign.professor_id) !==
        Number(professorId)
    ) {

        throw new Error(
            "You are not authorized to update this assignment."
        );
    }


    if (!data.subject_id) {

        throw new Error(
            "Subject is required."
        );
    }


    if (!data.section_id) {

        throw new Error(
            "Section is required."
        );
    }


    if (
        !data.title ||
        !data.title.trim()
    ) {

        throw new Error(
            "Assignment title is required."
        );
    }


    if (
        !data.points ||
        Number(data.points) <= 0
    ) {

        throw new Error(
            "Points must be greater than zero."
        );
    }


    if (!data.due_date) {

        throw new Error(
            "Due date is required."
        );
    }


    const updated =
        await assignment.updateAssignment(

            assignmentId,

            {

                subject_id:
                    Number(data.subject_id),

                section_id:
                    Number(data.section_id),

                title:
                    data.title.trim(),

                description:
                    data.description?.trim() ||
                    null,

                file_path:
                    data.file_path ||
                    null,

                points:
                    Number(data.points),

                due_date:
                    data.due_date,

                status:
                    data.status ||
                    "open"

            }

        );


    if (!updated) {

        throw new Error(
            "Failed to update assignment."
        );
    }


    return await assignment.getAssignmentById(
        assignmentId
    );
};


// =========================================================
// DELETE ASSIGNMENT
// =========================================================

const deleteAssignment = async (
    assignmentId,
    professorId
) => {

    const assign =
        await assignment.getAssignmentById(
            assignmentId
        );


    if (!assign) {

        throw new Error(
            "Assignment not found."
        );
    }


    if (
        Number(assign.professor_id) !==
        Number(professorId)
    ) {

        throw new Error(
            "You are not authorized to delete this assignment."
        );
    }


    const deleted =
        await assignment.deleteAssignment(
            assignmentId
        );


    if (!deleted) {

        throw new Error(
            "Failed to delete assignment."
        );
    }


    return true;
};


// =========================================================
// EXPORT
// =========================================================

module.exports = {

    deleteAssignment,

    loginUser,

    createAnnounce,

    updateAssignment,

    apply,

    createAssignmentService,

    assignSubjectsToProfessor,

    checkUniversityCapacity,

    getApplicants,

    approveApplicant,

    getStudents,

    createSections,

    getCurriculum,

    addCurriculum,

    getProfessor,

    getSection,

    getSectionById,

    createSubject,

    createProgram,

    deleteSubject,

    deleteCurriculum,

    getSchedulesByTerm,

    getSectionsForSchedule,

    getSchedulesBySection,

    getProfStudent,

    approveAllApplicants,

    getBulkApprovalStatus

};