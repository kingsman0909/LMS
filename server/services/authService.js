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

const BULK_BATCH_SIZE = 500;
const PROGRESS_INTERVAL = 5;
const SECTION_CAPACITY = 50;

let bulkApprovalRunning = false;
let bulkApprovalAdminId = null;

const loginUser = async ({ username, password }, allowedRole) => {
    const result = await User.findByUsername(username);

    if (!result) {
        throw new Error("User not found");
    }

    const { user, profile } = result;

    if (user.role !== allowedRole) {
        throw new Error("User role not allowed");
    }

    if (password !== user.password) {
        console.log("password error");
        throw new Error("Wrong password");
    }

    console.log("creating token");

    const {
        password: pass,
        ...userData
    } = user;

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
        created_by: id,
        created_role: role,
        target_role: "student"
    });

    return {
        message: "announcement added!"
    };
};

const createSections = async (data) => {
    const academicTerm =
        await Academic.getActiveAcademicTerm();

    try {
        await Section.createSection({
            ...data,
            academic_term_id: academicTerm.id
        });

        return {
            message: "Sections successfully added!"
        };
    } catch (err) {
        throw new Error(err.message);
    }
};

const createProgram = async (data) => {
    try {
        await Programs.createProgram(data);

        return {
            message: "Sections successfully added!"
        };
    } catch (err) {
        throw new Error(err.message);
    }
};

const deleteSubject = async (id) => {
    try {
        await Subject.deleteSubject(id);

        return {
            message: "succesfully deleted subject"
        };
    } catch (err) {
        return {
            message: "Error in deleting subject in controller"
        };
    }
};

const deleteCurriculum = async (id) => {
    try {
        await Curriculum.deleteCurriculum(id);

        return {
            message: "succesfully deleted Curriculum Subject"
        };
    } catch (err) {
        return {
            message: "Error in deleting subject in controller"
        };
    }
};

const createSubject = async (data) => {
    try {
        for (let i = 0; i < data.programs.length; i++) {
            const programId = data.programs[i];

            const subject_code =
                await Subject.findByCodeAndProgram(
                    data.subject_code,
                    programId
                );

            if (subject_code) {
                throw new Error("Subject already exist");
            }

            await Subject.createSubject(
                data,
                programId
            );
        }

        return {
            message: "Subject successfully added!"
        };
    } catch (err) {
        throw new Error(err.message);
    }
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

    const existingUser =
        await User.findByUsername(username);

    if (existingUser) {
        throw new Error(
            "Username already exists."
        );
    }

    const existingEmail =
        await User.findByEmail(email);

    if (existingEmail) {
        throw new Error(
            "Email already exists."
        );
    }

    const existingApplication =
        await StudentApplication.findByUsername(
            username
        );

    if (existingApplication) {
        throw new Error(
            "An application with this username already exists."
        );
    }

    const existingApplicationEmail =
        await StudentApplication.findByEmail(
            email
        );

    if (existingApplicationEmail) {
        throw new Error(
            "An application with this email already exists."
        );
    }

    console.log(
        program_id,
        "service"
    );

    const program =
        await Programs.findById(program_id);

    if (!program) {
        throw new Error(
            "Selected course does not exist."
        );
    }

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

    const io = getIO();

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

const generateStudentId = (userId) => {
    return `2026-${String(userId).padStart(4, "0")}`;
};

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

async function assignSection(
    admin_id,
    student_id,
    course_id,
    year_level,
    academicTermId
) {
    let section =
        await Section.getAvailableSections(
            course_id,
            year_level,
            academicTermId
        );

    if (!section) {
        const sections =
            await Section.getByProgramYearAndTerm(
                course_id,
                year_level,
                academicTermId
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
            usedLetters.has(sectionLetter)
        ) {
            sectionNumber++;

            sectionLetter =
                generateSectionName(
                    sectionNumber
                );
        }

        const sectionId =
            await Section.create(
                course_id,
                year_level,
                sectionLetter,
                academicTermId,
                SECTION_CAPACITY
            );

        section = {
            id: sectionId,
            section_name: sectionLetter,
            year_level
        };
    }

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

    await Enrollment.createEnrollment({
        student_id,
        section_id: section.id,
        status: "approved",
        approved_by: admin_id
    });

    return section;
}

const approveApplicant = async (req) => {
    if (bulkApprovalRunning) {
        const error = new Error(
            "Bulk approval is currently in progress. Please wait until it finishes."
        );

        error.statusCode = 409;

        throw error;
    }

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

    const userId =
        await User.createUser({
            ...applicantData,
            role: "student",
            status: "active"
        });

    const course_id =
        applicantData.course_id;

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

    await assignSection(
        req.user.id,
        student.insertId,
        course_id,
        applicantData.year_level,
        term.id
    );

    await StudentApplication.updateStatus(
        applicantId,
        "approved",
        req.user.id
    );

    return {
        message:
            "Application approved! You can now login to your account."
    };
};

const loadSectionCache = async (
    academicTermId
) => {
    const [rows] =
        await db.query(
            `
            SELECT
                s.id,
                s.program_id,
                s.year_level,
                s.section_name,
                s.academic_term_id,
                s.max_students,
                COUNT(ss.student_id) AS student_count
            FROM sections s
            LEFT JOIN student_sections ss
                ON ss.section_id = s.id
                AND ss.academic_term_id = s.academic_term_id
            WHERE s.academic_term_id = ?
            GROUP BY
                s.id,
                s.program_id,
                s.year_level,
                s.section_name,
                s.academic_term_id,
                s.max_students
            ORDER BY
                s.program_id,
                s.year_level,
                s.section_name
            `,
            [academicTermId]
        );

    const cache = new Map();

    for (const row of rows) {
        const programId =
            Number(row.program_id);

        const yearLevel =
            Number(row.year_level);

        const key =
            `${programId}:${yearLevel}`;

        if (!cache.has(key)) {
            cache.set(key, []);
        }

        cache.get(key).push({
            id: Number(row.id),
            program_id: programId,
            year_level: yearLevel,
            section_name: row.section_name,
            academic_term_id:
                Number(row.academic_term_id),
            max_students:
                Number(row.max_students),
            student_count:
                Number(row.student_count)
        });
    }

    return cache;
};

const getWorkingSections = (
    sectionCache,
    workingCache,
    key
) => {
    if (workingCache.has(key)) {
        return workingCache.get(key);
    }

    const original =
        sectionCache.get(key);

    const cloned =
        original
            ? original.map(
                section => ({
                    ...section
                })
            )
            : [];

    workingCache.set(
        key,
        cloned
    );

    return cloned;
};

const getNextSectionName = (
    sections
) => {
    const usedNames =
        new Set(
            sections.map(
                section =>
                    String(
                        section.section_name
                    ).toUpperCase()
            )
        );

    let number = 1;

    while (true) {
        const name =
            generateSectionName(
                number
            );

        if (!usedNames.has(name)) {
            return name;
        }

        number++;
    }
};

const allocateSection = async ({
    connection,
    programId,
    yearLevel,
    academicTermId,
    sectionCache,
    workingCache
}) => {
    const key =
        `${programId}:${yearLevel}`;

    const sections =
        getWorkingSections(
            sectionCache,
            workingCache,
            key
        );

    for (const section of sections) {
        if (
            section.student_count <
            section.max_students
        ) {
            section.student_count++;

            return section;
        }
    }

    const sectionName =
        getNextSectionName(
            sections
        );

    const [result] =
        await connection.execute(
            `
            INSERT INTO sections
            (
                program_id,
                year_level,
                section_name,
                academic_term_id,
                max_students
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                programId,
                yearLevel,
                sectionName,
                academicTermId,
                SECTION_CAPACITY
            ]
        );

    const newSection = {
        id: Number(result.insertId),
        program_id: Number(programId),
        year_level: Number(yearLevel),
        section_name: sectionName,
        academic_term_id:
            Number(academicTermId),
        max_students:
            SECTION_CAPACITY,
        student_count: 1
    };

    sections.push(newSection);

    return newSection;
};

const commitSectionCacheChanges = (
    sectionCache,
    workingCache
) => {
    for (
        const [
            key,
            sections
        ] of workingCache
    ) {
        sectionCache.set(
            key,
            sections
        );
    }
};

const buildMultiRowInsert = (
    table,
    columns,
    rows
) => {
    if (
        !rows ||
        rows.length === 0
    ) {
        return null;
    }

    const rowPlaceholders =
        `(${columns.map(
            () => "?"
        ).join(",")})`;

    const placeholders =
        rows
            .map(
                () =>
                    rowPlaceholders
            )
            .join(",");

    return {
        sql:
            `INSERT INTO ${table} (${columns.join(",")}) VALUES ${placeholders}`,
        values:
            rows.flat()
    };
};

const emitBulkProgress = (
    io,
    adminId,
    {
        status,
        processed,
        total,
        approved,
        failed
    }
) => {
    const percentage =
        total > 0
            ? Math.min(
                100,
                Math.round(
                    (processed / total) * 100
                )
            )
            : 100;

    io.to(
        `admin:${adminId}`
    ).emit(
        "bulk_approval_progress",
        {
            status,
            isApproving: true,
            processed,
            total,
            approved,
            failed,
            percentage
        }
    );
};

const approveAllApplicants = async (
    adminId
) => {
    const io = getIO();

    if (bulkApprovalRunning) {
        const error = new Error(
            "Bulk approval is already in progress."
        );

        error.statusCode = 409;

        throw error;
    }

    bulkApprovalRunning = true;
    bulkApprovalAdminId = adminId;

    let totalPending = 0;
    let totalProcessed = 0;
    let totalApproved = 0;
    let totalFailed = 0;
    let totalBatches = 0;

    try {
        const term =
            await Academic.getAcademicTerm();

        if (!term) {
            throw new Error(
                "No active academic term found."
            );
        }

        const academicTermId =
            Number(term.id);

        io.to("admins").emit(
            "bulk_approval_status",
            {
                isApproving: true,
                adminId
            }
        );

        totalPending =
            Number(
                await StudentApplication
                    .countPendingApplications()
            );

        io.to(
            `admin:${adminId}`
        ).emit(
            "bulk_approval_progress",
            {
                status: "started",
                isApproving: true,
                processed: 0,
                total: totalPending,
                approved: 0,
                failed: 0,
                percentage:
                    totalPending === 0
                        ? 100
                        : 0
            }
        );

        if (totalPending === 0) {
            io.to(
                `admin:${adminId}`
            ).emit(
                "bulk_approval_progress",
                {
                    status: "completed",
                    isApproving: false,
                    processed: 0,
                    total: 0,
                    approved: 0,
                    failed: 0,
                    percentage: 100
                }
            );

            return {
                processed: 0,
                approved: 0,
                failed: 0,
                batches: 0
            };
        }

        const sectionCache =
            await loadSectionCache(
                academicTermId
            );

        let lastId = 0;

        while (true) {
            const applicants =
                await StudentApplication
                    .getPendingApplicationsBatch(
                        BULK_BATCH_SIZE,
                        lastId
                    );

            if (
                applicants.length === 0
            ) {
                break;
            }

            totalBatches++;

            const connection =
                await db.getConnection();

            const workingCache =
                new Map();

            const preparedApplicants =
                [];

            const failedApplicants =
                [];

            try {
                for (
                    let index = 0;
                    index < applicants.length;
                    index++
                ) {
                    const applicant =
                        applicants[index];

                    try {
                        if (
                            !applicant.program_code
                        ) {
                            throw new Error(
                                `Program ${applicant.course_id} not found.`
                            );
                        }

                        const section =
                            await allocateSection({
                                connection,
                                programId:
                                    applicant.course_id,
                                yearLevel:
                                    applicant.year_level,
                                academicTermId,
                                sectionCache,
                                workingCache
                            });

                        preparedApplicants.push({
                            applicant,
                            program: {
                                program_code:
                                    applicant.program_code,
                                program_name:
                                    applicant.program_name
                            },
                            section
                        });
                    } catch (error) {
                        failedApplicants.push({
                            applicant,
                            error
                        });
                    }

                    const currentProcessed =
                        totalProcessed +
                        index +
                        1;

                    const currentFailed =
                        totalFailed +
                        failedApplicants.length;

                    const currentApproved =
                        totalApproved +
                        preparedApplicants.length;

                    if (
                        currentProcessed %
                            PROGRESS_INTERVAL ===
                            0 ||
                        currentProcessed ===
                            totalPending
                    ) {
                        emitBulkProgress(
                            io,
                            adminId,
                            {
                                status:
                                    "processing",
                                processed:
                                    currentProcessed,
                                total:
                                    totalPending,
                                approved:
                                    currentApproved,
                                failed:
                                    currentFailed
                            }
                        );
                    }
                }

                await connection.beginTransaction();

                const validApplicants =
                    preparedApplicants;

                const duplicateIds =
                    new Set();

                if (
                    validApplicants.length > 0
                ) {
                    const usernames =
                        validApplicants.map(
                            item =>
                                item.applicant
                                    .username
                        );

                    const emails =
                        validApplicants.map(
                            item =>
                                item.applicant
                                    .email
                        );

                    const conditions = [];
                    const params = [];

                    for (
                        const username
                        of usernames
                    ) {
                        conditions.push(
                            "username = ?"
                        );
                        params.push(
                            username
                        );
                    }

                    for (
                        const email
                        of emails
                    ) {
                        conditions.push(
                            "email = ?"
                        );
                        params.push(
                            email
                        );
                    }

                    const [
                        existingUsers
                    ] =
                        await connection.execute(
                            `
                            SELECT
                                id,
                                username,
                                email
                            FROM users
                            WHERE
                                ${conditions.join(
                                    " OR "
                                )}
                            `,
                            params
                        );

                    if (
                        existingUsers.length > 0
                    ) {
                        const existingUsernames =
                            new Set(
                                existingUsers.map(
                                    user =>
                                        user.username
                                )
                            );

                        const existingEmails =
                            new Set(
                                existingUsers.map(
                                    user =>
                                        user.email
                                )
                            );

                        for (
                            const item
                            of validApplicants
                        ) {
                            const username =
                                item.applicant
                                    .username;

                            const email =
                                item.applicant
                                    .email;

                            if (
                                existingUsernames.has(
                                    username
                                ) ||
                                existingEmails.has(
                                    email
                                )
                            ) {
                                duplicateIds.add(
                                    item.applicant.id
                                );

                                failedApplicants.push({
                                    applicant:
                                        item.applicant,
                                    error:
                                        new Error(
                                            "Username or email already exists in users."
                                        )
                                });
                            }
                        }
                    }
                }

                const finalApplicants =
                    validApplicants.filter(
                        item =>
                            !duplicateIds.has(
                                item.applicant.id
                            )
                    );

                if (
                    finalApplicants.length === 0
                ) {
                    await connection.rollback();

                    totalProcessed +=
                        applicants.length;

                    totalFailed +=
                        failedApplicants.length;

                    lastId =
                        applicants[
                            applicants.length - 1
                        ].id;

                    continue;
                }

                const userRows =
                    finalApplicants.map(
                        ({ applicant }) => [
                            applicant.email,
                            applicant.username,
                            applicant.password,
                            "student",
                            "active"
                        ]
                    );

                const userInsert =
                    buildMultiRowInsert(
                        "users",
                        [
                            "email",
                            "username",
                            "password",
                            "role",
                            "status"
                        ],
                        userRows
                    );

                await connection.execute(
                    userInsert.sql,
                    userInsert.values
                );

                const usernames =
                    finalApplicants.map(
                        ({ applicant }) =>
                            applicant.username
                    );

                const userPlaceholders =
                    usernames
                        .map(() => "?")
                        .join(",");

                const [
                    createdUsers
                ] =
                    await connection.execute(
                        `
                        SELECT
                            id,
                            username,
                            email
                        FROM users
                        WHERE username IN (
                            ${userPlaceholders}
                        )
                        `,
                        usernames
                    );

                const userMap =
                    new Map();

                for (
                    const user
                    of createdUsers
                ) {
                    userMap.set(
                        user.username,
                        user
                    );
                }

                const studentRows = [];
                const studentMetadata = [];

                for (
                    const item
                    of finalApplicants
                ) {
                    const {
                        applicant,
                        program,
                        section
                    } = item;

                    const user =
                        userMap.get(
                            applicant.username
                        );

                    if (!user) {
                        throw new Error(
                            `Created user not found for ${applicant.username}.`
                        );
                    }

                    const studentId =
                        generateStudentId(
                            user.id
                        );

                    studentRows.push([
                        Number(user.id),
                        studentId,
                        applicant.firstname,
                        applicant.middlename,
                        applicant.lastname,
                        program.program_code,
                        applicant.year_level,
                        section.id,
                        applicant.phone,
                        applicant.gender,
                        applicant.birthdate,
                        applicant.address,
                        null
                    ]);

                    studentMetadata.push({
                        applicant,
                        userId:
                            Number(user.id),
                        studentId,
                        sectionId:
                            Number(section.id)
                    });
                }

                const studentInsert =
                    buildMultiRowInsert(
                        "student",
                        [
                            "user_id",
                            "student_id",
                            "firstname",
                            "middlename",
                            "lastname",
                            "course",
                            "year_level",
                            "section_id",
                            "phone",
                            "gender",
                            "birthdate",
                            "address",
                            "profile_picture"
                        ],
                        studentRows
                    );

                await connection.execute(
                    studentInsert.sql,
                    studentInsert.values
                );

                const studentIds =
                    studentMetadata.map(
                        item =>
                            item.studentId
                    );

                const studentPlaceholders =
                    studentIds
                        .map(() => "?")
                        .join(",");

                const [
                    createdStudents
                ] =
                    await connection.execute(
                        `
                        SELECT
                            id,
                            student_id,
                            user_id
                        FROM student
                        WHERE student_id IN (
                            ${studentPlaceholders}
                        )
                        `,
                        studentIds
                    );

                const studentMap =
                    new Map();

                for (
                    const student
                    of createdStudents
                ) {
                    studentMap.set(
                        student.student_id,
                        student
                    );
                }

                const studentSectionRows = [];
                const enrollmentRows = [];
                const approvedApplicationIds = [];

                for (
                    const item
                    of studentMetadata
                ) {
                    const student =
                        studentMap.get(
                            item.studentId
                        );

                    if (!student) {
                        throw new Error(
                            `Created student not found for ${item.studentId}.`
                        );
                    }

                    studentSectionRows.push([
                        Number(student.id),
                        item.sectionId,
                        academicTermId
                    ]);

                    enrollmentRows.push([
                        Number(student.id),
                        item.sectionId,
                        "approved",
                        adminId,
                        null
                    ]);

                    approvedApplicationIds.push(
                        item.applicant.id
                    );
                }

                const studentSectionInsert =
                    buildMultiRowInsert(
                        "student_sections",
                        [
                            "student_id",
                            "section_id",
                            "academic_term_id"
                        ],
                        studentSectionRows
                    );

                await connection.execute(
                    studentSectionInsert.sql,
                    studentSectionInsert.values
                );

                const enrollmentInsert =
                    buildMultiRowInsert(
                        "student_enrollments",
                        [
                            "student_id",
                            "section_id",
                            "status",
                            "approved_by",
                            "remarks"
                        ],
                        enrollmentRows
                    );

                await connection.execute(
                    enrollmentInsert.sql,
                    enrollmentInsert.values
                );

                const applicationPlaceholders =
                    approvedApplicationIds
                        .map(() => "?")
                        .join(",");

                await connection.execute(
                    `
                    UPDATE student_applications
                    SET
                        status = 'approved',
                        reviewed_by = ?,
                        reviewed_at = CURRENT_TIMESTAMP
                    WHERE
                        status = 'pending'
                    AND id IN (
                        ${applicationPlaceholders}
                    )
                    `,
                    [
                        adminId,
                        ...approvedApplicationIds
                    ]
                );

                await connection.commit();

                commitSectionCacheChanges(
                    sectionCache,
                    workingCache
                );

                totalProcessed +=
                    applicants.length;

                totalApproved +=
                    approvedApplicationIds.length;

                totalFailed +=
                    failedApplicants.length;

                lastId =
                    applicants[
                        applicants.length - 1
                    ].id;

                emitBulkProgress(
                    io,
                    adminId,
                    {
                        status:
                            "processing",
                        processed:
                            totalProcessed,
                        total:
                            totalPending,
                        approved:
                            totalApproved,
                        failed:
                            totalFailed
                    }
                );
            } catch (error) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error(
                        "Rollback error:",
                        rollbackError.message
                    );
                }

                console.error(
                    "Bulk approval batch failed:",
                    error
                );

                throw error;
            } finally {
                connection.release();
            }
        }

        io.to(
            `admin:${adminId}`
        ).emit(
            "bulk_approval_progress",
            {
                status: "completed",
                isApproving: false,
                processed:
                    totalProcessed,
                total:
                    totalPending,
                approved:
                    totalApproved,
                failed:
                    totalFailed,
                percentage: 100
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
    } catch (error) {
        io.to(
            `admin:${adminId}`
        ).emit(
            "bulk_approval_progress",
            {
                status: "error",
                isApproving: false,
                processed:
                    totalProcessed,
                total:
                    totalPending,
                approved:
                    totalApproved,
                failed:
                    totalFailed,
                percentage:
                    totalPending > 0
                        ? Math.min(
                            100,
                            Math.round(
                                (
                                    totalProcessed /
                                    totalPending
                                ) * 100
                            )
                        )
                        : 0,
                message:
                    error.message ||
                    "Bulk approval failed."
            }
        );

        throw error;
    } finally {
        bulkApprovalRunning = false;
        bulkApprovalAdminId = null;

        io.to("admins").emit(
            "bulk_approval_status",
            {
                isApproving: false,
                adminId: null
            }
        );

        console.log(
            "Bulk approval lock released."
        );
    }
};

const getBulkApprovalStatus = () => {
    return {
        isApproving:
            bulkApprovalRunning,
        adminId:
            bulkApprovalAdminId
    };
};

const removeSensitiveFields = (user) => {
    const {
        password,
        ...safeUser
    } = user;

    return safeUser;
};

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
        students: result.students, //temporary show password for testing, I just override it with no filter haha
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

    const profSecure = professor.map(
        removeSensitiveFields
    );

    return professor; //temporary add password to display
};

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
        .checkEnrollmentCapacity(id);
};

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

const addCurriculum = async ({
    programId,
    subjectIds,
    yearLevel,
    semester
}) => {
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
        yearLevelMap[
            Number(yearLevel)
        ] || yearLevel;

    if (
        !validYearLevels.includes(
            normalizedYear
        )
    ) {
        throw new Error(
            "Invalid year level"
        );
    }

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
        semesterMap[
            Number(semester)
        ] || semester;

    if (
        !validSemesters.includes(
            normalizedSemester
        )
    ) {
        throw new Error(
            "Invalid semester"
        );
    }

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

const updateAssignment = async (
    assignmentId,
    professorId,
    data
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
                    Number(
                        data.subject_id
                    ),
                section_id:
                    Number(
                        data.section_id
                    ),
                title:
                    data.title.trim(),
                description:
                    data.description?.trim() ||
                    null,
                file_path:
                    data.file_path ||
                    null,
                points:
                    Number(
                        data.points
                    ),
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