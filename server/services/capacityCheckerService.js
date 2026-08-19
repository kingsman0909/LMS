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
| BASIC MAP HELPERS
|--------------------------------------------------------------------------
*/

function hasConflict(map, resourceId, slots) {

    const occupied = map.get(Number(resourceId));

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

    resourceId = Number(resourceId);

    if (!map.has(resourceId)) {
        map.set(resourceId, new Set());
    }

    const occupied = map.get(resourceId);

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

        reserve(
            occupancy.professorSlots,
            row.professor_id,
            [{ id: row.time_slot_id }]
        );

        reserve(
            occupancy.roomSlots,
            row.room_id,
            [{ id: row.time_slot_id }]
        );
    }

    return occupancy;
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
| BUILD REQUIREMENTS
|--------------------------------------------------------------------------
*/

function buildRequirements(subjects) {

    const requirements = [];

    let id = 0;

    for (const subject of subjects) {

        const lectureUnits =
            Number(subject.lecture_units || 0);

        const labUnits =
            Number(subject.lab_units || 0);


        /*
        |--------------------------------------------------------------------------
        | LECTURE
        |--------------------------------------------------------------------------
        */

        if (lectureUnits > 0) {

            requirements.push({

                id: id++,

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

                id: id++,

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
| VALID ROOM
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

            String(room.room_type).toLowerCase() ===
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
    | TRY EVERY RESOURCE COMBINATION
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


                /*
                |--------------------------------------------------------------------------
                | VALID ASSIGNMENT
                |--------------------------------------------------------------------------
                */

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
            `exhausted for ${requirement.subject_code} ` +
            `(${requirement.type})`
    };
}


/*
|--------------------------------------------------------------------------
| SIMULATE ONE SECTION
|--------------------------------------------------------------------------
*/

function simulateSection({

    sectionNumber,

    requirements,

    professorMap,

    rooms,

    windows,

    occupancy
}) {

    log(
        `\n========== SIMULATING SECTION ${sectionNumber} ==========`
    );


    const sectionId =
        `SIMULATED-${sectionNumber}`;


    const sectionOccupiedSlots =
        new Set();


    const assignments = [];


    /*
    |--------------------------------------------------------------------------
    | IMPORTANT:
    | HARDEST REQUIREMENTS FIRST
    |--------------------------------------------------------------------------
    |
    | Lab first because laboratories normally have fewer rooms.
    |
    */

    const sortedRequirements =
        [...requirements].sort((a, b) => {

            if (
                a.type !== b.type
            ) {

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


    /*
    |--------------------------------------------------------------------------
    | DO NOT MUTATE ORIGINAL OCCUPANCY UNTIL COMPLETE
    |--------------------------------------------------------------------------
    */

    const tempOccupancy =
        cloneOccupancy(occupancy);


    /*
    |--------------------------------------------------------------------------
    | TRY EACH SUBJECT
    |--------------------------------------------------------------------------
    */

    for (const requirement of sortedRequirements) {

        const professors =
            professorMap.get(
                Number(requirement.subject_id)
            ) || [];


        const suitableRooms =
            getSuitableRooms(
                requirement,
                rooms
            );


        const candidateWindows =
            windows.get(
                Number(requirement.hours)
            ) || [];


        log(
            `${requirement.subject_code} ` +
            `${requirement.type}`
        );

        log(
            "  professors:",
            professors.length
        );

        log(
            "  rooms:",
            suitableRooms.length
        );

        log(
            "  windows:",
            candidateWindows.length
        );


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


        if (!result.success) {

            log(
                "  ❌ FAILED:",
                result.reason
            );


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
        | RESERVE SIMULATED RESOURCES
        |--------------------------------------------------------------------------
        */

        reserve(
            tempOccupancy.professorSlots,

            assignment.professor.id,

            assignment.window.slots
        );


        reserve(
            tempOccupancy.roomSlots,

            assignment.room.id,

            assignment.window.slots
        );


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


        log(
            `  ✅ ${requirement.subject_code} ` +
            `→ Prof ${assignment.professor.id} ` +
            `→ Room ${assignment.room.id} ` +
            `→ ${assignment.window.day} ` +
            `(${assignment.window.slots[0].start_time} - ` +
            `${assignment.window.slots.at(-1).end_time})`
        );
    }


    /*
    |--------------------------------------------------------------------------
    | SECTION SUCCESS
    |--------------------------------------------------------------------------
    */

    log(
        `✅ SECTION ${sectionNumber} SUCCESS`
    );


    return {

        success: true,

        assignments,

        occupancy:
            tempOccupancy
    };
}


/*
|--------------------------------------------------------------------------
| SIMULATE PROGRAM / YEAR
|--------------------------------------------------------------------------
*/

async function simulateProgramYear({

    programId,

    yearLevel,

    academicTermId,

    rooms,

    professorMap,

    windows,

    baseOccupancy
}) {

    const programName =
        `Program ${programId}`;


    log(
        "\n------------------------------------------------------------"
    );

    log(
        `SIMULATING ${programName}`
    );

    log(
        `YEAR LEVEL: ${yearLevelMap[yearLevel]}`
    );

    log(
        "------------------------------------------------------------"
    );


    /*
    |--------------------------------------------------------------------------
    | CURRICULUM
    |--------------------------------------------------------------------------
    */

    const subjects =
        await getCurriculum(
            programId,
            yearLevel,
            academicTermId
        );


    log(
        "Curriculum subjects:",
        subjects.length
    );


    if (!subjects.length) {

        return {

            success: false,

            programId,

            yearLevel,

            sections: 0,

            capacity: 0,

            reason:
                "No curriculum subjects."
        };
    }


    console.table(
        subjects.map(subject => ({

            subject_id:
                subject.subject_id,

            code:
                subject.subject_code,

            name:
                subject.subject_name,

            lecture:
                subject.lecture_units,

            lab:
                subject.lab_units
        }))
    );


    /*
    |--------------------------------------------------------------------------
    | REQUIREMENTS
    |--------------------------------------------------------------------------
    */

    const requirements =
        buildRequirements(
            subjects
        );


    log(
        "Requirements:",
        requirements.length
    );


    console.table(
        requirements.map(r => ({

            subject_id:
                r.subject_id,

            subject:
                r.subject_code,

            type:
                r.type,

            hours:
                r.hours
        }))
    );


    /*
    |--------------------------------------------------------------------------
    | NO REQUIREMENTS
    |--------------------------------------------------------------------------
    */

    if (!requirements.length) {

        return {

            success: false,

            programId,

            yearLevel,

            sections: 0,

            capacity: 0,

            reason:
                "No lecture/laboratory requirements."
        };
    }


    /*
    |--------------------------------------------------------------------------
    | SIMULATE SECTIONS
    |--------------------------------------------------------------------------
    */

    let currentOccupancy =
        cloneOccupancy(
            baseOccupancy
        );


    let sectionsCreated = 0;

    let totalAssignments = 0;

    const simulatedSections = [];


    for (
        let sectionNumber = 1;

        sectionNumber <= MAX_SIMULATED_SECTIONS;

        sectionNumber++
    ) {

        const result =
            simulateSection({

                sectionNumber,

                requirements,

                professorMap,

                rooms,

                windows,

                occupancy:
                    currentOccupancy
            });


        if (!result.success) {

            log(
                `❌ STOPPING ${programName} ` +
                `${yearLevelMap[yearLevel]}`
            );

            log(
                "Failure:",
                result.reason
            );

            break;
        }


        /*
        |--------------------------------------------------------------------------
        | COMMIT SIMULATED RESOURCES
        |--------------------------------------------------------------------------
        */

        currentOccupancy =
            result.occupancy;


        sectionsCreated++;

        totalAssignments +=
            result.assignments.length;


        simulatedSections.push({

            sectionNumber,

            assignments:
                result.assignments
        });


        log(
            `Sections simulated: ${sectionsCreated}`
        );

        log(
            `Simulated seats: ` +
            `${sectionsCreated * SECTION_CAPACITY}`
        );
    }


    /*
    |--------------------------------------------------------------------------
    | RESULT
    |--------------------------------------------------------------------------
    */

    const capacity =
        sectionsCreated *
        SECTION_CAPACITY;


    log(
        "\n**************** PROGRAM RESULT ****************"
    );

    log(
        `Program: ${programName}`
    );

    log(
        `Year: ${yearLevelMap[yearLevel]}`
    );

    log(
        `Sections: ${sectionsCreated}`
    );

    log(
        `Capacity: ${capacity}`
    );

    log(
        `Assignments: ${totalAssignments}`
    );

    log(
        "************************************************"
    );


    return {

        success:
            sectionsCreated > 0,

        programId,

        yearLevel,

        sections:
            sectionsCreated,

        capacity,

        assignments:
            totalAssignments,

        simulatedSections
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
    | LOAD RESOURCES
    |--------------------------------------------------------------------------
    */

    const [
        programs,
        timeSlots,
        rooms,
        existingOccupancy
    ] = await Promise.all([

        getPrograms(),

        getTimeSlots(),

        getRooms(),

        getExistingOccupancy(
            academicTermId
        )
    ]);


    log(
        "\nRESOURCE SUMMARY"
    );

    log(
        "Programs:",
        programs.length
    );

    log(
        "Time slots:",
        timeSlots.length
    );

    log(
        "Rooms:",
        rooms.length
    );


    /*
    |--------------------------------------------------------------------------
    | ROOM SUMMARY
    |--------------------------------------------------------------------------
    */

    const lectureRooms =
        rooms.filter(
            r =>
                String(r.room_type)
                    .toLowerCase() ===
                "lecture"
        );


    const laboratoryRooms =
        rooms.filter(
            r =>
                String(r.room_type)
                    .toLowerCase() ===
                "laboratory"
        );


    log(
        "Lecture rooms:",
        lectureRooms.length
    );

    log(
        "Laboratory rooms:",
        laboratoryRooms.length
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


            for (const subject of subjects) {

                allSubjectIds.add(
                    Number(subject.subject_id)
                );
            }
        }
    }


    log(
        "Unique curriculum subjects:",
        allSubjectIds.size
    );


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


    log(
        "Qualified professors:",
        uniqueProfessorIds.size
    );


    /*
    |--------------------------------------------------------------------------
    | BUILD WINDOWS
    |--------------------------------------------------------------------------
    */

    const requiredHours =
        new Set();


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
    }


    const windows =
        new Map();


    for (const hours of requiredHours) {

        const generated =
            buildWindows(
                slotsByDay,
                hours
            );


        windows.set(
            hours,
            generated
        );


        log(
            `${hours}-hour windows:`,
            generated.length
        );
    }


    /*
    |--------------------------------------------------------------------------
    | SIMULATE EVERY PROGRAM / YEAR
    |--------------------------------------------------------------------------
    */

    const programResults = [];


    for (const program of programs) {

        for (
            let year = 1;
            year <= 4;
            year++
        ) {

            const result =
                await simulateProgramYear({

                    programId:
                        program.id,

                    yearLevel:
                        year,

                    academicTermId,

                    rooms,

                    professorMap,

                    windows,

                    baseOccupancy:
                        existingOccupancy
                });


            programResults.push(
                result
            );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | UNIVERSITY TOTAL
    |--------------------------------------------------------------------------
    */

    const totalAvailableCapacity =
        programResults.reduce(

            (sum, result) =>
                sum +
                Number(
                    result.capacity || 0
                ),

            0
        );


    /*
    |--------------------------------------------------------------------------
    | EXISTING STUDENTS
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
    |
    | IMPORTANT:
    |
    | Pending applicants DO NOT control the simulation.
    |
    | They are only used AFTER we calculate capacity.
    |
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
    | FINAL CALCULATION
    |--------------------------------------------------------------------------
    */

    const remainingCapacity =
        Math.max(
            0,
            totalAvailableCapacity -
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
    | FINAL DEBUG
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
        "Current students:",
        currentStudents
    );

    log(
        "Pending applicants:",
        pendingApplicants
    );

    log(
        "Simulated university capacity:",
        totalAvailableCapacity
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
            "University capacity successfully simulated.",

        academicTermId,

        currentStudents,

        pendingApplicants,

        universityCapacity:
            totalAvailableCapacity,

        totalAvailableCapacity,

        totalUniversityCapacityAfterSimulation:
            totalAvailableCapacity,

        remainingCapacity,

        canAccommodate,

        cannotAccommodate,

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

        console.error(
            error
        );


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