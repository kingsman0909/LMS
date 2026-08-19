const db = require("../config/db");

/*
|--------------------------------------------------------------------------
| CONFIG
|--------------------------------------------------------------------------
*/

const SECTION_CAPACITY = 30;

const DAY_ORDER = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
];

const MAX_SIMULATED_SECTIONS = 500;

const MAX_GLOBAL_SIMULATION_NODES = 50000;

const yearLevelMap = {
    1: "1st Year",
    2: "2nd Year",
    3: "3rd Year",
    4: "4th Year"
};


/*
|--------------------------------------------------------------------------
| DEBUG
|--------------------------------------------------------------------------
*/

const log = (...args) => {
    console.log("[CAPACITY]", ...args);
};


/*
|--------------------------------------------------------------------------
| BASIC OCCUPANCY HELPERS
|--------------------------------------------------------------------------
*/

function hasConflict(map, resourceId, slots) {

    const id = Number(resourceId);

    const occupied = map.get(id);

    if (!occupied) {
        return false;
    }

    for (const slot of slots) {

        if (occupied.has(Number(slot.id))) {
            return true;
        }
    }

    return false;
}


function reserve(map, resourceId, slots) {

    const id = Number(resourceId);

    if (!map.has(id)) {
        map.set(id, new Set());
    }

    const occupied = map.get(id);

    for (const slot of slots) {
        occupied.add(Number(slot.id));
    }
}


function cloneOccupancy(occupancy) {

    return {

        professorSlots:
            new Map(
                [...occupancy.professorSlots.entries()]
                    .map(([id, slots]) => [
                        id,
                        new Set(slots)
                    ])
            ),

        roomSlots:
            new Map(
                [...occupancy.roomSlots.entries()]
                    .map(([id, slots]) => [
                        id,
                        new Set(slots)
                    ])
            )
    };
}


/*
|--------------------------------------------------------------------------
| TIME SLOTS
|--------------------------------------------------------------------------
*/

async function getTimeSlots() {

    const [rows] = await db.query(`
        SELECT
            id,
            day,
            start_time,
            end_time
        FROM time_slots
        WHERE status = 'available'
        ORDER BY
            FIELD(
                day,
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday',
                'Saturday'
            ),
            start_time
    `);

    return rows;
}


function groupSlotsByDay(slots) {

    const map = new Map();

    for (const day of DAY_ORDER) {
        map.set(day, []);
    }

    for (const slot of slots) {

        if (!map.has(slot.day)) {
            map.set(slot.day, []);
        }

        map.get(slot.day).push(slot);
    }

    return map;
}


function buildWindows(slotsByDay, hours) {

    const windows = [];

    for (const day of DAY_ORDER) {

        const daySlots =
            slotsByDay.get(day) || [];

        if (daySlots.length < hours) {
            continue;
        }

        for (
            let i = 0;
            i <= daySlots.length - hours;
            i++
        ) {

            const candidate =
                daySlots.slice(i, i + hours);

            let consecutive = true;

            for (
                let j = 1;
                j < candidate.length;
                j++
            ) {

                if (
                    candidate[j - 1].end_time !==
                    candidate[j].start_time
                ) {

                    consecutive = false;
                    break;
                }
            }

            if (!consecutive) {
                continue;
            }

            windows.push({
                day,
                slots: candidate
            });
        }
    }

    return windows;
}


/*
|--------------------------------------------------------------------------
| ROOMS
|--------------------------------------------------------------------------
*/

async function getRooms() {

    const [rows] = await db.query(`
        SELECT
            id,
            room_name,
            room_type,
            capacity
        FROM rooms
        WHERE status = 'available'
        ORDER BY
            capacity ASC,
            id ASC
    `);

    return rows;
}


/*
|--------------------------------------------------------------------------
| PROFESSORS
|--------------------------------------------------------------------------
*/

async function getProfessorMap(subjectIds) {

    const map = new Map();

    if (!subjectIds.length) {
        return map;
    }

    const placeholders =
        subjectIds.map(() => "?").join(",");

    const [rows] = await db.query(`
        SELECT
            ps.subject_id,

            p.id,
            p.employee_id,
            p.firstname,
            p.lastname,
            p.department

        FROM professor_subjects ps

        JOIN profesor p
            ON p.id = ps.professor_id

        WHERE ps.subject_id IN (${placeholders})

        ORDER BY
            ps.subject_id,
            p.id
    `, subjectIds);

    for (const row of rows) {

        const subjectId =
            Number(row.subject_id);

        if (!map.has(subjectId)) {
            map.set(subjectId, []);
        }

        map.get(subjectId).push({

            id:
                Number(row.id),

            employee_id:
                row.employee_id,

            firstname:
                row.firstname,

            lastname:
                row.lastname,

            department:
                row.department
        });
    }

    return map;
}


/*
|--------------------------------------------------------------------------
| EXISTING OCCUPANCY
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| Existing schedules are LOCKED.
|
| We NEVER regenerate them.
|
|--------------------------------------------------------------------------
*/

async function getExistingOccupancy(
    academicTermId
) {

    const occupancy = {

        professorSlots:
            new Map(),

        roomSlots:
            new Map()
    };


    const [rows] = await db.query(`
        SELECT
            cs.professor_id,
            cs.room_id,
            cs.time_slot_id

        FROM class_schedules cs

        WHERE cs.academic_term_id = ?
    `, [
        academicTermId
    ]);


    log(
        "Existing schedule records:",
        rows.length
    );


    for (const row of rows) {

        if (row.professor_id != null) {

            reserve(
                occupancy.professorSlots,
                row.professor_id,
                [
                    {
                        id:
                            row.time_slot_id
                    }
                ]
            );
        }


        if (row.room_id != null) {

            reserve(
                occupancy.roomSlots,
                row.room_id,
                [
                    {
                        id:
                            row.time_slot_id
                    }
                ]
            );
        }
    }


    return occupancy;
}


/*
|--------------------------------------------------------------------------
| EXISTING SCHEDULED SECTIONS
|--------------------------------------------------------------------------
|
| Only sections with actual schedules are counted as existing capacity.
|
|--------------------------------------------------------------------------
*/

async function getExistingSections(
    academicTermId
) {

    const [rows] = await db.query(`
        SELECT
            s.id,
            s.section_name,
            s.program_id,
            s.year_level,
            s.max_students,

            COUNT(DISTINCT cs.id) AS schedule_count,

            COUNT(DISTINCT ss.student_id) AS student_count

        FROM sections s

        LEFT JOIN class_schedules cs
            ON cs.section_id = s.id
            AND cs.academic_term_id = ?

        LEFT JOIN student_sections ss
            ON ss.section_id = s.id
            AND ss.academic_term_id = ?

        WHERE s.academic_term_id = ?

        GROUP BY
            s.id,
            s.section_name,
            s.program_id,
            s.year_level,
            s.max_students

        ORDER BY
            s.program_id,
            s.year_level,
            s.id
    `, [
        academicTermId,
        academicTermId,
        academicTermId
    ]);


    return rows.map(row => ({

        id:
            Number(row.id),

        sectionName:
            row.section_name,

        programId:
            Number(row.program_id),

        yearLevel:
            Number(row.year_level),

        maxStudents:
            Number(
                row.max_students ||
                SECTION_CAPACITY
            ),

        scheduleCount:
            Number(
                row.schedule_count || 0
            ),

        studentCount:
            Number(
                row.student_count || 0
            )
    }));
}


/*
|--------------------------------------------------------------------------
| CURRICULUM
|--------------------------------------------------------------------------
*/

async function getCurriculum(
    programId,
    yearLevel,
    academicTermId
) {

    const normalizedYear =
        yearLevelMap[Number(yearLevel)];


    const [rows] = await db.query(`
        SELECT

            cs.subject_id,

            sub.subject_code,
            sub.subject_name,

            sub.units,
            sub.lecture_units,
            sub.lab_units,

            cs.year_level,
            cs.semester

        FROM curriculum_subjects cs

        JOIN subjects sub
            ON sub.id = cs.subject_id

        JOIN academic_terms at
            ON at.id = ?

        WHERE cs.program_id = ?

        AND cs.year_level = ?

        AND cs.semester = at.semester

        ORDER BY
            sub.subject_code
    `, [
        academicTermId,
        programId,
        normalizedYear
    ]);


    return rows;
}


/*
|--------------------------------------------------------------------------
| REQUIREMENTS
|--------------------------------------------------------------------------
*/

function buildRequirements(subjects) {

    const requirements = [];

    let id = 0;


    for (const subject of subjects) {

        const lectureUnits =
            Number(
                subject.lecture_units || 0
            );

        const labUnits =
            Number(
                subject.lab_units || 0
            );


        /*
        |--------------------------------------------------------------------------
        | LECTURE
        |--------------------------------------------------------------------------
        */

        if (lectureUnits > 0) {

            requirements.push({

                id:
                    id++,

                subject_id:
                    Number(subject.subject_id),

                subject_code:
                    subject.subject_code,

                subject_name:
                    subject.subject_name,

                type:
                    "lecture",

                hours:
                    lectureUnits
            });
        }


        /*
        |--------------------------------------------------------------------------
        | LAB
        |--------------------------------------------------------------------------
        */

        if (labUnits > 0) {

            requirements.push({

                id:
                    id++,

                subject_id:
                    Number(subject.subject_id),

                subject_code:
                    subject.subject_code,

                subject_name:
                    subject.subject_name,

                type:
                    "laboratory",

                hours:
                    labUnits * 3
            });
        }
    }


    return requirements;
}


/*
|--------------------------------------------------------------------------
| ROOM FILTER
|--------------------------------------------------------------------------
*/

function getSuitableRooms(
    requirement,
    rooms
) {

    const requiredType =
        requirement.type === "laboratory"
            ? "laboratory"
            : "lecture";


    return rooms.filter(room => {

        return (

            String(room.room_type)
                .toLowerCase() ===
            requiredType

            &&

            Number(room.capacity) >=
            SECTION_CAPACITY
        );
    });
}


/*
|--------------------------------------------------------------------------
| FIND ASSIGNMENT
|--------------------------------------------------------------------------
*/

function findAssignment({

    requirement,

    sectionId,

    windows,

    professors,

    rooms,

    occupancy,

    sectionOccupiedSlots

}) {

    if (!professors.length) {

        return {

            success: false,

            reason:
                `No qualified professor for ` +
                `${requirement.subject_code}`
        };
    }


    if (!rooms.length) {

        return {

            success: false,

            reason:
                `No suitable ${requirement.type} room ` +
                `with capacity ${SECTION_CAPACITY}`
        };
    }


    /*
    |--------------------------------------------------------------------------
    | SAME CONSTRAINTS AS SCHEDULER
    |--------------------------------------------------------------------------
    */

    for (const window of windows) {


        /*
        |--------------------------------------------------------------------------
        | SECTION CONFLICT
        |--------------------------------------------------------------------------
        */

        let sectionConflict = false;


        for (const slot of window.slots) {

            if (
                sectionOccupiedSlots.has(
                    Number(slot.id)
                )
            ) {

                sectionConflict = true;
                break;
            }
        }


        if (sectionConflict) {
            continue;
        }


        /*
        |--------------------------------------------------------------------------
        | PROFESSOR
        |--------------------------------------------------------------------------
        */

        for (const professor of professors) {

            if (
                hasConflict(
                    occupancy.professorSlots,
                    professor.id,
                    window.slots
                )
            ) {

                continue;
            }


            /*
            |--------------------------------------------------------------------------
            | ROOM
            |--------------------------------------------------------------------------
            */

            for (const room of rooms) {

                if (
                    hasConflict(
                        occupancy.roomSlots,
                        room.id,
                        window.slots
                    )
                ) {

                    continue;
                }


                return {

                    success: true,

                    assignment: {

                        sectionId,

                        requirement,

                        professor,

                        room,

                        window
                    }
                };
            }
        }
    }


    return {

        success: false,

        reason:
            `All professor/room/time combinations ` +
            `exhausted for ` +
            `${requirement.subject_code} ` +
            `(${requirement.type})`
    };
}


/*
|--------------------------------------------------------------------------
| SIMULATE ONE NEW SECTION
|--------------------------------------------------------------------------
*/

function simulateSection({

    sectionNumber,

    programId,

    yearLevel,

    requirements,

    professorMap,

    rooms,

    windows,

    occupancy

}) {

    const sectionId =
        `SIMULATED-${programId}-${yearLevel}-${sectionNumber}`;


    const sectionOccupiedSlots =
        new Set();


    const assignments = [];


    /*
    |--------------------------------------------------------------------------
    | HARDEST REQUIREMENTS FIRST
    |--------------------------------------------------------------------------
    */

    const sortedRequirements =
        [...requirements].sort((a, b) => {

            if (a.type !== b.type) {

                return (
                    a.type === "laboratory"
                        ? -1
                        : 1
                );
            }


            return (
                b.hours -
                a.hours
            );
        });


    const tempOccupancy =
        cloneOccupancy(
            occupancy
        );


    /*
    |--------------------------------------------------------------------------
    | ASSIGN ALL SUBJECTS
    |--------------------------------------------------------------------------
    */

    for (const requirement of sortedRequirements) {

        const professors =
            professorMap.get(
                Number(
                    requirement.subject_id
                )
            ) || [];


        const suitableRooms =
            getSuitableRooms(
                requirement,
                rooms
            );


        const candidateWindows =
            windows.get(
                Number(
                    requirement.hours
                )
            ) || [];


        const result =
            findAssignment({

                requirement,

                sectionId,

                windows:
                    candidateWindows,

                professors,

                rooms:
                    suitableRooms,

                occupancy:
                    tempOccupancy,

                sectionOccupiedSlots
            });


        /*
        |--------------------------------------------------------------------------
        | THIS SECTION CANNOT BE CREATED
        |--------------------------------------------------------------------------
        */

        if (!result.success) {

            return {

                success: false,

                assignments,

                failedRequirement:
                    requirement,

                reason:
                    result.reason
            };
        }


        const assignment =
            result.assignment;


        /*
        |--------------------------------------------------------------------------
        | RESERVE PROFESSOR
        |--------------------------------------------------------------------------
        */

        reserve(
            tempOccupancy.professorSlots,

            assignment.professor.id,

            assignment.window.slots
        );


        /*
        |--------------------------------------------------------------------------
        | RESERVE ROOM
        |--------------------------------------------------------------------------
        */

        reserve(
            tempOccupancy.roomSlots,

            assignment.room.id,

            assignment.window.slots
        );


        /*
        |--------------------------------------------------------------------------
        | RESERVE SECTION
        |--------------------------------------------------------------------------
        */

        for (
            const slot
            of assignment.window.slots
        ) {

            sectionOccupiedSlots.add(
                Number(slot.id)
            );
        }


        assignments.push(
            assignment
        );
    }


    /*
    |--------------------------------------------------------------------------
    | SUCCESS
    |--------------------------------------------------------------------------
    */

    return {

        success: true,

        assignments,

        occupancy:
            tempOccupancy
    };
}


/*
|--------------------------------------------------------------------------
| SIMULATE ONE PROGRAM / YEAR
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| We receive GLOBAL occupancy.
|
| We do NOT reset it.
|
|--------------------------------------------------------------------------
*/

async function simulateProgramYear({

    programId,

    yearLevel,

    academicTermId,

    rooms,

    professorMap,

    windows,

    occupancy,

    globalState

}) {

    const subjects =
        await getCurriculum(
            programId,
            yearLevel,
            academicTermId
        );


    if (!subjects.length) {

        return {

            success: false,

            programId,

            yearLevel,

            sectionsCreated: 0,

            additionalCapacity: 0,

            reason:
                "No curriculum subjects."
        };
    }


    const requirements =
        buildRequirements(
            subjects
        );


    if (!requirements.length) {

        return {

            success: false,

            programId,

            yearLevel,

            sectionsCreated: 0,

            additionalCapacity: 0,

            reason:
                "No lecture/laboratory requirements."
        };
    }


    let currentOccupancy =
        occupancy;


    let sectionsCreated = 0;

    const simulatedSections = [];


    for (
        let sectionNumber = 1;

        sectionNumber <= MAX_SIMULATED_SECTIONS;

        sectionNumber++
    ) {


        /*
        |--------------------------------------------------------------------------
        | GLOBAL NODE LIMIT
        |--------------------------------------------------------------------------
        */

        globalState.nodes++;


        if (
            globalState.nodes >
            MAX_GLOBAL_SIMULATION_NODES
        ) {

            return {

                success:
                    sectionsCreated > 0,

                programId,

                yearLevel,

                sectionsCreated,

                additionalCapacity:
                    sectionsCreated *
                    SECTION_CAPACITY,

                simulatedSections,

                stoppedByGlobalLimit:
                    true,

                reason:
                    "Global simulation node limit reached.",

                occupancy:
                    currentOccupancy
            };
        }


        /*
        |--------------------------------------------------------------------------
        | TRY ONE NEW SECTION
        |--------------------------------------------------------------------------
        */

        const result =
            simulateSection({

                sectionNumber,

                programId,

                yearLevel,

                requirements,

                professorMap,

                rooms,

                windows,

                occupancy:
                    currentOccupancy
            });


        /*
        |--------------------------------------------------------------------------
        | NO MORE CAPACITY FOR THIS PROGRAM/YEAR
        |--------------------------------------------------------------------------
        */

        if (!result.success) {

            log(
                `No more capacity for ` +
                `Program ${programId} ` +
                `${yearLevelMap[yearLevel]}`
            );

            log(
                "Reason:",
                result.reason
            );

            break;
        }


        /*
        |--------------------------------------------------------------------------
        | COMMIT SIMULATION
        |--------------------------------------------------------------------------
        */

        currentOccupancy =
            result.occupancy;


        sectionsCreated++;


        simulatedSections.push({

            sectionNumber,

            assignments:
                result.assignments
        });
    }


    return {

        success:
            sectionsCreated > 0,

        programId,

        yearLevel,

        sectionsCreated,

        additionalCapacity:
            sectionsCreated *
            SECTION_CAPACITY,

        simulatedSections,

        occupancy:
            currentOccupancy
    };
}


/*
|--------------------------------------------------------------------------
| GET PROGRAMS
|--------------------------------------------------------------------------
*/

async function getPrograms() {

    const [rows] = await db.query(`
        SELECT
            id,
            program_name
        FROM programs
        ORDER BY id
    `);

    return rows;
}


/*
|--------------------------------------------------------------------------
| MAIN CAPACITY CHECKER
|--------------------------------------------------------------------------
*/

async function checkEnrollmentCapacity({

    academicTermId

}) {

    log(
        "\n============================================================"
    );

    log(
        "UNIVERSITY CAPACITY SIMULATION"
    );

    log(
        "============================================================"
    );

    log(
        "Academic Term:",
        academicTermId
    );


    /*
    |--------------------------------------------------------------------------
    | LOAD BASE DATA
    |--------------------------------------------------------------------------
    */

    const [
        programs,
        timeSlots,
        rooms,
        existingOccupancy,
        existingSections
    ] = await Promise.all([

        getPrograms(),

        getTimeSlots(),

        getRooms(),

        getExistingOccupancy(
            academicTermId
        ),

        getExistingSections(
            academicTermId
        )
    ]);


    /*
    |--------------------------------------------------------------------------
    | EXISTING SECTION SUMMARY
    |--------------------------------------------------------------------------
    */

    const scheduledSections =
        existingSections.filter(
            section =>
                section.scheduleCount > 0
        );


    const incompleteSections =
        existingSections.filter(
            section =>
                section.scheduleCount === 0
        );


    const existingSectionCapacity =
        scheduledSections.reduce(

            (sum, section) =>
                sum +
                Math.max(
                    SECTION_CAPACITY,
                    section.maxStudents
                ),

            0
        );


    log(
        "Existing sections:",
        existingSections.length
    );

    log(
        "Scheduled sections:",
        scheduledSections.length
    );

    log(
        "Incomplete/unscheduled sections:",
        incompleteSections.length
    );

    log(
        "Existing section capacity:",
        existingSectionCapacity
    );


    /*
    |--------------------------------------------------------------------------
    | RESOURCE SUMMARY
    |--------------------------------------------------------------------------
    */

    const lectureRooms =
        rooms.filter(
            room =>
                String(room.room_type)
                    .toLowerCase() ===
                "lecture"
        );


    const laboratoryRooms =
        rooms.filter(
            room =>
                String(room.room_type)
                    .toLowerCase() ===
                "laboratory"
        );


    /*
    |--------------------------------------------------------------------------
    | GROUP TIME SLOTS
    |--------------------------------------------------------------------------
    */

    const slotsByDay =
        groupSlotsByDay(
            timeSlots
        );


    /*
    |--------------------------------------------------------------------------
    | COLLECT ALL SUBJECT IDS
    |--------------------------------------------------------------------------
    */

    const allSubjectIds =
        new Set();


    const curriculumCache =
        new Map();


    for (const program of programs) {

        for (
            let year = 1;
            year <= 4;
            year++
        ) {

            const subjects =
                await getCurriculum(
                    program.id,
                    year,
                    academicTermId
                );


            curriculumCache.set(
                `${program.id}-${year}`,
                subjects
            );


            for (const subject of subjects) {

                allSubjectIds.add(
                    Number(
                        subject.subject_id
                    )
                );
            }
        }
    }


    /*
    |--------------------------------------------------------------------------
    | PROFESSORS
    |--------------------------------------------------------------------------
    */

    const professorMap =
        await getProfessorMap(
            [...allSubjectIds]
        );


    const uniqueProfessorIds =
        new Set();


    for (
        const professors
        of professorMap.values()
    ) {

        for (const professor of professors) {

            uniqueProfessorIds.add(
                professor.id
            );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | BUILD REQUIRED WINDOWS
    |--------------------------------------------------------------------------
    */

    const requiredHours =
        new Set();


    for (
        const subjects
        of curriculumCache.values()
    ) {

        const requirements =
            buildRequirements(
                subjects
            );


        for (
            const requirement
            of requirements
        ) {

            requiredHours.add(
                requirement.hours
            );
        }
    }


    const windows =
        new Map();


    for (const hours of requiredHours) {

        windows.set(

            hours,

            buildWindows(
                slotsByDay,
                hours
            )
        );
    }


    /*
    |--------------------------------------------------------------------------
    | GLOBAL SIMULATION
    |--------------------------------------------------------------------------
    |
    | CRITICAL:
    |
    | ONE OCCUPANCY MAP FOR THE ENTIRE UNIVERSITY.
    |
    | This prevents:
    |
    | BSCS using Prof 1 Monday 8AM
    | and then
    | BSIT using Prof 1 Monday 8AM
    |
    |--------------------------------------------------------------------------
    */

    let globalOccupancy =
        cloneOccupancy(
            existingOccupancy
        );


    const globalState = {

        nodes: 0
    };


    const programResults = [];


    let additionalSections = 0;

    let additionalCapacity = 0;


    /*
    |--------------------------------------------------------------------------
    | SIMULATE PROGRAMS GLOBALLY
    |--------------------------------------------------------------------------
    */

    for (const program of programs) {

        for (
            let year = 1;
            year <= 4;
            year++
        ) {

            /*
            |--------------------------------------------------------------------------
            | STOP IF GLOBAL LIMIT REACHED
            |--------------------------------------------------------------------------
            */

            if (
                globalState.nodes >
                MAX_GLOBAL_SIMULATION_NODES
            ) {

                break;
            }


            const result =
                await simulateProgramYear({

                    programId:
                        Number(program.id),

                    yearLevel:
                        year,

                    academicTermId,

                    rooms,

                    professorMap,

                    windows,

                    occupancy:
                        globalOccupancy,

                    globalState
                });


            /*
            |--------------------------------------------------------------------------
            | IMPORTANT:
            |
            | KEEP SUCCESSFUL ASSIGNMENTS.
            |--------------------------------------------------------------------------
            */

            if (result.occupancy) {

                globalOccupancy =
                    result.occupancy;
            }


            additionalSections +=
                Number(
                    result.sectionsCreated || 0
                );


            additionalCapacity +=
                Number(
                    result.additionalCapacity || 0
                );


            programResults.push({

                programId:
                    result.programId,

                yearLevel:
                    result.yearLevel,

                sections:
                    result.sectionsCreated || 0,

                capacity:
                    result.additionalCapacity || 0,

                reason:
                    result.reason || null
            });
        }
    }


    /*
    |--------------------------------------------------------------------------
    | STUDENTS
    |--------------------------------------------------------------------------
    */

    const [studentRows] = await db.query(`
        SELECT
            COUNT(*) AS total

        FROM student s

        JOIN student_sections ss
            ON ss.student_id = s.id

        WHERE ss.academic_term_id = ?
    `, [
        academicTermId
    ]);


    const currentStudents =
        Number(
            studentRows[0]?.total || 0
        );


    /*
    |--------------------------------------------------------------------------
    | PENDING APPLICANTS
    |--------------------------------------------------------------------------
    */

    const [pendingRows] = await db.query(`
        SELECT
            COUNT(*) AS total

        FROM student_applications

        WHERE status = 'pending'
    `);


    const pendingApplicants =
        Number(
            pendingRows[0]?.total || 0
        );


    /*
    |--------------------------------------------------------------------------
    | FINAL CAPACITY
    |--------------------------------------------------------------------------
    |
    | EXISTING CAPACITY
    | +
    | NEW SIMULATED CAPACITY
    |
    |--------------------------------------------------------------------------
    */

    const totalUniversityCapacity =
        existingSectionCapacity +
        additionalCapacity;


    const remainingCapacity =
        Math.max(

            0,

            totalUniversityCapacity -
            currentStudents
        );


    const canAccommodate =
        Math.min(

            pendingApplicants,

            remainingCapacity
        );


    const cannotAccommodate =
        Math.max(

            0,

            pendingApplicants -
            remainingCapacity
        );


    /*
    |--------------------------------------------------------------------------
    | LOG RESULT
    |--------------------------------------------------------------------------
    */

    log(
        "\n============================================================"
    );

    log(
        "FINAL CAPACITY RESULT"
    );

    log(
        "============================================================"
    );

    log(
        "Existing scheduled sections:",
        scheduledSections.length
    );

    log(
        "Existing capacity:",
        existingSectionCapacity
    );

    log(
        "Additional sections possible:",
        additionalSections
    );

    log(
        "Additional capacity:",
        additionalCapacity
    );

    log(
        "Total university capacity:",
        totalUniversityCapacity
    );

    log(
        "Current students:",
        currentStudents
    );

    log(
        "Pending applicants:",
        pendingApplicants
    );

    log(
        "Remaining capacity:",
        remainingCapacity
    );

    log(
        "Can accommodate:",
        canAccommodate
    );

    log(
        "Cannot accommodate:",
        cannotAccommodate
    );

    log(
        "Global simulation nodes:",
        globalState.nodes
    );

    log(
        "============================================================"
    );


    /*
    |--------------------------------------------------------------------------
    | RETURN
    |--------------------------------------------------------------------------
    */

    return {

        success: true,

        message:
            "University capacity successfully simulated using scheduler constraints.",

        academicTermId,

        /*
        |--------------------------------------------------------------------------
        | EXISTING
        |--------------------------------------------------------------------------
        */

        existingSections:
            scheduledSections.length,

        existingSectionCapacity,

        incompleteSections:
            incompleteSections.length,

        /*
        |--------------------------------------------------------------------------
        | NEW
        |--------------------------------------------------------------------------
        */

        additionalSections,

        additionalCapacity,

        /*
        |--------------------------------------------------------------------------
        | TOTAL
        |--------------------------------------------------------------------------
        */

        universityCapacity:
            totalUniversityCapacity,

        totalAvailableCapacity:
            totalUniversityCapacity,

        totalUniversityCapacityAfterSimulation:
            totalUniversityCapacity,

        /*
        |--------------------------------------------------------------------------
        | STUDENTS
        |--------------------------------------------------------------------------
        */

        currentStudents,

        pendingApplicants,

        remainingCapacity,

        canAccommodate,

        cannotAccommodate,

        /*
        |--------------------------------------------------------------------------
        | DEBUG
        |--------------------------------------------------------------------------
        */

        simulation: {

            globalNodes:
                globalState.nodes,

            maxGlobalNodes:
                MAX_GLOBAL_SIMULATION_NODES,

            sectionCapacity:
                SECTION_CAPACITY,

            existingSchedulesLocked:
                true
        },

        /*
        |--------------------------------------------------------------------------
        | RESOURCES
        |--------------------------------------------------------------------------
        */

        resources: {

            rooms: {

                total:
                    rooms.length,

                lecture:
                    lectureRooms.length,

                laboratory:
                    laboratoryRooms.length,

                available:
                    rooms
            },

            professors: {

                qualified:
                    uniqueProfessorIds.size,

                totalSubjects:
                    professorMap.size
            },

            timeSlots: {

                total:
                    timeSlots.length,

                windows:
                    Object.fromEntries(

                        [...windows.entries()]
                            .map(
                                ([hours, values]) => [
                                    hours,
                                    values.length
                                ]
                            )
                    )
            }
        },

        /*
        |--------------------------------------------------------------------------
        | PROGRAM RESULTS
        |--------------------------------------------------------------------------
        */

        programResults
    };
}


/*
|--------------------------------------------------------------------------
| EXPRESS CONTROLLER
|--------------------------------------------------------------------------
*/

const checkCapacity = async (req, res) => {

    try {

        const {
            academicTermId
        } = req.query;


        if (!academicTermId) {

            return res.status(400).json({

                success: false,

                message:
                    "academicTermId is required."
            });
        }


        const result =
            await checkEnrollmentCapacity({

                academicTermId
            });


        return res.json(
            result
        );

    } catch (error) {

        console.error(
            "\n[CAPACITY CHECKER ERROR]"
        );

        console.error(error);


        return res.status(500).json({

            success: false,

            message:
                error.message
        });
    }
};


/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = {

    checkEnrollmentCapacity,

    checkCapacity
};