const User = require("../model/User");
const Prof = require("../model/Prof");
const Announce = require("../model/Announce");
const Student = require("../model/Student");
const Enrollment = require("../model/Enrolment");
const StudentApplication = require('../model/Application');
const Course = require('../model/Courses');
const Programs = require('../model/Programs');
const Section = require('../model/Sections');
const Academic = require('../model/AcademicTerm');
const Subject = require('../model/Subjects');
const scheduleModel = require("../model/Schedule");
const capacityChecker = require("../services/capacityCheckerService");
const Curriculum = require("../model/Curriculum");
const assignment = require("../model/Assignment");




const loginUser = async ({ username, password }, allowedRole) => {
       
    
    const result = await User.findByUsername(username);
    

    if (!result) {
        throw new Error("User not found");
    }

    const { user, profile } = result;

    if (user.role !== allowedRole) {
        throw new Error("User role not allowed");
    }

    // Temporary password check
    if (password !== user.password && isProduction === "true") {
        console.log("password error")
        throw new Error("Wrong password");
    }

    console.log("creating token")
    const jwt = require("jsonwebtoken");

    const { password: pass, ...userData } = user;

    const token = jwt.sign(
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

const createAnnounce = async(data, user) => {

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
        created_by: id,
        created_role: role,
        target_role: "student"
    })
    return {
        message: "announcement added!"
    };
}

const createSections = async(data) => {
    const academicTerm = await Academic.getActiveAcademicTerm();
    
    try{
        await Section.createSection(
            {
                ...data,
            academic_term_id: academicTerm.id
            }
        );

        return{
            message: "Sections successfully added!"
        }
    }
    catch(err){
        throw new Error(err.message);
    }

}

const createProgram = async(data) => {    
    try{
        await Programs.createProgram(data);

        return{
            message: "Sections successfully added!"
        }
    }
    catch(err){
        throw new Error(err.message);
    }

}

const deleteSubject = async(id) => {
    try{
        const response = await Subject.deleteSubject(id);

        return ({
            message: "succesfully deleted subject"
        })
    }
    catch(err){
        return({
            message: "Error in deleting subject in controller"
        })
    }
}

const deleteCurriculum = async(id) => {
    try{
        const response = await Curriculum.deleteCurriculum(id);

        return ({
            message: "succesfully deleted Curriculum Subject"
        })
    }
    catch(err){
        return({
            message: "Error in deleting subject in controller"
        })
    }
}

const createSubject = async(data) => {
    
    try{

        for(let i = 0; i < data.programs.length; i++){
            const programId = data.programs[i];
            const subject_code = await Subject.findByCodeAndProgram(data.subject_code, programId);

            if(subject_code){
                throw new Error(
                    "Subject already exist"
                ) 
            }

            await Subject.createSubject(data, programId);
        }
        return{
            message: "Subject successfully added!"
        }
    }
    catch(err){
        throw new Error(err.message);
    }
}

const db = require("../config/db");
const generateSectionName = (number) => {

    let name = "";

    while (number > 0) {

        number--;

        name =
            String.fromCharCode(
                65 + (number % 26)
            ) + name;

        number =
            Math.floor(number / 26);
    }

    return name;
};



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


    // CHECK USERNAME IN USERS TABLE

    const existingUser =
        await User.findByUsername(username);

    if (existingUser) {

        throw new Error(
            "Username already exists."
        );

    }


    // CHECK EMAIL IN USERS TABLE

    const existingEmail =
        await User.findByEmail(email);

    if (existingEmail) {

        throw new Error(
            "Email already exists."
        );

    }


    // CHECK EXISTING STUDENT APPLICATION

    const existingApplication =
        await StudentApplication.findByUsername(username);

    if (existingApplication) {

        throw new Error(
            "An application with this username already exists."
        );

    }


    // CHECK EXISTING APPLICATION EMAIL

    const existingApplicationEmail =
        await StudentApplication.findByEmail(email);

    if (existingApplicationEmail) {

        throw new Error(
            "An application with this email already exists."
        );

    }


    // CHECK COURSE

    console.log(program_id, "service");
    const program =
        await Programs.findById(program_id);

    if (!program) {

        throw new Error(
            "Selected course does not exist."
        );

    }


    // CREATE APPLICATION

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


    return {

        message:
            "Application submitted successfully. Please wait for admin approval."

    };

};

const generateStudentId = (userId) => {
    return `2026-${String(userId).padStart(4, "0")}`;
};

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

const getSchedulesByTerm = async (academicTermId) => {

    if (!academicTermId) {
        throw new Error(
            "Academic term ID is required."
        );
    }

    const schedules =
        await scheduleModel.getSchedulesByTerm(
            academicTermId
        );

    return schedules;
};

const getSchedulesBySection = async (academicTermId, sectionId) => {

    if (!academicTermId) {
        throw new Error(
            "Academic term ID is required."
        );
    }
    if(!sectionId){
        throw new Error(
            "Section ID is required."
        );
    }

    const schedules =
        await scheduleModel.getSchedulesBySection(
            academicTermId, sectionId
        );

    return schedules;
};

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


    // ==========================================
    // 1. FIND AVAILABLE SECTION
    // ==========================================

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


    // ==========================================
    // 2. NO AVAILABLE SECTION
    //    CREATE NEW SECTION
    // ==========================================

    if (!section) {

        console.log(
            "NO AVAILABLE SECTION - CREATING NEW SECTION"
        );


        // Get all existing sections
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


        // ==========================================
        // GET USED SECTION NAMES
        // ==========================================

        const usedLetters =
            new Set(
                sections.map(
                    section =>
                        String(
                            section.section_name
                        ).toUpperCase()
                )
            );


        // ==========================================
        // FIND NEXT AVAILABLE SECTION NAME
        // ==========================================

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


        // ==========================================
        // CREATE SECTION
        // ==========================================

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


    // ==========================================
    // 3. ASSIGN STUDENT TO SECTION
    // ==========================================

    await db.query(`
        INSERT INTO student_sections
        (
            student_id,
            section_id,
            academic_term_id
        )
        VALUES (?, ?, ?)
    `, [
        student_id,
        section.id,
        academicTermId
    ]);


    // ==========================================
    // 4. UPDATE CURRENT SECTION
    // ==========================================

    await db.query(`
        UPDATE student
        SET section_id = ?
        WHERE id = ?
    `, [
        section.id,
        student_id
    ]);


    console.log(
        "Student assigned to section:",
        section
    );


    // ==========================================
    // 5. CREATE ENROLLMENT
    // ==========================================

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


const approveApplicant = async (req) => {

    const applicantId = req.params.id;
    const term = await Academic.getAcademicTerm();
    const applicantData =
        await StudentApplication.findById(applicantId);

    const program_code =
        await Programs.findById(applicantData.course_id);


    // ==========================================
    // CREATE USER
    // ==========================================

    const userId =
        await User.createUser({

            ...applicantData,

            role: "student",
            status: "active"

        });


    const course_id =
        applicantData.course_id;


    console.log("done create user");


    // ==========================================
    // CREATE STUDENT
    // ==========================================

    const student =
        await Student.createStudent({

            ...applicantData,

            course_name:
                program_code.program_code,

            user_id:
                userId.insertId,

            student_id:
                generateStudentId(
                    userId.insertId
                )

        });


    console.log("done create student");


    // ==========================================
    // ASSIGN SECTION
    // ==========================================

    const section =
        await assignSection(
            req.user.id,
            student.insertId,
            course_id,
            applicantData.year_level,
            term.id
        );


    console.log("done create section.");


    // ==========================================
    // UPDATE APPLICATION
    // ==========================================

    await StudentApplication.updateStatus(
        applicantId,
        "approved",
        req.user.id
    );


    console.log("done update status");


    return {

        message:
            "Application approved! You can now login to your account."

    };
};

const removeSensitiveFields = (user) => {
    const {
        password,
        ...safeUser
    } = user;

    return safeUser;
};



const getApplicants = async () => {

    const applicants = await StudentApplication.getPendingApplications();
    return applicants.map(removeSensitiveFields);

};


const getStudents = async (
    page,
    limit,
    search
) => {

    console.log(
        "service reach",
        "page:", page,
        "limit:", limit,
        "search:", search
    );

    const result =
        await Student.getAllStudent(
            page,
            limit,
            search
        );

    return {
        students:
            result.students.map(removeSensitiveFields),

        total: result.total,

        page: result.page,

        limit: result.limit,

        hasMore: result.hasMore
    };
};


const getProfStudent = async (termId, profId) => {
    const students = await Student.getProfStudents(termId, profId);
    return students.map(removeSensitiveFields);


};

const getProfessor = async () => {

    console.log("service reach professor");
    const professor = await Prof.getProfessor();
    console.log(professor, "prof");

    return professor.map(removeSensitiveFields);

};

const getSection = async () => {


    console.log("service reach");
    const sections = await Section.getAllSections();
    console.log(sections);
    
    return sections;

};

const getSectionById = async (id) => {


    console.log("service reach");
    const sections = await Section.getSectionById(id);
    console.log(sections);
    
    return sections;

};




/*
|--------------------------------------------------------------------------
| CHECK UNIVERSITY CAPACITY
|--------------------------------------------------------------------------
| Receives ONLY academicTermId.
|--------------------------------------------------------------------------
*/

const checkUniversityCapacity = async (academicTermId) => {

    const id = Number(academicTermId);

    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {
        throw new Error(
            "Academic term ID is required and must be a valid positive integer."
        );
    }

    const result =
        await capacityChecker.checkEnrollmentCapacity(id);

    return result;
};


/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/






// =========================================================
// GET CURRICULUM
// =========================================================

const getCurriculum = async ({
    programId,
    yearLevel = null,
    semester = null
}) => {

    if (!programId) {
        throw new Error("Program ID is required");
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
        1: "1st Year",
        2: "2nd Year",
        3: "3rd Year",
        4: "4th Year"
    };

    const normalizedYear =
        yearLevelMap[Number(yearLevel)] ||
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
        1: "1st Semester",
        2: "2nd Semester",
        3: "Summer"
    };

    const normalizedSemester =
        semesterMap[Number(semester)] ||
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
                .map(id => Number(id))
                .filter(id => id > 0)
        )
    ];


    if (uniqueSubjectIds.length === 0) {
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

        // =================================================
        // DUPLICATE CURRICULUM
        // =================================================

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

const assignSubjectsToProfessor = async (professorId, subjectIds) => {

    if (!professorId) {
        throw new Error("Professor ID is required");
    }

    if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
        throw new Error("At least one subject must be selected");
    }

    const result = await Prof.assignSubjectsToProfessor(
        professorId,
        subjectIds
    );

    return result;
};


//===============================
//  ASSIGNMENT SERVICE
//=========================

const createAssignmentService = async (data) => {
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

    // Required fields
    if (!professor_id) {
        throw new Error("Professor ID is required.");
    }

    if (!subject_id) {
        throw new Error("Subject ID is required.");
    }

    if (!section_id) {
        throw new Error("Section ID is required.");
    }

    if (!title || !title.trim()) {
        throw new Error("Assignment title is required.");
    }

    if (!due_date) {
        throw new Error("Due date is required.");
    }

    // Validate points
    const assignmentPoints = Number(points);

    if (
        Number.isNaN(assignmentPoints) ||
        assignmentPoints < 0
    ) {
        throw new Error(
            "Points must be a valid non-negative number."
        );
    }

    // Create assignment
    const create = await assignment.createAssignment({
        professor_id,
        subject_id,
        section_id,
        title: title.trim(),
        description: description?.trim() || null,
        file_path: file_path || null,
        points: assignmentPoints,
        due_date,
        status: "open"
    });

    return create;
};


/*
|--------------------------------------------------------------------------
| UPDATE ASSIGNMENT
|--------------------------------------------------------------------------
*/

const updateAssignment = async (
    assignmentId,
    professorId,
    data
) => {

    console.log("assignment service")

    // Check if assignment exists
    const assign =
        await assignment.getAssignmentById(assignmentId);

    if (!assign) {
        throw new Error("Assignment not found.");
    }

    // Make sure the professor owns this assignment
    if (Number(assign.professor_id) !== Number(professorId)) {
        throw new Error(
            "You are not authorized to update this assignment."
        );
    }

    // Basic validation
    if (!data.subject_id) {
        throw new Error("Subject is required.");
    }

    if (!data.section_id) {
        throw new Error("Section is required.");
    }

    if (!data.title || !data.title.trim()) {
        throw new Error("Assignment title is required.");
    }

    if (!data.points || Number(data.points) <= 0) {
        throw new Error("Points must be greater than zero.");
    }

    if (!data.due_date) {
        throw new Error("Due date is required.");
    }

    // Update database
    const updated =
        await assignment.updateAssignment(
            assignmentId,
            {
                subject_id: Number(data.subject_id),
                section_id: Number(data.section_id),
                title: data.title.trim(),
                description:
                    data.description?.trim() || null,
                file_path:
                    data.file_path || null,
                points: Number(data.points),
                due_date: data.due_date,
                status: data.status || "open"
            }
        );

    if (!updated) {
        throw new Error("Failed to update assignment.");
    }

    // Return updated assignment
    return await assignment.getAssignmentById(
        assignmentId
    );
};

const deleteAssignment = async (
    assignmentId,
    professorId
) => {

    // Check if assignment exists
    const assign =
        await assignment.getAssignmentById(assignmentId);

    if (!assign) {
        throw new Error("Assignment not found.");
    }

    // Make sure the professor owns this assignment
    if (
        Number(assign.professor_id) !==
        Number(professorId)
    ) {
        throw new Error(
            "You are not authorized to delete this assignment."
        );
    }

    // Delete assignment
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
    getProfStudent
};
