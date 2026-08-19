const db = require("../config/db");

/*
|--------------------------------------------------------------------------
| CONFIG
|--------------------------------------------------------------------------
|
| MUST MATCH YOUR SCHEDULER / SECTION CAPACITY
|
*/

const SECTION_CAPACITY = 50;

const DAY_ORDER = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
];

const MAX_SEARCH_NODES_PER_SECTION = 30000;
const MAX_TIME_MS_PER_SECTION = 5000;

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

const createOccupancy = () => {

    return {

        professorSlots: new Map(),

        roomSlots: new Map()
    };
};


const hasConflict = (
    map,
    resourceId,
    slots
) => {

    const id =
        Number(resourceId);

    const occupied =
        map.get(id);

    if (!occupied) {
        return false;
    }

    for (const slot of slots) {

        if (
            occupied.has(
                Number(slot.id)
            )
        ) {
            return true;
        }
    }

    return false;
};


const reserve = (
    map,
    resourceId,
    slots
) => {

    const id =
        Number(resourceId);

    if (!map.has(id)) {

        map.set(
            id,
            new Set()
        );
    }

    const occupied =
        map.get(id);

    for (const slot of slots) {

        occupied.add(
            Number(slot.id)
        );
    }
};


const release = (
    map,
    resourceId,
    slots
) => {

    const id =
        Number(resourceId);

    const occupied =
        map.get(id);

    if (!occupied) {
        return;
    }

    for (const slot of slots) {

        occupied.delete(
            Number(slot.id)
        );
    }

    if (
        occupied.size === 0
    ) {

        map.delete(id);
    }
};


const cloneOccupancy = (
    occupancy
) => {

    return {

        professorSlots:
            new Map(
                [
                    ...occupancy
                        .professorSlots
                        .entries()
                ].map(
                    ([id, slots]) => [
                        id,
                        new Set(slots)
                    ]
                )
            ),

        roomSlots:
            new Map(
                [
                    ...occupancy
                        .roomSlots
                        .entries()
                ].map(
                    ([id, slots]) => [
                        id,
                        new Set(slots)
                    ]
                )
            )
    };
};


/*
|--------------------------------------------------------------------------
| TIME SLOTS
|--------------------------------------------------------------------------
*/

const getTimeSlots = async () => {

    const [rows] =
        await db.query(`

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
};


const groupSlotsByDay = (
    slots
) => {

    const map =
        new Map();

    for (
        const day
        of DAY_ORDER
    ) {

        map.set(
            day,
            []
        );
    }

    for (
        const slot
        of slots
    ) {

        if (
            !map.has(
                slot.day
            )
        ) {

            map.set(
                slot.day,
                []
            );
        }

        map.get(
            slot.day
        ).push(slot);
    }

    return map;
};


const buildWindows = (
    slotsByDay,
    hours
) => {

    const windows = [];

    const requiredHours =
        Number(hours);

    for (
        const day
        of DAY_ORDER
    ) {

        const daySlots =
            slotsByDay.get(day) || [];

        if (
            daySlots.length <
            requiredHours
        ) {

            continue;
        }

        for (
            let i = 0;

            i <=
            daySlots.length -
            requiredHours;

            i++
        ) {

            const candidate =
                daySlots.slice(
                    i,
                    i + requiredHours
                );

            let consecutive =
                true;

            for (
                let j = 1;

                j <
                candidate.length;

                j++
            ) {

                if (
                    candidate[j - 1].end_time !==
                    candidate[j].start_time
                ) {

                    consecutive =
                        false;

                    break;
                }
            }

            if (!consecutive) {
                continue;
            }

            windows.push({

                day,

                slots:
                    candidate
            });
        }
    }

    return windows;
};


/*
|--------------------------------------------------------------------------
| ROOMS
|--------------------------------------------------------------------------
*/

const getRooms = async () => {

    const [rows] =
        await db.query(`

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

    return rows.map(
        room => ({

            ...room,

            id:
                Number(room.id),

            capacity:
                Number(room.capacity)

        })
    );
};


/*
|--------------------------------------------------------------------------
| PROFESSORS
|--------------------------------------------------------------------------
*/

const getProfessorMap = async (
    subjectIds
) => {

    const map =
        new Map();

    if (
        subjectIds.length === 0
    ) {

        return map;
    }

    const placeholders =
        subjectIds
            .map(() => "?")
            .join(",");

    const [rows] =
        await db.query(`

            SELECT

                ps.subject_id,

                p.id,
                p.employee_id,
                p.firstname,
                p.lastname,
                p.department

            FROM professor_subjects ps

            JOIN profesor p
                ON p.id =
                   ps.professor_id

            WHERE
                ps.subject_id
                IN (${placeholders})

            ORDER BY
                ps.subject_id,
                p.id

        `, subjectIds);

    for (
        const row
        of rows
    ) {

        const subjectId =
            Number(
                row.subject_id
            );

        if (
            !map.has(
                subjectId
            )
        ) {

            map.set(
                subjectId,
                []
            );
        }

        map.get(
            subjectId
        ).push({

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
};


/*
|--------------------------------------------------------------------------
| EXISTING OCCUPANCY
|--------------------------------------------------------------------------
*/

const getExistingOccupancy = async (
    academicTermId
) => {

    const occupancy =
        createOccupancy();

    const [rows] =
        await db.query(`

            SELECT

                cs.professor_id,
                cs.room_id,
                cs.time_slot_id

            FROM class_schedules cs

            WHERE
                cs.academic_term_id = ?

        `, [
            academicTermId
        ]);

    log(
        "Existing schedule rows:",
        rows.length
    );

    for (
        const row
        of rows
    ) {

        if (
            row.professor_id != null
        ) {

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

        if (
            row.room_id != null
        ) {

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

    return {
        occupancy,
        rows
    };
};


/*
|--------------------------------------------------------------------------
| EXISTING SECTIONS
|--------------------------------------------------------------------------
*/

const getExistingSections = async (
    academicTermId
) => {

    const [rows] =
        await db.query(`

            SELECT

                s.id,
                s.section_name,
                s.program_id,
                s.year_level,
                s.max_students,

                COUNT(
                    DISTINCT cs.id
                ) AS schedule_count,

                COUNT(
                    DISTINCT ss.student_id
                ) AS student_count

            FROM sections s

            LEFT JOIN class_schedules cs
                ON cs.section_id =
                   s.id

                AND cs.academic_term_id = ?

            LEFT JOIN student_sections ss
                ON ss.section_id =
                   s.id

                AND ss.academic_term_id = ?

            WHERE
                s.academic_term_id = ?

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

    return rows.map(
        row => ({

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
        })
    );
};


/*
|--------------------------------------------------------------------------
| CURRICULUM
|--------------------------------------------------------------------------
*/

const getCurriculum = async (
    programId,
    yearLevel,
    academicTermId
) => {

    const normalizedYear =
        yearLevelMap[
            Number(yearLevel)
        ];

    const [rows] =
        await db.query(`

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
                ON sub.id =
                   cs.subject_id

            JOIN academic_terms at
                ON at.id = ?

            WHERE
                cs.program_id = ?

            AND
                cs.year_level = ?

            AND
                cs.semester =
                at.semester

            ORDER BY
                sub.subject_code

        `, [
            academicTermId,
            programId,
            normalizedYear
        ]);

    return rows;
};


/*
|--------------------------------------------------------------------------
| REQUIREMENTS
|--------------------------------------------------------------------------
*/

const buildRequirements = (
    subjects
) => {

    const requirements = [];

    let id = 0;

    for (
        const subject
        of subjects
    ) {

        const lectureUnits =
            Number(
                subject.lecture_units || 0
            );

        const labUnits =
            Number(
                subject.lab_units || 0
            );

        if (
            lectureUnits > 0
        ) {

            requirements.push({

                id:
                    id++,

                subject_id:
                    Number(
                        subject.subject_id
                    ),

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

        if (
            labUnits > 0
        ) {

            requirements.push({

                id:
                    id++,

                subject_id:
                    Number(
                        subject.subject_id
                    ),

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
};


/*
|--------------------------------------------------------------------------
| ROOM FILTER
|--------------------------------------------------------------------------
*/

const getSuitableRooms = (
    requirement,
    rooms
) => {

    const requiredType =
        requirement.type ===
        "laboratory"
            ? "laboratory"
            : "lecture";

    return rooms.filter(
        room => {

            return (

                String(
                    room.room_type
                ).toLowerCase() ===
                requiredType

                &&

                Number(
                    room.capacity
                ) >=
                SECTION_CAPACITY

            );
        }
    );
};


/*
|--------------------------------------------------------------------------
| RESOURCE DIAGNOSTICS
|--------------------------------------------------------------------------
|
| This is the important part.
|
| Instead of simply saying:
|
| "No available schedule"
|
| we determine WHICH resource caused the failure.
|
*/

const diagnoseRequirement = ({
    requirement,
    professors,
    rooms,
    windows,
    occupancy
}) => {

    const diagnostics = {

        subject:
            requirement.subject_code,

        type:
            requirement.type,

        requiredHours:
            requirement.hours,

        qualifiedProfessors:
            professors.length,

        suitableRooms:
            rooms.length,

        availableWindows:
            windows.length,

        professorBlocked: 0,

        roomBlocked: 0,

        timeslotBlocked: 0,

        combinationBlocked: 0
    };


    if (
        professors.length === 0
    ) {

        return {

            bottleneck:
                "PROFESSOR_AVAILABILITY",

            reason:
                `No qualified professor for ` +
                `${requirement.subject_code}.`,

            diagnostics
        };
    }


    if (
        rooms.length === 0
    ) {

        return {

            bottleneck:
                "ROOM_CAPACITY",

            reason:
                `No suitable ${requirement.type} room ` +
                `with capacity ${SECTION_CAPACITY}.`,

            diagnostics
        };
    }


    if (
        windows.length === 0
    ) {

        return {

            bottleneck:
                "TIME_SLOT_AVAILABILITY",

            reason:
                `No ${requirement.hours}-hour consecutive ` +
                `time window exists.`,

            diagnostics
        };
    }


    /*
    |--------------------------------------------------------------------------
    | Check each window
    |--------------------------------------------------------------------------
    */

    let anyProfessorAvailable =
        false;

    let anyRoomAvailable =
        false;

    let anyTimeWindowAvailable =
        false;

    let anyCompleteCombination =
        false;


    for (
        const window
        of windows
    ) {

        let windowHasProfessor =
            false;

        let windowHasRoom =
            false;


        /*
        |----------------------------------------------------------------------
        | PROFESSORS
        |----------------------------------------------------------------------
        */

        for (
            const professor
            of professors
        ) {

            if (
                !hasConflict(
                    occupancy.professorSlots,
                    professor.id,
                    window.slots
                )
            ) {

                windowHasProfessor =
                    true;

                anyProfessorAvailable =
                    true;

                break;
            }
        }


        /*
        |----------------------------------------------------------------------
        | ROOMS
        |----------------------------------------------------------------------
        */

        for (
            const room
            of rooms
        ) {

            if (
                !hasConflict(
                    occupancy.roomSlots,
                    room.id,
                    window.slots
                )
            ) {

                windowHasRoom =
                    true;

                anyRoomAvailable =
                    true;

                break;
            }
        }


        if (
            !windowHasProfessor
        ) {

            diagnostics.professorBlocked++;
        }


        if (
            !windowHasRoom
        ) {

            diagnostics.roomBlocked++;
        }


        /*
        |----------------------------------------------------------------------
        | COMPLETE PROFESSOR + ROOM COMBINATION
        |----------------------------------------------------------------------
        */

        if (
            windowHasProfessor &&
            windowHasRoom
        ) {

            anyCompleteCombination =
                true;

            anyTimeWindowAvailable =
                true;

            break;
        }


        if (
            !windowHasProfessor &&
            !windowHasRoom
        ) {

            diagnostics.timeslotBlocked++;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Determine actual bottleneck
    |--------------------------------------------------------------------------
    */

    if (
        anyCompleteCombination
    ) {

        return {

            bottleneck:
                "NONE",

            reason:
                "At least one professor + room + timeslot combination is available.",

            diagnostics
        };
    }


    if (
        !anyProfessorAvailable
    ) {

        return {

            bottleneck:
                "PROFESSOR_CAPACITY",

            reason:
                `All qualified professors for ` +
                `${requirement.subject_code} ` +
                `are occupied during all possible ` +
                `${requirement.hours}-hour windows.`,

            diagnostics
        };
    }


    if (
        !anyRoomAvailable
    ) {

        return {

            bottleneck:
                "ROOM_CAPACITY",

            reason:
                `All suitable ${requirement.type} rooms ` +
                `are occupied during all possible ` +
                `${requirement.hours}-hour windows.`,

            diagnostics
        };
    }


    if (
        !anyTimeWindowAvailable
    ) {

        return {

            bottleneck:
                "TIME_SLOT_CAPACITY",

            reason:
                `No usable time slot remains after ` +
                `considering existing professor and room occupancy.`,

            diagnostics
        };
    }


    return {

        bottleneck:
            "COMBINATION_CONFLICT",

        reason:
            `Professor, room and timeslot resources exist ` +
            `individually, but no valid combination exists ` +
            `for ${requirement.subject_code}.`,

        diagnostics
    };
};


/*
|--------------------------------------------------------------------------
| ASSIGNMENT CONFLICT
|--------------------------------------------------------------------------
*/

const assignmentHasConflict = (
    assignment,
    occupancy,
    sectionOccupiedSlots
) => {

    /*
    |----------------------------------------------------------------------
    | SECTION
    |----------------------------------------------------------------------
    */

    for (
        const slot
        of assignment.window.slots
    ) {

        if (
            sectionOccupiedSlots.has(
                Number(slot.id)
            )
        ) {

            return true;
        }
    }


    /*
    |----------------------------------------------------------------------
    | PROFESSOR
    |----------------------------------------------------------------------
    */

    if (
        hasConflict(
            occupancy.professorSlots,
            assignment.professor.id,
            assignment.window.slots
        )
    ) {

        return true;
    }


    /*
    |----------------------------------------------------------------------
    | ROOM
    |----------------------------------------------------------------------
    */

    if (
        hasConflict(
            occupancy.roomSlots,
            assignment.room.id,
            assignment.window.slots
        )
    ) {

        return true;
    }


    return false;
};


/*
|--------------------------------------------------------------------------
| SCORE
|--------------------------------------------------------------------------
*/

const scoreAssignment = (
    assignment,
    occupancy
) => {

    const professorLoad =
        occupancy.professorSlots
            .get(
                assignment.professor.id
            )?.size || 0;

    const roomLoad =
        occupancy.roomSlots
            .get(
                assignment.room.id
            )?.size || 0;


    /*
    |--------------------------------------------------------------------------
    | SAME IDEA AS YOUR SCHEDULER
    |--------------------------------------------------------------------------
    */

    return (

        professorLoad * 1000

        +

        roomLoad * 100

        +

        Number(
            assignment.room.capacity
        )

    );
};


/*
|--------------------------------------------------------------------------
| GET VALID CANDIDATES
|--------------------------------------------------------------------------
*/

const getValidCandidates = (
    requirement,
    candidateMap,
    occupancy,
    sectionOccupiedSlots
) => {

    const candidates =
        candidateMap.get(
            requirement.id
        ) || [];

    const valid = [];

    for (
        const candidate
        of candidates
    ) {

        if (
            assignmentHasConflict(
                candidate,
                occupancy,
                sectionOccupiedSlots
            )
        ) {

            continue;
        }

        valid.push(
            candidate
        );
    }

    return valid;
};


/*
|--------------------------------------------------------------------------
| BUILD STATIC CANDIDATES
|--------------------------------------------------------------------------
*/

const buildCandidateList = (
    requirement,
    sectionId,
    windows,
    professors,
    rooms
) => {

    const candidates = [];

    for (
        const window
        of windows
    ) {

        for (
            const professor
            of professors
        ) {

            for (
                const room
                of rooms
            ) {

                candidates.push({

                    sectionId,

                    requirement,

                    professor,

                    room,

                    window

                });
            }
        }
    }

    return candidates;
};


/*
|--------------------------------------------------------------------------
| BUILD CANDIDATE MAP
|--------------------------------------------------------------------------
*/

const buildCandidateMap = ({
    sectionId,
    requirements,
    professorMap,
    rooms,
    windows
}) => {

    const candidateMap =
        new Map();

    const diagnostics =
        [];


    for (
        const requirement
        of requirements
    ) {

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


        const requirementWindows =
            windows.get(
                Number(
                    requirement.hours
                )
            ) || [];


        const diagnosis =
            diagnoseRequirement({

                requirement,

                professors,

                rooms:
                    suitableRooms,

                windows:
                    requirementWindows,

                occupancy:
                    {
                        professorSlots:
                            new Map(),

                        roomSlots:
                            new Map()
                    }
            });


        /*
        |--------------------------------------------------------------------------
        | We still build candidates even if they may be
        | blocked by existing schedules.
        |--------------------------------------------------------------------------
        */

        const candidates =
            buildCandidateList(

                requirement,

                sectionId,

                requirementWindows,

                professors,

                suitableRooms

            );


        candidateMap.set(
            requirement.id,
            candidates
        );


        diagnostics.push({

            requirement,

            qualifiedProfessors:
                professors.length,

            suitableRooms:
                suitableRooms.length,

            windows:
                requirementWindows.length,

            staticCandidates:
                candidates.length
        });


        log(
            `${requirement.subject_code} ` +
            `${requirement.type}: ` +
            `${candidates.length} candidates`
        );
    }


    return {
        candidateMap,
        diagnostics
    };
};


/*
|--------------------------------------------------------------------------
| SOLVE ONE SIMULATED SECTION
|--------------------------------------------------------------------------
|
| THIS IS NOW THE SAME BASIC SOLVING STRATEGY
| AS YOUR REAL SCHEDULER.
|
| MRV
| BACKTRACKING
| FORWARD CHECKING
|
*/

const solveSimulatedSection = ({
    sectionId,
    requirements,
    candidateMap,
    occupancy
}) => {

    const startTime =
        Date.now();

    let searchNodes =
        0;

    const assignments =
        [];

    const assignedIds =
        new Set();

    const sectionOccupiedSlots =
        new Set();


    const backtrack = () => {

        searchNodes++;


        /*
        |--------------------------------------------------------------------------
        | LIMITS
        |--------------------------------------------------------------------------
        */

        if (
            searchNodes >
            MAX_SEARCH_NODES_PER_SECTION
        ) {

            return false;
        }


        if (
            Date.now() -
            startTime >
            MAX_TIME_MS_PER_SECTION
        ) {

            return false;
        }


        /*
        |--------------------------------------------------------------------------
        | COMPLETE
        |--------------------------------------------------------------------------
        */

        if (
            assignedIds.size ===
            requirements.length
        ) {

            return true;
        }


        /*
        |--------------------------------------------------------------------------
        | MRV
        |--------------------------------------------------------------------------
        */

        let selectedRequirement =
            null;

        let selectedCandidates =
            null;

        let smallestCount =
            Infinity;


        for (
            const requirement
            of requirements
        ) {

            if (
                assignedIds.has(
                    requirement.id
                )
            ) {

                continue;
            }


            const validCandidates =
                getValidCandidates(

                    requirement,

                    candidateMap,

                    occupancy,

                    sectionOccupiedSlots

                );


            if (
                validCandidates.length === 0
            ) {

                return false;
            }


            if (
                validCandidates.length <
                smallestCount
            ) {

                smallestCount =
                    validCandidates.length;

                selectedRequirement =
                    requirement;

                selectedCandidates =
                    validCandidates;
            }
        }


        if (
            !selectedRequirement
        ) {

            return false;
        }


        /*
        |--------------------------------------------------------------------------
        | SCORE
        |--------------------------------------------------------------------------
        */

        selectedCandidates.sort(
            (a, b) => {

                return (

                    scoreAssignment(
                        a,
                        occupancy
                    )

                    -

                    scoreAssignment(
                        b,
                        occupancy
                    )

                );
            }
        );


        /*
        |--------------------------------------------------------------------------
        | TRY CANDIDATES
        |--------------------------------------------------------------------------
        */

        for (
            const candidate
            of selectedCandidates
        ) {

            if (
                searchNodes >
                MAX_SEARCH_NODES_PER_SECTION
            ) {

                return false;
            }


            if (
                Date.now() -
                startTime >
                MAX_TIME_MS_PER_SECTION
            ) {

                return false;
            }


            if (
                assignmentHasConflict(
                    candidate,
                    occupancy,
                    sectionOccupiedSlots
                )
            ) {

                continue;
            }


            reserve(

                occupancy.professorSlots,

                candidate.professor.id,

                candidate.window.slots

            );


            reserve(

                occupancy.roomSlots,

                candidate.room.id,

                candidate.window.slots

            );


            for (
                const slot
                of candidate.window.slots
            ) {

                sectionOccupiedSlots.add(
                    Number(slot.id)
                );
            }


            assignments.push(
                candidate
            );


            assignedIds.add(
                selectedRequirement.id
            );


            /*
            |--------------------------------------------------------------------------
            | FORWARD CHECKING
            |--------------------------------------------------------------------------
            */

            let possible =
                true;


            for (
                const requirement
                of requirements
            ) {

                if (
                    assignedIds.has(
                        requirement.id
                    )
                ) {

                    continue;
                }


                const valid =
                    getValidCandidates(

                        requirement,

                        candidateMap,

                        occupancy,

                        sectionOccupiedSlots

                    );


                if (
                    valid.length === 0
                ) {

                    possible =
                        false;

                    break;
                }
            }


            if (
                possible &&
                backtrack()
            ) {

                return true;
            }


            /*
            |--------------------------------------------------------------------------
            | UNDO
            |--------------------------------------------------------------------------
            */

            assignedIds.delete(
                selectedRequirement.id
            );


            assignments.pop();


            release(

                occupancy.professorSlots,

                candidate.professor.id,

                candidate.window.slots

            );


            release(

                occupancy.roomSlots,

                candidate.room.id,

                candidate.window.slots

            );


            for (
                const slot
                of candidate.window.slots
            ) {

                sectionOccupiedSlots.delete(
                    Number(slot.id)
                );
            }
        }


        return false;
    };


    const success =
        backtrack();


    return {

        success,

        assignments:
            success
                ? [...assignments]
                : [],

        searchNodes,

        elapsed:
            Date.now() -
            startTime
    };
};


/*
|--------------------------------------------------------------------------
| DIAGNOSE FAILED SECTION
|--------------------------------------------------------------------------
*/

const diagnoseFailedSection = ({
    requirements,
    candidateMap,
    occupancy
}) => {

    const sectionOccupiedSlots =
        new Set();

    const failures =
        [];


    for (
        const requirement
        of requirements
    ) {

        const professors =
            [
                ...new Map(

                    (
                        candidateMap
                            .get(
                                requirement.id
                            ) || []
                    ).map(
                        candidate => [
                            candidate.professor.id,
                            candidate.professor
                        ]
                    )

                ).values()
            ];


        const rooms =
            [
                ...new Map(

                    (
                        candidateMap
                            .get(
                                requirement.id
                            ) || []
                    ).map(
                        candidate => [
                            candidate.room.id,
                            candidate.room
                        ]
                    )

                ).values()
            ];


        const windows =
            [
                ...new Map(

                    (
                        candidateMap
                            .get(
                                requirement.id
                            ) || []
                    ).map(
                        candidate => [

                            candidate.window.day +
                            ":" +
                            candidate.window
                                .slots[0]
                                .id,

                            candidate.window

                        ]
                    )

                ).values()
            ];


        /*
        |--------------------------------------------------------------------------
        | Static resource check
        |--------------------------------------------------------------------------
        */

        if (
            professors.length === 0
        ) {

            failures.push({

                subject:
                    requirement.subject_code,

                type:
                    requirement.type,

                bottleneck:
                    "NO_QUALIFIED_PROFESSOR",

                reason:
                    `No professor is qualified to teach ` +
                    `${requirement.subject_code}.`

            });

            continue;
        }


        if (
            rooms.length === 0
        ) {

            failures.push({

                subject:
                    requirement.subject_code,

                type:
                    requirement.type,

                bottleneck:
                    "NO_ROOM",

                reason:
                    `No ${requirement.type} room can ` +
                    `accommodate ${SECTION_CAPACITY} students.`

            });

            continue;
        }


        if (
            windows.length === 0
        ) {

            failures.push({

                subject:
                    requirement.subject_code,

                type:
                    requirement.type,

                bottleneck:
                    "NO_TIME_WINDOW",

                reason:
                    `No ${requirement.hours}-hour consecutive ` +
                    `time window exists.`

            });

            continue;
        }


        /*
        |--------------------------------------------------------------------------
        | Check resources against current global occupancy
        |--------------------------------------------------------------------------
        */

        let professorAvailable =
            false;

        let roomAvailable =
            false;

        let windowAvailable =
            false;

        let combinationAvailable =
            false;


        for (
            const window
            of windows
        ) {

            let professorFree =
                false;

            let roomFree =
                false;


            for (
                const professor
                of professors
            ) {

                if (
                    !hasConflict(

                        occupancy
                            .professorSlots,

                        professor.id,

                        window.slots

                    )
                ) {

                    professorFree =
                        true;

                    professorAvailable =
                        true;

                    break;
                }
            }


            for (
                const room
                of rooms
            ) {

                if (
                    !hasConflict(

                        occupancy
                            .roomSlots,

                        room.id,

                        window.slots

                    )
                ) {

                    roomFree =
                        true;

                    roomAvailable =
                        true;

                    break;
                }
            }


            if (
                professorFree ||
                roomFree
            ) {

                windowAvailable =
                    true;
            }


            if (
                professorFree &&
                roomFree
            ) {

                combinationAvailable =
                    true;

                break;
            }
        }


        let bottleneck =
            "COMBINATION_CONFLICT";

        let reason =
            `Professor, room, and time slots exist, ` +
            `but no valid combination remains.`;


        if (
            !professorAvailable
        ) {

            bottleneck =
                "PROFESSOR_CAPACITY";

            reason =
                `All qualified professors for ` +
                `${requirement.subject_code} ` +
                `are occupied in all possible windows.`;
        }

        else if (
            !roomAvailable
        ) {

            bottleneck =
                "ROOM_CAPACITY";

            reason =
                `All suitable ${requirement.type} rooms ` +
                `are occupied in all possible windows.`;
        }

        else if (
            !windowAvailable
        ) {

            bottleneck =
                "TIME_SLOT_CAPACITY";

            reason =
                `No usable timeslot remains after ` +
                `existing occupancy is considered.`;
        }

        else if (
            !combinationAvailable
        ) {

            bottleneck =
                "COMBINATION_CONFLICT";

            reason =
                `Professors and rooms are available individually, ` +
                `but never at the same usable time window.`;
        }


        failures.push({

            subject:
                requirement.subject_code,

            type:
                requirement.type,

            bottleneck,

            reason,

            qualifiedProfessors:
                professors.length,

            suitableRooms:
                rooms.length,

            possibleWindows:
                windows.length

        });
    }


    return failures;
};


/*
|--------------------------------------------------------------------------
| SIMULATE ONE SECTION
|--------------------------------------------------------------------------
*/

const simulateSection = ({
    programId,
    yearLevel,
    sectionNumber,
    requirements,
    professorMap,
    rooms,
    windows,
    globalOccupancy,
    globalState
}) => {

    globalState.nodes++;


    if (
        globalState.nodes >
        MAX_GLOBAL_SIMULATION_NODES
    ) {

        return {

            success:
                false,

            stoppedByGlobalLimit:
                true,

            reason:
                "Global simulation node limit reached."

        };
    }


    /*
    |--------------------------------------------------------------------------
    | Build candidates
    |--------------------------------------------------------------------------
    */

    const sectionId =
        `SIM-${programId}-${yearLevel}-${sectionNumber}`;


    const {
        candidateMap
    } =
        buildCandidateMap({

            sectionId,

            requirements,

            professorMap,

            rooms,

            windows

        });


    /*
    |--------------------------------------------------------------------------
    | Clone GLOBAL occupancy
    |--------------------------------------------------------------------------
    |
    | This is critical.
    |
    | We do NOT modify global occupancy until
    | the whole section successfully schedules.
    |
    */

    const workingOccupancy =
        cloneOccupancy(
            globalOccupancy
        );


    /*
    |--------------------------------------------------------------------------
    | Solve using same algorithm as scheduler
    |--------------------------------------------------------------------------
    */

    const result =
        solveSimulatedSection({

            sectionId,

            requirements,

            candidateMap,

            occupancy:
                workingOccupancy

        });


    if (
        result.success
    ) {

        return {

            success:
                true,

            assignments:
                result.assignments,

            occupancy:
                workingOccupancy,

            searchNodes:
                result.searchNodes,

            elapsed:
                result.elapsed,

            diagnostics:
                []

        };
    }


    /*
    |--------------------------------------------------------------------------
    | Diagnose actual failure
    |--------------------------------------------------------------------------
    */

    const diagnostics =
        diagnoseFailedSection({

            requirements,

            candidateMap,

            occupancy:
                globalOccupancy

        });


    return {

        success:
            false,

        assignments:
            [],

        searchNodes:
            result.searchNodes,

        elapsed:
            result.elapsed,

        diagnostics,

        reason:
            "No valid complete schedule could be found."
    };
};


/*
|--------------------------------------------------------------------------
| PROGRAM/YEAR SIMULATION
|--------------------------------------------------------------------------
*/

const simulateProgramYear = async ({
    programId,
    yearLevel,
    academicTermId,
    professorMap,
    rooms,
    windows,
    globalOccupancy,
    globalState
}) => {

    const subjects =
        await getCurriculum(

            programId,

            yearLevel,

            academicTermId

        );


    if (
        subjects.length === 0
    ) {

        return {

            programId,

            yearLevel,

            sectionsCreated:
                0,

            additionalCapacity:
                0,

            reason:
                "No curriculum subjects.",

            occupancy:
                globalOccupancy
        };
    }


    const requirements =
        buildRequirements(
            subjects
        );


    if (
        requirements.length === 0
    ) {

        return {

            programId,

            yearLevel,

            sectionsCreated:
                0,

            additionalCapacity:
                0,

            reason:
                "No lecture/laboratory requirements.",

            occupancy:
                globalOccupancy
        };
    }


    let currentOccupancy =
        globalOccupancy;


    let sectionsCreated =
        0;


    const simulatedSections =
        [];


    let lastFailure =
        null;


    for (
        let sectionNumber = 1;

        sectionNumber <=
        MAX_SIMULATED_SECTIONS;

        sectionNumber++
    ) {

        if (
            globalState.nodes >=
            MAX_GLOBAL_SIMULATION_NODES
        ) {

            break;
        }


        log(
            `Simulating ` +
            `Program ${programId} ` +
            `${yearLevelMap[yearLevel]} ` +
            `Section ${sectionNumber}`
        );


        const result =
            simulateSection({

                programId,

                yearLevel,

                sectionNumber,

                requirements,

                professorMap,

                rooms,

                windows,

                globalOccupancy:
                    currentOccupancy,

                globalState

            });


        if (
            !result.success
        ) {

            lastFailure =
                result;


            log(
                `STOP Program ${programId} ` +
                `${yearLevelMap[yearLevel]}`
            );


            if (
                result.diagnostics?.length
            ) {

                for (
                    const diagnostic
                    of result.diagnostics
                ) {

                    log(

                        `  ${diagnostic.subject} ` +
                        `${diagnostic.type} -> ` +
                        `${diagnostic.bottleneck} | ` +
                        `${diagnostic.reason}`

                    );
                }
            }


            break;
        }


        /*
        |--------------------------------------------------------------------------
        | COMMIT SECTION TO GLOBAL SIMULATION
        |--------------------------------------------------------------------------
        */

        currentOccupancy =
            result.occupancy;


        sectionsCreated++;


        simulatedSections.push({

            sectionNumber,

            assignments:
                result.assignments,

            searchNodes:
                result.searchNodes,

            elapsed:
                result.elapsed

        });


        log(
            `SUCCESS Program ${programId} ` +
            `${yearLevelMap[yearLevel]} ` +
            `Section ${sectionNumber}`
        );
    }


    return {

        programId,

        yearLevel,

        sectionsCreated,

        additionalCapacity:
            sectionsCreated *
            SECTION_CAPACITY,

        simulatedSections,

        reason:
            lastFailure
                ? "No more complete sections can be scheduled with the current global resource occupancy."
                : null,

        bottleneck:
            lastFailure?.diagnostics || [],

        occupancy:
            currentOccupancy
    };
};


/*
|--------------------------------------------------------------------------
| PROGRAMS
|--------------------------------------------------------------------------
*/

const getPrograms = async () => {

    const [rows] =
        await db.query(`

            SELECT
                id,
                program_name

            FROM programs

            ORDER BY id

        `);

    return rows;
};


/*
|--------------------------------------------------------------------------
| EXISTING CAPACITY
|--------------------------------------------------------------------------
*/

const calculateExistingCapacity = (
    scheduledSections
) => {

    return scheduledSections.reduce(

        (
            total,
            section
        ) => {

            return (

                total +

                Number(
                    section.maxStudents ||
                    SECTION_CAPACITY
                )

            );
        },

        0
    );
};


/*
|--------------------------------------------------------------------------
| RESOURCE UTILIZATION
|--------------------------------------------------------------------------
*/

const calculateResourceUtilization = (
    occupancy,
    professors,
    rooms,
    timeSlots
) => {

    const totalProfessorSlots =
        professors.length *
        timeSlots.length;


    const usedProfessorSlots =
        [...occupancy.professorSlots.values()]
            .reduce(
                (
                    total,
                    slots
                ) =>
                    total +
                    slots.size,
                0
            );


    const totalRoomSlots =
        rooms.length *
        timeSlots.length;


    const usedRoomSlots =
        [...occupancy.roomSlots.values()]
            .reduce(
                (
                    total,
                    slots
                ) =>
                    total +
                    slots.size,
                0
            );


    return {

        professors: {

            total:
                professors.length,

            usedSlots:
                usedProfessorSlots,

            totalSlots:
                totalProfessorSlots,

            utilization:

                totalProfessorSlots > 0

                    ?

                    Number(
                        (
                            usedProfessorSlots /
                            totalProfessorSlots
                        ) *
                        100
                    ).toFixed(2)

                    :

                    0
        },


        rooms: {

            total:
                rooms.length,

            usedSlots:
                usedRoomSlots,

            totalSlots:
                totalRoomSlots,

            utilization:

                totalRoomSlots > 0

                    ?

                    Number(
                        (
                            usedRoomSlots /
                            totalRoomSlots
                        ) *
                        100
                    ).toFixed(2)

                    :

                    0
        }
    };
};


/*
|--------------------------------------------------------------------------
| MAIN CAPACITY CHECKER
|--------------------------------------------------------------------------
*/

const checkEnrollmentCapacity = async ({
    academicTermId
}) => {

    log(
        "\n============================================================"
    );

    log(
        "ACCURATE UNIVERSITY CAPACITY SIMULATION"
    );

    log(
        "============================================================"
    );

    log(
        "Academic Term:",
        academicTermId
    );

    log(
        "Section capacity:",
        SECTION_CAPACITY
    );


    /*
    |--------------------------------------------------------------------------
    | LOAD DATA
    |--------------------------------------------------------------------------
    */

    const [
        programs,
        timeSlots,
        rooms,
        existingData,
        existingSections
    ] =
        await Promise.all([

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


    const existingOccupancy =
        existingData.occupancy;


    /*
    |--------------------------------------------------------------------------
    | EXISTING SECTIONS
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
        calculateExistingCapacity(
            scheduledSections
        );


    /*
    |--------------------------------------------------------------------------
    | ROOMS
    |--------------------------------------------------------------------------
    */

    const lectureRooms =
        rooms.filter(

            room =>
                room.room_type ===
                "lecture"

        );


    const laboratoryRooms =
        rooms.filter(

            room =>
                room.room_type ===
                "laboratory"

        );


    /*
    |--------------------------------------------------------------------------
    | TIME WINDOWS
    |--------------------------------------------------------------------------
    */

    const slotsByDay =
        groupSlotsByDay(
            timeSlots
        );


    /*
    |--------------------------------------------------------------------------
    | CURRICULUM CACHE
    |--------------------------------------------------------------------------
    */

    const curriculumCache =
        new Map();


    const allSubjectIds =
        new Set();


    const requiredHours =
        new Set();


    for (
        const program
        of programs
    ) {

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


            for (
                const subject
                of subjects
            ) {

                allSubjectIds.add(

                    Number(
                        subject.subject_id
                    )

                );
            }


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


    /*
    |--------------------------------------------------------------------------
    | PROFESSORS
    |--------------------------------------------------------------------------
    */

    const professorMap =
        await getProfessorMap(
            [...allSubjectIds]
        );


    const allProfessors =
        [
            ...new Map(

                [
                    ...professorMap.values()
                ]
                .flat()
                .map(
                    professor => [
                        professor.id,
                        professor
                    ]
                )

            ).values()
        ];


    /*
    |--------------------------------------------------------------------------
    | WINDOWS
    |--------------------------------------------------------------------------
    */

    const windows =
        new Map();


    for (
        const hours
        of requiredHours
    ) {

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
    | GLOBAL SIMULATION
    |--------------------------------------------------------------------------
    */

    let globalOccupancy =
        cloneOccupancy(
            existingOccupancy
        );


    const globalState = {

        nodes:
            0
    };


    const programResults =
        [];


    let additionalSections =
        0;


    let additionalCapacity =
        0;


    /*
    |--------------------------------------------------------------------------
    | SIMULATE EVERY PROGRAM/YEAR
    |--------------------------------------------------------------------------
    */

    for (
        const program
        of programs
    ) {

        for (
            let year = 1;

            year <= 4;

            year++
        ) {

            if (
                globalState.nodes >=
                MAX_GLOBAL_SIMULATION_NODES
            ) {

                break;
            }


            const result =
                await simulateProgramYear({

                    programId:
                        Number(
                            program.id
                        ),

                    yearLevel:
                        year,

                    academicTermId,

                    professorMap,

                    rooms,

                    windows,

                    globalOccupancy,

                    globalState

                });


            if (
                result.occupancy
            ) {

                globalOccupancy =
                    result.occupancy;
            }


            additionalSections +=
                Number(
                    result.sectionsCreated ||
                    0
                );


            additionalCapacity +=
                Number(
                    result.additionalCapacity ||
                    0
                );


            programResults.push({

                programId:
                    result.programId,

                programName:
                    program.program_name,

                yearLevel:
                    result.yearLevel,

                yearName:
                    yearLevelMap[
                        result.yearLevel
                    ],

                sections:
                    result.sectionsCreated,

                capacity:
                    result.additionalCapacity,

                bottleneck:
                    result.bottleneck || [],

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

    const [studentRows] =
        await db.query(`

            SELECT
                COUNT(*) AS total

            FROM student s

            JOIN student_sections ss
                ON ss.student_id =
                   s.id

            WHERE
                ss.academic_term_id = ?

        `, [
            academicTermId
        ]);


    const currentStudents =
        Number(
            studentRows[0]?.total ||
            0
        );


    /*
    |--------------------------------------------------------------------------
    | PENDING APPLICANTS
    |--------------------------------------------------------------------------
    */

    const [pendingRows] =
        await db.query(`

            SELECT
                COUNT(*) AS total

            FROM student_applications

            WHERE
                status = 'pending'

        `);


    const pendingApplicants =
        Number(
            pendingRows[0]?.total ||
            0
        );


    /*
    |--------------------------------------------------------------------------
    | FINAL CAPACITY
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
    | RESOURCE UTILIZATION
    |--------------------------------------------------------------------------
    */

    const utilization =
        calculateResourceUtilization(

            globalOccupancy,

            allProfessors,

            rooms,

            timeSlots

        );


    /*
    |--------------------------------------------------------------------------
    | RESOURCE SUMMARY
    |--------------------------------------------------------------------------
    */

    const resources = {

        rooms: {

            total:
                rooms.length,

            lecture:
                lectureRooms.length,

            laboratory:
                laboratoryRooms.length,

            totalCapacity:
                rooms.reduce(
                    (
                        total,
                        room
                    ) =>
                        total +
                        Number(
                            room.capacity
                        ),
                    0
                )
        },


        professors: {

            total:
                allProfessors.length,

            qualified:
                allProfessors.length,

            subjectsWithProfessors:
                professorMap.size
        },


        timeSlots: {

            total:
                timeSlots.length,

            days:
                new Set(
                    timeSlots.map(
                        slot =>
                            slot.day
                    )
                ).size,

            windows:
                Object.fromEntries(

                    [
                        ...windows.entries()
                    ].map(
                        (
                            [
                                hours,
                                values
                            ]
                        ) => [

                            hours,

                            values.length

                        ]
                    )
                )
        },


        utilization
    };


    /*
    |--------------------------------------------------------------------------
    | FINAL LOGS
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
        "Existing incomplete sections:",
        incompleteSections.length
    );

    log(
        "Existing capacity:",
        existingSectionCapacity
    );

    log(
        "Additional sections:",
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
        "\nRESOURCE UTILIZATION"
    );


    log(
        "Professor utilization:",
        utilization.professors.utilization +
        "%"
    );


    log(
        "Room utilization:",
        utilization.rooms.utilization +
        "%"
    );


    log(
        "Simulation nodes:",
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

        success:
            true,

        message:
            "University capacity successfully simulated using scheduler-equivalent constraints.",

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
        | SIMULATED
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
        | SIMULATION
        |--------------------------------------------------------------------------
        */

        simulation: {

            globalNodes:
                globalState.nodes,

            maxGlobalNodes:
                MAX_GLOBAL_SIMULATION_NODES,

            maxNodesPerSection:
                MAX_SEARCH_NODES_PER_SECTION,

            maxTimePerSection:
                MAX_TIME_MS_PER_SECTION,

            sectionCapacity:
                SECTION_CAPACITY,

            existingSchedulesLocked:
                true,

            algorithm:
                "MRV + Backtracking + Forward Checking",

            globalOccupancy:
                true
        },


        /*
        |--------------------------------------------------------------------------
        | RESOURCES
        |--------------------------------------------------------------------------
        */

        resources,


        /*
        |--------------------------------------------------------------------------
        | PROGRAM RESULTS
        |--------------------------------------------------------------------------
        */

        programResults
    };
};


/*
|--------------------------------------------------------------------------
| EXPRESS CONTROLLER
|--------------------------------------------------------------------------
*/

const checkCapacity = async (
    req,
    res
) => {

    try {

        const {
            academicTermId
        } = req.query;


        if (
            !academicTermId
        ) {

            return res.status(400).json({

                success:
                    false,

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

            success:
                false,

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