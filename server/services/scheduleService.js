const db = require("../config/db");

/*
|--------------------------------------------------------------------------
| CONFIG
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| YEAR LEVEL
|--------------------------------------------------------------------------
*/

const yearLevelMap = {
    1: "1st Year",
    2: "2nd Year",
    3: "3rd Year",
    4: "4th Year"
};


/*
|--------------------------------------------------------------------------
| BASIC MAP HELPERS
|--------------------------------------------------------------------------
*/

const addToMapSet = (
    map,
    key,
    slotIds
) => {

    if (!map.has(key)) {
        map.set(key, new Set());
    }

    const set = map.get(key);

    for (const slotId of slotIds) {
        set.add(Number(slotId));
    }
};


const hasConflict = (
    map,
    key,
    slots
) => {

    const occupied = map.get(key);

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


const reserveSlots = (
    map,
    key,
    slots
) => {

    if (!map.has(key)) {
        map.set(key, new Set());
    }

    const occupied =
        map.get(key);

    for (const slot of slots) {

        occupied.add(
            Number(slot.id)
        );
    }
};


const releaseSlots = (
    map,
    key,
    slots
) => {

    const occupied =
        map.get(key);

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

        map.delete(key);
    }
};


/*
|--------------------------------------------------------------------------
| EMPTY OCCUPANCY
|--------------------------------------------------------------------------
*/

const createOccupancy = () => {

    return {

        sectionSlots:
            new Map(),

        professorSlots:
            new Map(),

        roomSlots:
            new Map()
    };
};


/*
|--------------------------------------------------------------------------
| LOAD SECTIONS
|--------------------------------------------------------------------------
*/

const getSections = async (
    programId,
    academicTermId
) => {

    const [rows] = await db.query(`
        SELECT
            id,
            program_id,
            year_level,
            section_name,
            academic_term_id
        FROM sections
        WHERE program_id = ?
        AND academic_term_id = ?
        ORDER BY
            year_level ASC,
            section_name ASC
    `, [
        programId,
        academicTermId
    ]);

    return rows;
};


/*
|--------------------------------------------------------------------------
| STUDENT COUNT
|--------------------------------------------------------------------------
*/

const getSectionStudentCount = async (
    sectionId,
    academicTermId
) => {

    const [rows] = await db.query(`
        SELECT
            COUNT(*) AS student_count
        FROM student_sections
        WHERE section_id = ?
        AND academic_term_id = ?
    `, [
        sectionId,
        academicTermId
    ]);

    return Number(
        rows[0]?.student_count || 0
    );
};


/*
|--------------------------------------------------------------------------
| SECTION SUBJECTS
|--------------------------------------------------------------------------
*/

const getSectionSubjects = async (
    sectionId,
    academicTermId
) => {

    const [rows] = await db.query(`
        SELECT
            s.id AS section_id,
            s.section_name,
            s.program_id,
            s.year_level,

            cs.subject_id,

            sub.subject_code,
            sub.subject_name,

            sub.units,
            sub.lecture_units,
            sub.lab_units,

            at.semester

        FROM sections s

        JOIN academic_terms at
            ON at.id = s.academic_term_id

        JOIN curriculum_subjects cs
            ON cs.program_id = s.program_id

            AND cs.year_level =
                CASE
                    WHEN s.year_level = 1 THEN '1st Year'
                    WHEN s.year_level = 2 THEN '2nd Year'
                    WHEN s.year_level = 3 THEN '3rd Year'
                    WHEN s.year_level = 4 THEN '4th Year'
                END

            AND cs.semester = at.semester

        JOIN subjects sub
            ON sub.id = cs.subject_id

        WHERE s.id = ?
        AND s.academic_term_id = ?

        ORDER BY
            sub.subject_code ASC
    `, [
        sectionId,
        academicTermId
    ]);

    return rows;
};


/*
|--------------------------------------------------------------------------
| BUILD REQUIREMENTS
|--------------------------------------------------------------------------
*/

const buildRequirements = (
    subjects
) => {

    const requirements = [];

    let requirementId = 0;


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
         * LECTURE
         */

        if (
            lectureUnits > 0
        ) {

            requirements.push({

                id:
                    requirementId++,

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


        /*
         * LABORATORY
         */

        if (
            labUnits > 0
        ) {

            requirements.push({

                id:
                    requirementId++,

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
| TIME SLOTS
|--------------------------------------------------------------------------
*/

const getTimeSlots = async () => {

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
};


/*
|--------------------------------------------------------------------------
| GROUP TIME SLOTS
|--------------------------------------------------------------------------
*/

const groupSlotsByDay = (
    slots
) => {

    const map =
        new Map();


    for (const day of DAY_ORDER) {

        map.set(
            day,
            []
        );
    }


    for (const slot of slots) {

        if (
            !map.has(slot.day)
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


/*
|--------------------------------------------------------------------------
| BUILD CONSECUTIVE WINDOWS
|--------------------------------------------------------------------------
*/

const buildWindows = (
    slotsByDay,
    hours
) => {

    const windows = [];

    const requiredHours =
        Number(hours);


    for (const day of DAY_ORDER) {

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
            daySlots.length - requiredHours;
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
                j < candidate.length;
                j++
            ) {

                const previous =
                    candidate[j - 1];

                const current =
                    candidate[j];


                if (
                    previous.end_time !==
                    current.start_time
                ) {

                    consecutive =
                        false;

                    break;
                }
            }


            if (
                !consecutive
            ) {

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
| PROFESSOR MAP
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
                ON p.id = ps.professor_id

            WHERE ps.subject_id IN (${placeholders})

            ORDER BY
                ps.subject_id,
                p.id
        `, subjectIds);


    for (const row of rows) {

        const subjectId =
            Number(
                row.subject_id
            );


        if (
            !map.has(subjectId)
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
| ROOMS
|--------------------------------------------------------------------------
*/

const getRooms = async () => {

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
| LOAD ALL EXISTING SCHEDULES
|--------------------------------------------------------------------------
*/

const loadExistingSchedules = async (
    academicTermId
) => {

    const [rows] =
        await db.query(`
            SELECT
                cs.id,
                cs.section_id,
                cs.subject_id,
                cs.professor_id,
                cs.room_id,
                cs.time_slot_id,
                cs.academic_term_id,

                r.room_type

            FROM class_schedules cs

            JOIN rooms r
                ON r.id = cs.room_id

            WHERE cs.academic_term_id = ?
        `, [
            academicTermId
        ]);


    return rows;
};


/*
|--------------------------------------------------------------------------
| RESERVE EXISTING SCHEDULES
|--------------------------------------------------------------------------
*/

const reserveExistingSchedules = (
    rows,
    occupancy
) => {

    for (const row of rows) {

        const slotId =
            Number(
                row.time_slot_id
            );


        addToMapSet(
            occupancy.sectionSlots,
            Number(row.section_id),
            [slotId]
        );


        addToMapSet(
            occupancy.professorSlots,
            Number(row.professor_id),
            [slotId]
        );


        addToMapSet(
            occupancy.roomSlots,
            Number(row.room_id),
            [slotId]
        );
    }
};


/*
|--------------------------------------------------------------------------
| EXISTING REQUIREMENT COUNTS
|--------------------------------------------------------------------------
*/

const getExistingRequirementCounts = (
    existingRows
) => {

    const map =
        new Map();


    for (const row of existingRows) {

        const sectionId =
            Number(
                row.section_id
            );

        const subjectId =
            Number(
                row.subject_id
            );


        if (
            !map.has(sectionId)
        ) {

            map.set(
                sectionId,
                new Map()
            );
        }


        const sectionMap =
            map.get(sectionId);


        const type =
            row.room_type ===
            "laboratory"
                ? "laboratory"
                : "lecture";


        const key =
            `${subjectId}:${type}`;


        sectionMap.set(
            key,
            (
                sectionMap.get(key) || 0
            ) + 1
        );
    }


    return map;
};


/*
|--------------------------------------------------------------------------
| GET MISSING REQUIREMENTS
|--------------------------------------------------------------------------
*/

const getMissingRequirements = (
    section,
    existingRequirementCounts
) => {

    const sectionCounts =
        existingRequirementCounts.get(
            Number(section.id)
        ) || new Map();


    const missing = [];


    for (
        const requirement
        of section.requirements
    ) {

        const key =
            `${requirement.subject_id}:${requirement.type}`;


        const existingCount =
            sectionCounts.get(key) || 0;


        if (
            existingCount >=
            requirement.hours
        ) {

            continue;
        }


        missing.push({

            ...requirement,

            remainingHours:
                requirement.hours -
                existingCount
        });
    }


    return missing;
};


/*
|--------------------------------------------------------------------------
| ASSIGNMENT CONFLICT
|--------------------------------------------------------------------------
*/

const assignmentHasConflict = (
    assignment,
    occupancy
) => {

    const slots =
        assignment.window.slots;


    /*
     * SECTION CONFLICT
     */

    if (
        hasConflict(
            occupancy.sectionSlots,
            assignment.sectionId,
            slots
        )
    ) {

        return true;
    }


    /*
     * PROFESSOR CONFLICT
     */

    if (
        hasConflict(
            occupancy.professorSlots,
            assignment.professor.id,
            slots
        )
    ) {

        return true;
    }


    /*
     * ROOM CONFLICT
     */

    if (
        hasConflict(
            occupancy.roomSlots,
            assignment.room.id,
            slots
        )
    ) {

        return true;
    }


    return false;
};


/*
|--------------------------------------------------------------------------
| BUILD STATIC CANDIDATES
|--------------------------------------------------------------------------
*/

const buildCandidateList = (
    requirement,
    section,
    windows,
    professors,
    rooms
) => {

    const candidates = [];


    const requiredRoomType =
        requirement.type ===
        "laboratory"
            ? "laboratory"
            : "lecture";


    for (const window of windows) {

        for (
            const professor
            of professors
        ) {

            for (
                const room
                of rooms
            ) {

                /*
                 * Room type
                 */

                if (
                    room.room_type !==
                    requiredRoomType
                ) {

                    continue;
                }


                /*
                 * Room capacity
                 */

                if (
                    Number(room.capacity) <
                    Number(section.student_count)
                ) {

                    continue;
                }


                candidates.push({

                    sectionId:
                        Number(section.id),

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
| BUILD SECTION CANDIDATES
|--------------------------------------------------------------------------
*/

const buildSectionCandidateMap = (
    section,
    requirements,
    professorMap,
    rooms,
    windows
) => {

    const candidateMap =
        new Map();


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


        /*
         * NO QUALIFIED PROFESSOR
         */

        if (
            professors.length === 0
        ) {

            throw new Error(
                `NO QUALIFIED PROFESSOR: ` +
                `${requirement.subject_code}`
            );
        }


        const hours =
            Number(
                requirement.remainingHours ||
                requirement.hours
            );


        const requirementWindows =
            windows.get(hours) || [];


        /*
         * NO TIME WINDOW
         */

        if (
            requirementWindows.length === 0
        ) {

            throw new Error(
                `NO TIME WINDOW: ` +
                `${requirement.subject_code} ` +
                `${requirement.type} ` +
                `(${hours} hours).`
            );
        }


        const candidates =
            buildCandidateList(
                requirement,
                section,
                requirementWindows,
                professors,
                rooms
            );


        /*
         * NO STATIC CANDIDATES
         */

        if (
            candidates.length === 0
        ) {

            throw new Error(
                `NO STATIC CANDIDATES: ` +
                `${requirement.subject_code} ` +
                `${requirement.type} ` +
                `in Section ` +
                `${section.section_name}.`
            );
        }


        candidateMap.set(
            requirement.id,
            candidates
        );


        console.log(
            `  ${requirement.subject_code} ` +
            `${requirement.type}: ` +
            `${candidates.length} candidates`
        );
    }


    return candidateMap;
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


    return (
        professorLoad * 1000 +
        roomLoad * 100 +
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
    occupancy
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
                occupancy
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
| BOTTLENECK ANALYSIS
|--------------------------------------------------------------------------
|
| This is the new diagnostic system.
|
| It checks every static candidate and identifies which
| resource blocks it:
|
| PROFESSOR
| ROOM
| SECTION / TIMESLOT
|
|--------------------------------------------------------------------------
*/

const analyzeResourceBottleneck = (
    requirement,
    candidateMap,
    occupancy
) => {

    const candidates =
        candidateMap.get(
            requirement.id
        ) || [];


    const analysis = {

        requirement:
            `${requirement.subject_code} ${requirement.type}`,

        subjectCode:
            requirement.subject_code,

        subjectId:
            requirement.subject_id,

        type:
            requirement.type,

        totalCandidates:
            candidates.length,

        availableCandidates:
            0,

        blockedCandidates:
            0,

        professorConflict:
            0,

        roomConflict:
            0,

        sectionConflict:
            0,

        professorOnlyBlocked:
            0,

        roomOnlyBlocked:
            0,

        sectionOnlyBlocked:
            0,

        multipleResourceBlocked:
            0,

        likelyBottleneck:
            "NONE"
    };


    for (
        const candidate
        of candidates
    ) {

        const slots =
            candidate.window.slots;


        const professorBlocked =
            hasConflict(
                occupancy.professorSlots,
                candidate.professor.id,
                slots
            );


        const roomBlocked =
            hasConflict(
                occupancy.roomSlots,
                candidate.room.id,
                slots
            );


        const sectionBlocked =
            hasConflict(
                occupancy.sectionSlots,
                candidate.sectionId,
                slots
            );


        const conflictCount =
            Number(professorBlocked) +
            Number(roomBlocked) +
            Number(sectionBlocked);


        /*
         * Completely free candidate
         */

        if (
            conflictCount === 0
        ) {

            analysis.availableCandidates++;

            continue;
        }


        analysis.blockedCandidates++;


        /*
         * Individual resource conflicts
         */

        if (
            professorBlocked
        ) {

            analysis.professorConflict++;
        }


        if (
            roomBlocked
        ) {

            analysis.roomConflict++;
        }


        if (
            sectionBlocked
        ) {

            analysis.sectionConflict++;
        }


        /*
         * Single-resource conflicts
         */

        if (
            professorBlocked &&
            !roomBlocked &&
            !sectionBlocked
        ) {

            analysis.professorOnlyBlocked++;
        }


        if (
            roomBlocked &&
            !professorBlocked &&
            !sectionBlocked
        ) {

            analysis.roomOnlyBlocked++;
        }


        if (
            sectionBlocked &&
            !professorBlocked &&
            !roomBlocked
        ) {

            analysis.sectionOnlyBlocked++;
        }


        /*
         * Multiple resources simultaneously blocking
         */

        if (
            conflictCount > 1
        ) {

            analysis.multipleResourceBlocked++;
        }
    }


    /*
     * Determine bottleneck
     */

    if (
        analysis.availableCandidates > 0
    ) {

        /*
         * There are still candidates.
         *
         * Therefore the failure may be caused by
         * interaction between requirements.
         */

        analysis.likelyBottleneck =
            "COMBINATION / BACKTRACKING CONSTRAINT";

    } else {

        const professor =
            analysis.professorConflict;

        const room =
            analysis.roomConflict;

        const section =
            analysis.sectionConflict;


        /*
         * PROFESSOR
         */

        if (
            professor > room &&
            professor > section
        ) {

            analysis.likelyBottleneck =
                "PROFESSOR";
        }


        /*
         * ROOM
         */

        else if (
            room > professor &&
            room > section
        ) {

            analysis.likelyBottleneck =
                "ROOM";
        }


        /*
         * SECTION / TIME
         */

        else if (
            section > professor &&
            section > room
        ) {

            analysis.likelyBottleneck =
                "SECTION/TIMESLOT";
        }


        /*
         * Equal / mixed
         */

        else {

            analysis.likelyBottleneck =
                "MULTIPLE RESOURCES";
        }
    }


    return analysis;
};


/*
|--------------------------------------------------------------------------
| PRINT BOTTLENECK ANALYSIS
|--------------------------------------------------------------------------
*/

const printBottleneckAnalysis = (
    section,
    analyses
) => {

    console.log(
        "\n========================================"
    );

    console.log(
        `BOTTLENECK ANALYSIS: Section ` +
        `${section.section_name}`
    );

    console.log(
        "========================================"
    );


    for (
        const analysis
        of analyses
    ) {

        console.log(
            `\n${analysis.subjectCode} ` +
            `${analysis.type}`
        );


        console.log(
            `  Total candidates: ` +
            `${analysis.totalCandidates}`
        );


        console.log(
            `  Available candidates: ` +
            `${analysis.availableCandidates}`
        );


        console.log(
            `  Blocked candidates: ` +
            `${analysis.blockedCandidates}`
        );


        console.log(
            `  Professor conflicts: ` +
            `${analysis.professorConflict}`
        );


        console.log(
            `  Room conflicts: ` +
            `${analysis.roomConflict}`
        );


        console.log(
            `  Section/timeslot conflicts: ` +
            `${analysis.sectionConflict}`
        );


        console.log(
            `  Professor-only blocks: ` +
            `${analysis.professorOnlyBlocked}`
        );


        console.log(
            `  Room-only blocks: ` +
            `${analysis.roomOnlyBlocked}`
        );


        console.log(
            `  Section-only blocks: ` +
            `${analysis.sectionOnlyBlocked}`
        );


        console.log(
            `  Multiple-resource blocks: ` +
            `${analysis.multipleResourceBlocked}`
        );


        console.log(
            `  LIKELY BOTTLENECK: ` +
            `${analysis.likelyBottleneck}`
        );
    }


    console.log(
        "========================================"
    );
};


/*
|--------------------------------------------------------------------------
| RESERVE ASSIGNMENT
|--------------------------------------------------------------------------
*/

const reserveAssignment = (
    assignment,
    occupancy
) => {

    const slots =
        assignment.window.slots;


    reserveSlots(
        occupancy.sectionSlots,
        assignment.sectionId,
        slots
    );


    reserveSlots(
        occupancy.professorSlots,
        assignment.professor.id,
        slots
    );


    reserveSlots(
        occupancy.roomSlots,
        assignment.room.id,
        slots
    );
};


/*
|--------------------------------------------------------------------------
| RELEASE ASSIGNMENT
|--------------------------------------------------------------------------
*/

const releaseAssignment = (
    assignment,
    occupancy
) => {

    const slots =
        assignment.window.slots;


    releaseSlots(
        occupancy.sectionSlots,
        assignment.sectionId,
        slots
    );


    releaseSlots(
        occupancy.professorSlots,
        assignment.professor.id,
        slots
    );


    releaseSlots(
        occupancy.roomSlots,
        assignment.room.id,
        slots
    );
};


/*
|--------------------------------------------------------------------------
| SOLVE ONE SECTION
|--------------------------------------------------------------------------
*/

const solveOneSection = async ({
    section,
    requirements,
    candidateMap,
    occupancy
}) => {

    const startTime =
        Date.now();

    let searchNodes =
        0;

    let timedOut =
        false;

    let nodeLimitReached =
        false;

    const assignments =
        [];

    const assignedIds =
        new Set();


    const backtrack = () => {

        searchNodes++;


        /*
         * NODE LIMIT
         */

        if (
            searchNodes >
            MAX_SEARCH_NODES_PER_SECTION
        ) {

            nodeLimitReached =
                true;

            return false;
        }


        /*
         * TIME LIMIT
         */

        if (
            Date.now() -
            startTime >
            MAX_TIME_MS_PER_SECTION
        ) {

            timedOut =
                true;

            return false;
        }


        /*
         * COMPLETE
         */

        if (
            assignedIds.size ===
            requirements.length
        ) {

            return true;
        }


        /*
         * MRV
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
                    occupancy
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
            !selectedRequirement ||
            !selectedCandidates
        ) {

            return false;
        }


        /*
         * BEST CANDIDATES FIRST
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
         * TRY CANDIDATES
         */

        for (
            const candidate
            of selectedCandidates
        ) {

            if (
                searchNodes >
                MAX_SEARCH_NODES_PER_SECTION
            ) {

                nodeLimitReached =
                    true;

                return false;
            }


            if (
                Date.now() -
                startTime >
                MAX_TIME_MS_PER_SECTION
            ) {

                timedOut =
                    true;

                return false;
            }


            if (
                assignmentHasConflict(
                    candidate,
                    occupancy
                )
            ) {

                continue;
            }


            const assignment = {

                ...candidate,

                requirement:
                    selectedRequirement,

                sectionId:
                    Number(section.id)
            };


            reserveAssignment(
                assignment,
                occupancy
            );


            assignments.push(
                assignment
            );


            assignedIds.add(
                selectedRequirement.id
            );


            /*
             * Forward checking
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
                        occupancy
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
             * UNDO
             */

            assignedIds.delete(
                selectedRequirement.id
            );


            assignments.pop();


            releaseAssignment(
                assignment,
                occupancy
            );
        }


        return false;
    };


    const success =
        backtrack();


    let failureType =
        null;


    if (
        !success
    ) {

        if (
            timedOut
        ) {

            failureType =
                "SEARCH_TIMEOUT";

        } else if (
            nodeLimitReached
        ) {

            failureType =
                "NODE_LIMIT";

        } else {

            failureType =
                "CONSTRAINT_FAILURE";
        }
    }


    return {

        success,

        assignments:
            success
                ? [...assignments]
                : [],

        searchNodes,

        elapsed:
            Date.now() -
            startTime,

        timedOut,

        nodeLimitReached,

        failureType
    };
};


/*
|--------------------------------------------------------------------------
| SAVE SECTION SCHEDULE
|--------------------------------------------------------------------------
*/

const saveSectionSchedules = async (
    assignments,
    academicTermId
) => {

    if (
        assignments.length === 0
    ) {

        return;
    }


    await db.query(
        "START TRANSACTION"
    );


    try {

        for (
            const assignment
            of assignments
        ) {

            for (
                const slot
                of assignment.window.slots
            ) {

                await db.query(`
                    INSERT INTO class_schedules
                    (
                        section_id,
                        subject_id,
                        professor_id,
                        room_id,
                        time_slot_id,
                        academic_term_id
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [

                    assignment.sectionId,

                    assignment.requirement
                        .subject_id,

                    assignment.professor.id,

                    assignment.room.id,

                    slot.id,

                    academicTermId
                ]);
            }
        }


        await db.query(
            "COMMIT"
        );

    } catch (error) {

        await db.query(
            "ROLLBACK"
        );

        throw error;
    }
};


/*
|--------------------------------------------------------------------------
| GET SECTION STATUS
|--------------------------------------------------------------------------
*/

const getSectionStatus = (
    section,
    existingRequirementCounts
) => {

    const sectionCounts =
        existingRequirementCounts.get(
            Number(section.id)
        ) || new Map();


    let completedRequirements =
        0;


    for (
        const requirement
        of section.requirements
    ) {

        const key =
            `${requirement.subject_id}:${requirement.type}`;


        const count =
            sectionCounts.get(key) || 0;


        if (
            count >=
            requirement.hours
        ) {

            completedRequirements++;
        }
    }


    return {

        complete:
            completedRequirements ===
            section.requirements.length,

        completedRequirements,

        totalRequirements:
            section.requirements.length
    };
};


/*
|--------------------------------------------------------------------------
| SECTION DIFFICULTY
|--------------------------------------------------------------------------
*/

const calculateSectionDifficulty = (
    section,
    candidateMap,
    occupancy
) => {

    let totalValid =
        0;

    let smallest =
        Infinity;


    for (
        const requirement
        of section.missingRequirements
    ) {

        const valid =
            getValidCandidates(
                requirement,
                candidateMap,
                occupancy
            );


        const count =
            valid.length;


        totalValid +=
            count;


        if (
            count <
            smallest
        ) {

            smallest =
                count;
        }
    }


    if (
        smallest === Infinity
    ) {

        smallest = 0;
    }


    return (
        totalValid +
        smallest * 20 -
        section.missingRequirements.length * 500
    );
};


/*
|--------------------------------------------------------------------------
| MAIN GENERATOR
|--------------------------------------------------------------------------
*/

const generateSchedules = async (
    req
) => {

    const {
        programId,
        academicTermId
    } = req.body;


    if (
        !programId ||
        !academicTermId
    ) {

        throw new Error(
            "programId and academicTermId are required."
        );
    }


    console.log(
        "\n========================================"
    );

    console.log(
        "INCREMENTAL SCHEDULE GENERATION"
    );

    console.log(
        "========================================"
    );

    console.log(
        `Program: ${programId}`
    );

    console.log(
        `Academic Term: ${academicTermId}`
    );


    /*
     * --------------------------------------------------------------
     * LOAD SECTIONS
     * --------------------------------------------------------------
     */

    const sections =
        await getSections(
            programId,
            academicTermId
        );


    if (
        sections.length === 0
    ) {

        throw new Error(
            "No sections found for selected program."
        );
    }


    console.log(
        `Total sections: ${sections.length}`
    );


    /*
     * --------------------------------------------------------------
     * TIME SLOTS
     * --------------------------------------------------------------
     */

    const timeSlots =
        await getTimeSlots();


    if (
        timeSlots.length === 0
    ) {

        throw new Error(
            "No available time slots."
        );
    }


    console.log(
        `Available time slots: ` +
        `${timeSlots.length}`
    );


    const slotsByDay =
        groupSlotsByDay(
            timeSlots
        );


    /*
     * --------------------------------------------------------------
     * ROOMS
     * --------------------------------------------------------------
     */

    const rooms =
        await getRooms();


    if (
        rooms.length === 0
    ) {

        throw new Error(
            "No available rooms."
        );
    }


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


    console.log(
        `Lecture rooms: ` +
        `${lectureRooms.length}`
    );

    console.log(
        `Laboratory rooms: ` +
        `${laboratoryRooms.length}`
    );


    /*
     * --------------------------------------------------------------
     * EXISTING SCHEDULES
     * --------------------------------------------------------------
     */

    const existingSchedules =
        await loadExistingSchedules(
            academicTermId
        );


    console.log(
        `Existing schedule rows: ` +
        `${existingSchedules.length}`
    );


    /*
     * --------------------------------------------------------------
     * LOCK EXISTING SCHEDULES
     * --------------------------------------------------------------
     */

    const occupancy =
        createOccupancy();


    reserveExistingSchedules(
        existingSchedules,
        occupancy
    );


    /*
     * --------------------------------------------------------------
     * EXISTING REQUIREMENT COUNTS
     * --------------------------------------------------------------
     */

    const existingRequirementCounts =
        getExistingRequirementCounts(
            existingSchedules
        );


    /*
     * --------------------------------------------------------------
     * PREPARE SECTIONS
     * --------------------------------------------------------------
     */

    const preparedSections =
        [];

    const allSubjectIds =
        new Set();


    for (
        const section
        of sections
    ) {

        section.student_count =
            await getSectionStudentCount(
                section.id,
                academicTermId
            );


        section.subjects =
            await getSectionSubjects(
                section.id,
                academicTermId
            );


        if (
            section.subjects.length === 0
        ) {

            console.log(
                `Skipping Section ` +
                `${section.section_name}: ` +
                `No subjects`
            );

            continue;
        }


        section.requirements =
            buildRequirements(
                section.subjects
            );


        section.missingRequirements =
            getMissingRequirements(
                section,
                existingRequirementCounts
            );


        const status =
            getSectionStatus(
                section,
                existingRequirementCounts
            );


        section.isComplete =
            status.complete;


        if (
            section.isComplete
        ) {

            console.log(
                `LOCKED COMPLETE: ` +
                `${section.section_name}`
            );

            continue;
        }


        for (
            const requirement
            of section.missingRequirements
        ) {

            allSubjectIds.add(
                Number(
                    requirement.subject_id
                )
            );
        }


        preparedSections.push(
            section
        );
    }


    /*
     * --------------------------------------------------------------
     * NOTHING TO SCHEDULE
     * --------------------------------------------------------------
     */

    if (
        preparedSections.length === 0
    ) {

        console.log(
            "All sections already have complete schedules."
        );


        return {

            success: true,

            partial: false,

            programId,

            academicTermId,

            sectionCount:
                sections.length,

            newSections: 0,

            scheduledSections: 0,

            failedSections: 0,

            schedules: [],

            message:
                "All sections already have complete schedules."
        };
    }


    console.log(
        `New/incomplete sections: ` +
        `${preparedSections.length}`
    );


    /*
     * --------------------------------------------------------------
     * PROFESSORS
     * --------------------------------------------------------------
     */

    const professorMap =
        await getProfessorMap(
            [...allSubjectIds]
        );


    /*
     * --------------------------------------------------------------
     * PROFESSOR SUMMARY
     * --------------------------------------------------------------
     */

    console.log(
        "\n========================================"
    );

    console.log(
        "PROFESSOR RESOURCE SUMMARY"
    );

    console.log(
        "========================================"
    );


    for (
        const subjectId
        of allSubjectIds
    ) {

        const professors =
            professorMap.get(
                Number(subjectId)
            ) || [];


        console.log(
            `Subject ${subjectId}: ` +
            `${professors.length} qualified professor(s)`
        );
    }


    /*
     * --------------------------------------------------------------
     * VALIDATE PROFESSORS
     * --------------------------------------------------------------
     */

    for (
        const section
        of preparedSections
    ) {

        for (
            const requirement
            of section.missingRequirements
        ) {

            const professors =
                professorMap.get(
                    Number(
                        requirement.subject_id
                    )
                ) || [];


            if (
                professors.length === 0
            ) {

                console.log(
                    `NO QUALIFIED PROFESSOR: ` +
                    `${section.section_name} -> ` +
                    `${requirement.subject_code}`
                );
            }
        }
    }


    /*
     * --------------------------------------------------------------
     * REQUIRED WINDOWS
     * --------------------------------------------------------------
     */

    const uniqueHours =
        [
            ...new Set(
                preparedSections.flatMap(
                    section =>
                        section.missingRequirements.map(
                            requirement =>
                                Number(
                                    requirement.remainingHours
                                )
                        )
                )
            )
        ];


    const windows =
        new Map();


    for (
        const hours
        of uniqueHours
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


        console.log(
            `${hours}-hour windows: ` +
            `${generated.length}`
        );
    }


    /*
     * --------------------------------------------------------------
     * BUILD CANDIDATES
     * --------------------------------------------------------------
     */

    const candidateMaps =
        [];


    for (
        const section
        of preparedSections
    ) {

        console.log(
            "\n========================================"
        );

        console.log(
            `BUILDING CANDIDATES: ` +
            `${section.section_name}`
        );

        console.log(
            "========================================"
        );


        try {

            const candidateMap =
                buildSectionCandidateMap(
                    section,
                    section.missingRequirements,
                    professorMap,
                    rooms,
                    windows
                );


            candidateMaps.push(
                candidateMap
            );

        } catch (error) {

            console.log(
                `CANDIDATE ERROR: ` +
                `${section.section_name}`
            );


            console.log(
                error.message
            );


            candidateMaps.push(
                null
            );
        }
    }


    /*
     * --------------------------------------------------------------
     * SORT BY DIFFICULTY
     * --------------------------------------------------------------
     */

    const sectionJobs =
        preparedSections.map(
            (section, index) => ({

                section,

                candidateMap:
                    candidateMaps[index]
            })
        );


    sectionJobs.sort(
        (a, b) => {

            if (
                !a.candidateMap
            ) {

                return 1;
            }


            if (
                !b.candidateMap
            ) {

                return -1;
            }


            return (
                calculateSectionDifficulty(
                    a.section,
                    a.candidateMap,
                    occupancy
                )
                -
                calculateSectionDifficulty(
                    b.section,
                    b.candidateMap,
                    occupancy
                )
            );
        }
    );


    /*
     * --------------------------------------------------------------
     * RESULTS
     * --------------------------------------------------------------
     */

    const scheduledSections =
        [];

    const failedSections =
        [];

    const generatedSchedules =
        [];


    /*
     * --------------------------------------------------------------
     * INCREMENTAL SOLVING
     * --------------------------------------------------------------
     */

    for (
        const job
        of sectionJobs
    ) {

        const section =
            job.section;

        const candidateMap =
            job.candidateMap;


        console.log(
            "\n========================================"
        );

        console.log(
            `SOLVING SECTION: ` +
            `${section.section_name}`
        );

        console.log(
            `Students: ` +
            `${section.student_count}`
        );

        console.log(
            `Missing requirements: ` +
            `${section.missingRequirements.length}`
        );

        console.log(
            "========================================"
        );


        /*
         * Candidate construction failed.
         */

        if (
            !candidateMap
        ) {

            const reason =
                "Unable to build candidate list.";


            failedSections.push({

                sectionId:
                    section.id,

                section:
                    section.section_name,

                reason,

                bottleneck:
                    "CANDIDATE_BUILD_FAILURE",

                bottleneckAnalysis:
                    []
            });


            continue;
        }


        /*
         * ----------------------------------------------------------
         * IMMEDIATE BOTTLENECK CHECK
         * ----------------------------------------------------------
         */

        const immediateAnalyses =
            [];


        let impossibleRequirement =
            null;


        for (
            const requirement
            of section.missingRequirements
        ) {

            const valid =
                getValidCandidates(
                    requirement,
                    candidateMap,
                    occupancy
                );


            const analysis =
                analyzeResourceBottleneck(
                    requirement,
                    candidateMap,
                    occupancy
                );


            immediateAnalyses.push(
                analysis
            );


            if (
                valid.length === 0 &&
                !impossibleRequirement
            ) {

                impossibleRequirement =
                    requirement;
            }
        }


        /*
         * ----------------------------------------------------------
         * HARD BOTTLENECK
         * ----------------------------------------------------------
         */

        if (
            impossibleRequirement
        ) {

            printBottleneckAnalysis(
                section,
                immediateAnalyses
            );


            const impossibleAnalysis =
                immediateAnalyses.find(
                    analysis =>
                        analysis.subjectId ===
                        Number(
                            impossibleRequirement.subject_id
                        ) &&
                        analysis.type ===
                        impossibleRequirement.type
                );


            const reason =
                `No available schedule for ` +
                `${impossibleRequirement.subject_code} ` +
                `${impossibleRequirement.type}. ` +
                `Likely bottleneck: ` +
                `${impossibleAnalysis?.likelyBottleneck || "UNKNOWN"}.`;


            console.log(
                `FAILED: ` +
                `${section.section_name} ❌`
            );


            console.log(
                `Reason: ${reason}`
            );


            failedSections.push({

                sectionId:
                    section.id,

                section:
                    section.section_name,

                reason,

                bottleneck:
                    impossibleAnalysis
                        ?.likelyBottleneck ||
                    "UNKNOWN",

                bottleneckAnalysis:
                    immediateAnalyses
            });


            continue;
        }


        /*
         * ----------------------------------------------------------
         * SOLVE
         * ----------------------------------------------------------
         */

        const result =
            await solveOneSection({

                section,

                requirements:
                    section.missingRequirements,

                candidateMap,

                occupancy
            });


        console.log(
            `Section ${section.section_name}: ` +
            `success=${result.success}, ` +
            `nodes=${result.searchNodes}, ` +
            `time=${result.elapsed}ms`
        );


        /*
         * ----------------------------------------------------------
         * SUCCESS
         * ----------------------------------------------------------
         */

        if (
            result.success
        ) {

            try {

                await saveSectionSchedules(
                    result.assignments,
                    academicTermId
                );


                /*
                 * IMPORTANT:
                 *
                 * solveOneSection already reserved
                 * the assignments in occupancy.
                 *
                 * DO NOT reserve again.
                 */


                scheduledSections.push(
                    section.section_name
                );


                for (
                    const assignment
                    of result.assignments
                ) {

                    const slots =
                        assignment.window.slots;


                    generatedSchedules.push({

                        section:
                            section.section_name,

                        sectionId:
                            section.id,

                        yearLevel:
                            section.year_level,

                        subject:
                            assignment.requirement
                                .subject_code,

                        subjectId:
                            assignment.requirement
                                .subject_id,

                        type:
                            assignment.requirement
                                .type,

                        professor:
                            `${assignment.professor.firstname} ${assignment.professor.lastname}`,

                        professorId:
                            assignment.professor.id,

                        room:
                            assignment.room.room_name,

                        roomId:
                            assignment.room.id,

                        roomType:
                            assignment.room.room_type,

                        day:
                            assignment.window.day,

                        start:
                            slots[0].start_time,

                        end:
                            slots[
                                slots.length - 1
                            ].end_time
                    });
                }


                console.log(
                    `SAVED: Section ` +
                    `${section.section_name} ✅`
                );

            } catch (
                saveError
            ) {

                /*
                 * Database save failed.
                 *
                 * Release occupancy.
                 */

                for (
                    const assignment
                    of result.assignments
                ) {

                    releaseAssignment(
                        assignment,
                        occupancy
                    );
                }


                failedSections.push({

                    sectionId:
                        section.id,

                    section:
                        section.section_name,

                    reason:
                        `Database save failed: ` +
                        saveError.message,

                    bottleneck:
                        "DATABASE_SAVE_FAILURE",

                    bottleneckAnalysis:
                        []
                });


                console.log(
                    `SAVE FAILED: ` +
                    `${section.section_name}`
                );
            }


            continue;
        }


        /*
         * ----------------------------------------------------------
         * SOLVER FAILURE
         * ----------------------------------------------------------
         */

        let failureAnalyses =
            [];


        for (
            const requirement
            of section.missingRequirements
        ) {

            failureAnalyses.push(
                analyzeResourceBottleneck(
                    requirement,
                    candidateMap,
                    occupancy
                )
            );
        }


        printBottleneckAnalysis(
            section,
            failureAnalyses
        );


        /*
         * ----------------------------------------------------------
         * DETERMINE FAILURE TYPE
         * ----------------------------------------------------------
         */

        let reason;

        let bottleneck;


        if (
            result.timedOut
        ) {

            reason =
                `SEARCH TIMEOUT: ` +
                `Solver reached the ` +
                `${MAX_TIME_MS_PER_SECTION}ms ` +
                `limit before proving whether a complete ` +
                `schedule exists.`;

            bottleneck =
                "UNKNOWN / SEARCH COMPLEXITY";
        }


        else if (
            result.nodeLimitReached
        ) {

            reason =
                `NODE LIMIT: ` +
                `Solver reached the ` +
                `${MAX_SEARCH_NODES_PER_SECTION} ` +
                `node limit before proving whether a ` +
                `complete schedule exists.`;

            bottleneck =
                "UNKNOWN / SEARCH COMPLEXITY";
        }


        else {

            /*
             * True constraint failure.
             */

            let worst =
                null;

            let worstScore =
                -1;


            for (
                const analysis
                of failureAnalyses
            ) {

                /*
                 * A zero-available candidate requirement
                 * is strongest evidence.
                 */

                let score =
                    0;


                if (
                    analysis.availableCandidates === 0
                ) {

                    score += 100000;
                }


                score +=
                    analysis.blockedCandidates;


                if (
                    score >
                    worstScore
                ) {

                    worstScore =
                        score;

                    worst =
                        analysis;
                }
            }


            if (worst) {

                bottleneck =
                    worst.likelyBottleneck;


                reason =
                    `Unable to find a complete schedule. ` +
                    `Most constrained requirement: ` +
                    `${worst.subjectCode} ` +
                    `${worst.type}. ` +
                    `Likely bottleneck: ` +
                    `${worst.likelyBottleneck}.`;

            } else {

                bottleneck =
                    "UNKNOWN";

                reason =
                    "Unable to find a valid complete schedule.";
            }
        }


        /*
         * ----------------------------------------------------------
         * FINAL FAILURE LOG
         * ----------------------------------------------------------
         */

        console.log(
            `FAILED: Section ` +
            `${section.section_name} ❌`
        );


        console.log(
            `Failure type: ` +
            `${result.failureType}`
        );


        console.log(
            `Reason: ${reason}`
        );


        console.log(
            `Likely bottleneck: ` +
            `${bottleneck}`
        );


        failedSections.push({

            sectionId:
                section.id,

            section:
                section.section_name,

            reason,

            failureType:
                result.failureType,

            bottleneck,

            bottleneckAnalysis:
                failureAnalyses
        });
    }


    /*
     * --------------------------------------------------------------
     * FINAL RESULT
     * --------------------------------------------------------------
     */

    const success =
        failedSections.length === 0;


    const partial =
        scheduledSections.length > 0 &&
        failedSections.length > 0;


    console.log(
        "\n========================================"
    );

    console.log(
        "INCREMENTAL SCHEDULER FINISHED"
    );

    console.log(
        `Success: ${success}`
    );

    console.log(
        `Partial: ${partial}`
    );

    console.log(
        `New sections: ` +
        `${preparedSections.length}`
    );

    console.log(
        `Scheduled sections: ` +
        `${scheduledSections.length}`
    );

    console.log(
        `Failed sections: ` +
        `${failedSections.length}`
    );

    console.log(
        "========================================"
    );


    /*
     * --------------------------------------------------------------
     * BOTTLENECK SUMMARY
     * --------------------------------------------------------------
     */

    const bottleneckSummary = {

        professor: 0,

        room: 0,

        sectionTimeslot: 0,

        multipleResources: 0,

        combination: 0,

        searchTimeout: 0,

        nodeLimit: 0,

        unknown: 0
    };


    for (
        const failed
        of failedSections
    ) {

        const bottleneck =
            failed.bottleneck;


        if (
            bottleneck ===
            "PROFESSOR"
        ) {

            bottleneckSummary.professor++;
        }

        else if (
            bottleneck ===
            "ROOM"
        ) {

            bottleneckSummary.room++;
        }

        else if (
            bottleneck ===
            "SECTION/TIMESLOT"
        ) {

            bottleneckSummary.sectionTimeslot++;
        }

        else if (
            bottleneck ===
            "MULTIPLE RESOURCES"
        ) {

            bottleneckSummary.multipleResources++;
        }

        else if (
            bottleneck ===
            "COMBINATION / BACKTRACKING CONSTRAINT"
        ) {

            bottleneckSummary.combination++;
        }

        else if (
            failed.failureType ===
            "SEARCH_TIMEOUT"
        ) {

            bottleneckSummary.searchTimeout++;
        }

        else if (
            failed.failureType ===
            "NODE_LIMIT"
        ) {

            bottleneckSummary.nodeLimit++;
        }

        else {

            bottleneckSummary.unknown++;
        }
    }


    console.log(
        "\n========================================"
    );

    console.log(
        "BOTTLENECK SUMMARY"
    );

    console.log(
        "========================================"
    );

    console.log(
        `Professor: ` +
        `${bottleneckSummary.professor}`
    );

    console.log(
        `Room: ` +
        `${bottleneckSummary.room}`
    );

    console.log(
        `Section/Timeslot: ` +
        `${bottleneckSummary.sectionTimeslot}`
    );

    console.log(
        `Multiple resources: ` +
        `${bottleneckSummary.multipleResources}`
    );

    console.log(
        `Combination/backtracking: ` +
        `${bottleneckSummary.combination}`
    );

    console.log(
        `Search timeout: ` +
        `${bottleneckSummary.searchTimeout}`
    );

    console.log(
        `Node limit: ` +
        `${bottleneckSummary.nodeLimit}`
    );

    console.log(
        `Unknown: ` +
        `${bottleneckSummary.unknown}`
    );

    console.log(
        "========================================"
    );


    /*
     * --------------------------------------------------------------
     * RESPONSE
     * --------------------------------------------------------------
     */

    return {

        /*
         * The HTTP request itself succeeded.
         *
         * Scheduling may still be partial.
         */

        success:
            true,

        partial,

        programId,

        academicTermId,

        sectionCount:
            sections.length,

        newSections:
            preparedSections.length,

        scheduledSections:
            scheduledSections.length,

        failedSections:
            failedSections.length,

        scheduled:
            scheduledSections,

        failed:
            failedSections,

        bottleneckSummary,

        schedules:
            generatedSchedules,

        message:
            partial
                ? `Schedule generation partially completed. ` +
                  `${scheduledSections.length} section(s) ` +
                  `scheduled successfully and ` +
                  `${failedSections.length} section(s) ` +
                  `could not be scheduled.`

                : success
                    ? `All new/incomplete sections ` +
                      `were scheduled successfully.`

                    : `No new sections could be scheduled.`
    };
};


/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = {

    generateSchedules,

    getSectionSubjects,

    buildRequirements,

    getSections
};