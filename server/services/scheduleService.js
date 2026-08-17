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

const MAX_GLOBAL_SEARCH_NODES = 200000;
const MAX_GLOBAL_TIME_MS = 120000;


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
| BASIC HELPERS
|--------------------------------------------------------------------------
*/

const addToMapSet = (map, key, slotIds) => {

    if (!map.has(key)) {
        map.set(key, new Set());
    }

    const set = map.get(key);

    for (const slotId of slotIds) {
        set.add(slotId);
    }
};


const hasConflict = (map, key, slots) => {

    const occupied = map.get(key);

    if (!occupied) {
        return false;
    }

    for (const slot of slots) {

        if (occupied.has(slot.id)) {
            return true;
        }
    }

    return false;
};


const reserveSlots = (map, key, slots) => {

    if (!map.has(key)) {
        map.set(key, new Set());
    }

    const occupied = map.get(key);

    for (const slot of slots) {
        occupied.add(slot.id);
    }
};


const releaseSlots = (map, key, slots) => {

    const occupied = map.get(key);

    if (!occupied) {
        return;
    }

    for (const slot of slots) {
        occupied.delete(slot.id);
    }

    if (occupied.size === 0) {
        map.delete(key);
    }
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

const buildRequirements = (subjects) => {

    const requirements = [];

    let requirementId = 0;

    for (const subject of subjects) {

        const lectureUnits =
            Number(subject.lecture_units || 0);

        const labUnits =
            Number(subject.lab_units || 0);


        /*
         * LECTURE
         */

        if (lectureUnits > 0) {

            requirements.push({

                id: requirementId++,

                subject_id:
                    subject.subject_id,

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

        if (labUnits > 0) {

            requirements.push({

                id: requirementId++,

                subject_id:
                    subject.subject_id,

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

const groupSlotsByDay = (slots) => {

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
                daySlots.slice(
                    i,
                    i + hours
                );


            let consecutive = true;


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

                    consecutive = false;
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
| PROFESSOR MAP
|--------------------------------------------------------------------------
*/

const getProfessorMap = async (
    subjectIds
) => {

    const map = new Map();

    if (subjectIds.length === 0) {
        return map;
    }


    const placeholders =
        subjectIds
            .map(() => "?")
            .join(",");


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

        if (!map.has(row.subject_id)) {
            map.set(row.subject_id, []);
        }


        map.get(row.subject_id).push({

            id:
                row.id,

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

    return rows;
};


/*
|--------------------------------------------------------------------------
| EXTERNAL OCCUPANCY
|--------------------------------------------------------------------------
*/

const loadExternalOccupancy = async (
    programId,
    academicTermId
) => {

    const [rows] = await db.query(`
        SELECT
            cs.section_id,
            cs.professor_id,
            cs.room_id,
            cs.time_slot_id

        FROM class_schedules cs

        JOIN sections s
            ON s.id = cs.section_id

        WHERE cs.academic_term_id = ?
        AND s.program_id <> ?
    `, [
        academicTermId,
        programId
    ]);


    const occupancy = {

        sectionSlots:
            new Map(),

        professorSlots:
            new Map(),

        roomSlots:
            new Map()
    };


    for (const row of rows) {

        addToMapSet(
            occupancy.sectionSlots,
            row.section_id,
            [row.time_slot_id]
        );


        addToMapSet(
            occupancy.professorSlots,
            row.professor_id,
            [row.time_slot_id]
        );


        addToMapSet(
            occupancy.roomSlots,
            row.room_id,
            [row.time_slot_id]
        );
    }


    return occupancy;
};


/*
|--------------------------------------------------------------------------
| SECTION LOAD MAPS
|--------------------------------------------------------------------------
*/

const createSectionLoadMaps = () => {

    return {

        sectionDayLoad:
            new Map(),

        sectionTotalLoad:
            new Map()
    };
};


/*
|--------------------------------------------------------------------------
| RESERVE ASSIGNMENT
|--------------------------------------------------------------------------
*/

const reserveAssignment = (
    assignment,
    occupancy,
    loadMaps
) => {

    const {
        sectionId,
        professor,
        room,
        window
    } = assignment;


    reserveSlots(
        occupancy.sectionSlots,
        sectionId,
        window.slots
    );


    reserveSlots(
        occupancy.professorSlots,
        professor.id,
        window.slots
    );


    reserveSlots(
        occupancy.roomSlots,
        room.id,
        window.slots
    );


    if (
        !loadMaps.sectionDayLoad.has(sectionId)
    ) {

        loadMaps.sectionDayLoad.set(
            sectionId,
            new Map()
        );
    }


    const dayMap =
        loadMaps.sectionDayLoad.get(sectionId);


    dayMap.set(
        window.day,
        (
            dayMap.get(window.day) || 0
        ) + window.slots.length
    );


    loadMaps.sectionTotalLoad.set(
        sectionId,
        (
            loadMaps.sectionTotalLoad.get(sectionId) || 0
        ) + window.slots.length
    );
};


/*
|--------------------------------------------------------------------------
| RELEASE ASSIGNMENT
|--------------------------------------------------------------------------
*/

const releaseAssignment = (
    assignment,
    occupancy,
    loadMaps
) => {

    const {
        sectionId,
        professor,
        room,
        window
    } = assignment;


    releaseSlots(
        occupancy.sectionSlots,
        sectionId,
        window.slots
    );


    releaseSlots(
        occupancy.professorSlots,
        professor.id,
        window.slots
    );


    releaseSlots(
        occupancy.roomSlots,
        room.id,
        window.slots
    );


    const dayMap =
        loadMaps.sectionDayLoad.get(
            sectionId
        );


    if (dayMap) {

        const current =
            dayMap.get(window.day) || 0;

        const next =
            current - window.slots.length;


        if (next <= 0) {

            dayMap.delete(
                window.day
            );

        } else {

            dayMap.set(
                window.day,
                next
            );
        }


        if (dayMap.size === 0) {

            loadMaps.sectionDayLoad.delete(
                sectionId
            );
        }
    }


    const currentTotal =
        loadMaps.sectionTotalLoad.get(
            sectionId
        ) || 0;


    const nextTotal =
        currentTotal - window.slots.length;


    if (nextTotal <= 0) {

        loadMaps.sectionTotalLoad.delete(
            sectionId
        );

    } else {

        loadMaps.sectionTotalLoad.set(
            sectionId,
            nextTotal
        );
    }
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


    if (
        hasConflict(
            occupancy.sectionSlots,
            assignment.sectionId,
            slots
        )
    ) {
        return true;
    }


    if (
        hasConflict(
            occupancy.professorSlots,
            assignment.professor.id,
            slots
        )
    ) {
        return true;
    }


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
        requirement.type === "laboratory"
            ? "laboratory"
            : "lecture";


    for (const window of windows) {

        for (const professor of professors) {

            for (const room of rooms) {

                if (
                    room.room_type !==
                    requiredRoomType
                ) {
                    continue;
                }


                if (
                    Number(room.capacity) <
                    Number(section.student_count)
                ) {
                    continue;
                }


                candidates.push({

                    sectionId:
                        section.id,

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
| ASSIGNMENT SCORE
|--------------------------------------------------------------------------
*/

const scoreAssignment = (
    assignment,
    occupancy,
    loadMaps
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


    const sectionId =
        assignment.sectionId;


    const day =
        assignment.window.day;


    const dayLoad =
        loadMaps.sectionDayLoad
            .get(sectionId)
            ?.get(day) || 0;


    const totalLoad =
        loadMaps.sectionTotalLoad
            .get(sectionId) || 0;


    return (
        professorLoad * 1000 +
        roomLoad * 100 +
        dayLoad * 50 +
        totalLoad * 5 +
        Number(assignment.room.capacity)
    );
};


/*
|--------------------------------------------------------------------------
| VALID CANDIDATES
|--------------------------------------------------------------------------
*/

const getValidCandidates = (
    requirement,
    candidateMap,
    occupancy
) => {

    const allCandidates =
        candidateMap.get(
            requirement.id
        ) || [];


    const valid = [];


    for (const candidate of allCandidates) {

        if (
            assignmentHasConflict(
                candidate,
                occupancy
            )
        ) {
            continue;
        }


        valid.push(candidate);
    }


    return valid;
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


    for (const requirement of requirements) {

        const professors =
            professorMap.get(
                requirement.subject_id
            ) || [];


        if (
            professors.length === 0
        ) {

            throw new Error(
                `No professor assigned to ` +
                `${requirement.subject_code}.`
            );
        }


        const requirementWindows =
            windows.get(
                requirement.hours
            ) || [];


        if (
            requirementWindows.length === 0
        ) {

            throw new Error(
                `No time window available for ` +
                `${requirement.subject_code} ` +
                `${requirement.type} ` +
                `(${requirement.hours} hours).`
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


        if (
            candidates.length === 0
        ) {

            throw new Error(
                `No static candidates for ` +
                `${requirement.subject_code} ` +
                `${requirement.type} ` +
                `in Section ${section.section_name}.`
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
| FIND ALL VALID SECTION SOLUTIONS
|--------------------------------------------------------------------------
|
| This is the important fix.
|
| Instead of returning only ONE solution for a section,
| this generator can produce multiple solutions.
|
| The global solver can then try:
|
| H #1 -> I fails
| H #2 -> I succeeds
|
|--------------------------------------------------------------------------
*/

const generateSectionSolutions = async function* ({
    section,
    requirements,
    candidateMap,
    occupancy
}) {

    const startTime =
        Date.now();

    let searchNodes = 0;

    const assignments = [];

    const assignedIds =
        new Set();

    const loadMaps =
        createSectionLoadMaps();


    const backtrack = async function* () {

        searchNodes++;


        if (
            Date.now() - startTime >
            MAX_TIME_MS_PER_SECTION
        ) {
            return;
        }


        if (
            searchNodes >
            MAX_SEARCH_NODES_PER_SECTION
        ) {
            return;
        }


        /*
         * COMPLETE SOLUTION
         */

        if (
            assignedIds.size ===
            requirements.length
        ) {

            yield {
                assignments: [
                    ...assignments
                ],

                searchNodes,

                elapsed:
                    Date.now() - startTime
            };

            return;
        }


        /*
         * MRV
         */

        let selectedRequirement = null;

        let selectedCandidates = null;

        let smallestCount =
            Infinity;


        for (const requirement of requirements) {

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

                return;
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


            if (
                smallestCount === 1
            ) {
                break;
            }
        }


        if (
            !selectedRequirement ||
            !selectedCandidates
        ) {
            return;
        }


        /*
         * HEURISTIC SORT
         */

        selectedCandidates.sort(
            (a, b) => {

                return (
                    scoreAssignment(
                        a,
                        occupancy,
                        loadMaps
                    )
                    -
                    scoreAssignment(
                        b,
                        occupancy,
                        loadMaps
                    )
                );
            }
        );


        /*
         * TRY EVERY CANDIDATE
         */

        for (
            const candidate
            of selectedCandidates
        ) {

            if (
                Date.now() - startTime >
                MAX_TIME_MS_PER_SECTION
            ) {
                return;
            }


            if (
                searchNodes >
                MAX_SEARCH_NODES_PER_SECTION
            ) {
                return;
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
                    section.id
            };


            reserveAssignment(
                assignment,
                occupancy,
                loadMaps
            );


            assignments.push(
                assignment
            );


            assignedIds.add(
                selectedRequirement.id
            );


            /*
             * FORWARD CHECK
             */

            let possible = true;


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

                    possible = false;
                    break;
                }
            }


            if (possible) {

                yield* backtrack();
            }


            /*
             * RELEASE
             */

            assignedIds.delete(
                selectedRequirement.id
            );


            assignments.pop();


            releaseAssignment(
                assignment,
                occupancy,
                loadMaps
            );
        }
    };


    yield* backtrack();
};


/*
|--------------------------------------------------------------------------
| RESERVE SECTION
|--------------------------------------------------------------------------
*/

const reserveSectionAssignments = (
    assignments,
    occupancy
) => {

    const loadMaps =
        createSectionLoadMaps();


    for (const assignment of assignments) {

        reserveAssignment(
            assignment,
            occupancy,
            loadMaps
        );
    }
};


/*
|--------------------------------------------------------------------------
| RELEASE SECTION
|--------------------------------------------------------------------------
*/

const releaseSectionAssignments = (
    assignments,
    occupancy
) => {

    const loadMaps =
        createSectionLoadMaps();


    for (const assignment of assignments) {

        releaseAssignment(
            assignment,
            occupancy,
            loadMaps
        );
    }
};

/*
|--------------------------------------------------------------------------
| GLOBAL SECTION SOLVER - FIXED VERSION
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| The old solver processed:
|
| A -> B -> C -> D -> E -> ...
|
| That is bad for large programs such as BSCS.
|
| This version dynamically selects the MOST CONSTRAINED section first.
|
| Sections with:
| - fewer available rooms
| - fewer professors
| - fewer possible time windows
| - more requirements
|
| are solved first.
|
| This dramatically reduces global backtracking.
|
|--------------------------------------------------------------------------
*/

const solveAllSections = async ({
    sections,
    candidateMaps,
    occupancy
}) => {

    const startTime = Date.now();

    let globalSearchNodes = 0;

    const finalAssignments = new Map();

    const solvedSections = new Set();

    /*
     * --------------------------------------------------------------
     * GLOBAL LIMITS
     * --------------------------------------------------------------
     */

    const GLOBAL_NODE_LIMIT = 200000;
    const GLOBAL_TIME_LIMIT = 120000;


    /*
     * --------------------------------------------------------------
     * CHECK GLOBAL LIMIT
     * --------------------------------------------------------------
     */

    const exceededLimit = () => {

        if (
            globalSearchNodes >= GLOBAL_NODE_LIMIT
        ) {
            return true;
        }

        if (
            Date.now() - startTime >= GLOBAL_TIME_LIMIT
        ) {
            return true;
        }

        return false;
    };


    /*
     * --------------------------------------------------------------
     * COUNT VALID CANDIDATES
     * --------------------------------------------------------------
     */

    const getSectionDifficulty = (
        section,
        candidateMap
    ) => {

        let totalCandidates = 0;

        let smallestRequirement =
            Infinity;

        let requirementCount =
            section.requirements.length;


        for (
            const requirement
            of section.requirements
        ) {

            const candidates =
                candidateMap.get(
                    requirement.id
                ) || [];


            const count =
                candidates.length;


            totalCandidates += count;


            if (
                count < smallestRequirement
            ) {

                smallestRequirement =
                    count;
            }
        }


        /*
         * Lower score = harder section
         *
         * More requirements = harder
         * Fewer candidates = harder
         */

        return (
            totalCandidates +
            smallestRequirement * 10 -
            requirementCount * 100
        );
    };


    /*
     * --------------------------------------------------------------
     * SELECT NEXT SECTION
     * --------------------------------------------------------------
     */

    const selectNextSection = () => {

        let selected = null;

        let selectedScore =
            Infinity;


        for (
            let i = 0;
            i < sections.length;
            i++
        ) {

            if (
                solvedSections.has(i)
            ) {
                continue;
            }


            const section =
                sections[i];


            const candidateMap =
                candidateMaps[i];


            /*
             * ------------------------------------------------------
             * DYNAMIC DIFFICULTY
             * ------------------------------------------------------
             *
             * We count how many candidates remain after the
             * currently occupied resources are considered.
             */

            let totalValidCandidates = 0;

            let smallestValid =
                Infinity;


            for (
                const requirement
                of section.requirements
            ) {

                const valid =
                    getValidCandidates(
                        requirement,
                        candidateMap,
                        occupancy
                    );


                const count =
                    valid.length;


                if (
                    count === 0
                ) {

                    /*
                     * This section currently cannot be solved.
                     *
                     * Selecting it immediately causes fast
                     * backtracking.
                     */

                    return {
                        index: i,
                        impossible: true
                    };
                }


                totalValidCandidates += count;


                if (
                    count < smallestValid
                ) {

                    smallestValid =
                        count;
                }
            }


            /*
             * Harder sections get smaller score.
             */

            const score =
                totalValidCandidates +
                smallestValid * 20 -
                section.requirements.length * 500;


            if (
                score <
                selectedScore
            ) {

                selectedScore =
                    score;

                selected = {
                    index: i,
                    impossible: false
                };
            }
        }


        return selected;
    };


    /*
     * --------------------------------------------------------------
     * SECTION SOLVER
     * --------------------------------------------------------------
     */

    const solve = async () => {

        globalSearchNodes++;


        /*
         * GLOBAL LIMIT
         */

        if (
            exceededLimit()
        ) {

            return false;
        }


        /*
         * ALL SOLVED
         */

        if (
            solvedSections.size ===
            sections.length
        ) {

            return true;
        }


        /*
         * ----------------------------------------------------------
         * PICK HARDEST SECTION
         * ----------------------------------------------------------
         */

        const selected =
            selectNextSection();


        if (
            !selected
        ) {

            return true;
        }


        const sectionIndex =
            selected.index;


        const section =
            sections[sectionIndex];


        const candidateMap =
            candidateMaps[sectionIndex];


        /*
         * ----------------------------------------------------------
         * IMMEDIATE FAILURE
         * ----------------------------------------------------------
         */

        if (
            selected.impossible
        ) {

            console.log(
                `NO VALID CANDIDATES: ` +
                `Section ${section.section_name}`
            );

            return false;
        }


        console.log(
            "\n========================================"
        );

        console.log(
            `GLOBAL SOLVING SECTION: ` +
            `${section.section_name}`
        );

        console.log(
            `Year Level: ${section.year_level}`
        );

        console.log(
            `Students: ${section.student_count}`
        );

        console.log(
            `Requirements: ${section.requirements.length}`
        );

        console.log(
            `Solved: ${solvedSections.size}/` +
            `${sections.length}`
        );

        console.log(
            "========================================"
        );


        /*
         * ----------------------------------------------------------
         * GENERATE SECTION SOLUTIONS
         * ----------------------------------------------------------
         */

        let solutionNumber = 0;


        for await (
            const solution
            of generateSectionSolutions({

                section,

                requirements:
                    section.requirements,

                candidateMap,

                occupancy
            })
        ) {

            solutionNumber++;


            globalSearchNodes++;


            if (
                exceededLimit()
            ) {

                return false;
            }


            console.log(
                `TRY Section ${section.section_name} ` +
                `Solution #${solutionNumber}`
            );


            /*
             * ------------------------------------------------------
             * RESERVE
             * ------------------------------------------------------
             */

            reserveSectionAssignments(
                solution.assignments,
                occupancy
            );


            finalAssignments.set(
                sectionIndex,
                solution.assignments
            );


            solvedSections.add(
                sectionIndex
            );


            /*
             * ------------------------------------------------------
             * FORWARD CHECK
             * ------------------------------------------------------
             *
             * Before going deeper, verify EVERY unsolved section
             * still has at least one possible candidate for EVERY
             * requirement.
             */

            let possible = true;


            for (
                let i = 0;
                i < sections.length;
                i++
            ) {

                if (
                    solvedSections.has(i)
                ) {
                    continue;
                }


                const nextSection =
                    sections[i];


                const nextCandidateMap =
                    candidateMaps[i];


                for (
                    const requirement
                    of nextSection.requirements
                ) {

                    const valid =
                        getValidCandidates(
                            requirement,
                            nextCandidateMap,
                            occupancy
                        );


                    if (
                        valid.length === 0
                    ) {

                        possible = false;


                        console.log(
                            `FORWARD CHECK FAILED: ` +
                            `Section ${nextSection.section_name} ` +
                            `-> ${requirement.subject_code} ` +
                            `${requirement.type}`
                        );


                        break;
                    }
                }


                if (!possible) {
                    break;
                }
            }


            /*
             * ------------------------------------------------------
             * RECURSE
             * ------------------------------------------------------
             */

            if (possible) {

                const success =
                    await solve();


                if (success) {

                    return true;
                }
            }


            /*
             * ------------------------------------------------------
             * BACKTRACK
             * ------------------------------------------------------
             */

            console.log(
                `BACKTRACK: Section ` +
                `${section.section_name} ` +
                `Solution #${solutionNumber}`
            );


            solvedSections.delete(
                sectionIndex
            );


            finalAssignments.delete(
                sectionIndex
            );


            releaseSectionAssignments(
                solution.assignments,
                occupancy
            );


            if (
                exceededLimit()
            ) {

                return false;
            }
        }


        /*
         * ----------------------------------------------------------
         * NO SOLUTION
         * ----------------------------------------------------------
         */

        return false;
    };


    /*
     * --------------------------------------------------------------
     * START SOLVER
     * --------------------------------------------------------------
     */

    const success =
        await solve();


    /*
     * --------------------------------------------------------------
     * FLATTEN RESULTS
     * --------------------------------------------------------------
     */

    const assignments = [];


    if (success) {

        for (
            const sectionAssignments
            of finalAssignments.values()
        ) {

            assignments.push(
                ...sectionAssignments
            );
        }
    }


    /*
     * --------------------------------------------------------------
     * RESULT
     * --------------------------------------------------------------
 */

    return {

        success,

        assignments,

        globalSearchNodes,

        elapsed:
            Date.now() - startTime
    };
};


/*
|--------------------------------------------------------------------------
| SAVE EVERYTHING
|--------------------------------------------------------------------------
*/

const saveAllSchedules = async (
    allAssignments,
    academicTermId
) => {

    for (
        const assignment
        of allAssignments
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

                assignment.requirement.subject_id,

                assignment.professor.id,

                assignment.room.id,

                slot.id,

                academicTermId
            ]);
        }
    }
};


/*
|--------------------------------------------------------------------------
| MAIN GENERATOR
|--------------------------------------------------------------------------
*/

const generateSchedules = async (req) => {

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
        "SECTION-BY-SECTION GLOBAL BACKTRACKING"
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
     * SECTIONS
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
        `Sections: ${sections.length}`
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


    const slotsByDay =
        groupSlotsByDay(
            timeSlots
        );


    /*
     * --------------------------------------------------------------
     * EXTERNAL OCCUPANCY
     * --------------------------------------------------------------
     */

    const occupancy =
        await loadExternalOccupancy(
            programId,
            academicTermId
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


    /*
     * --------------------------------------------------------------
     * PREPARE SECTIONS
     * --------------------------------------------------------------
     */

    const preparedSections = [];

    const allSubjectIds =
        new Set();


    for (const section of sections) {

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

            throw new Error(
                `No subjects found for Section ` +
                `${section.section_name}.`
            );
        }


        section.requirements =
            buildRequirements(
                section.subjects
            );


        for (
            const requirement
            of section.requirements
        ) {

            allSubjectIds.add(
                requirement.subject_id
            );
        }


        preparedSections.push(
            section
        );
    }


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
     * VALIDATE PROFESSORS FIRST
     * --------------------------------------------------------------
     */

    for (
        const section
        of preparedSections
    ) {

        for (
            const requirement
            of section.requirements
        ) {

            const professors =
                professorMap.get(
                    requirement.subject_id
                ) || [];


            if (
                professors.length === 0
            ) {

                throw new Error(
                    `No professor assigned to ` +
                    `${requirement.subject_code}.`
                );
            }
        }
    }


    /*
     * --------------------------------------------------------------
     * WINDOWS
     * --------------------------------------------------------------
     */

    const uniqueHours =
        [
            ...new Set(
                preparedSections.flatMap(
                    section =>
                        section.requirements.map(
                            requirement =>
                                requirement.hours
                        )
                )
            )
        ];


    const windows =
        new Map();


    for (const hours of uniqueHours) {

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

    const candidateMaps = [];


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


        const candidateMap =
            buildSectionCandidateMap(
                section,
                section.requirements,
                professorMap,
                rooms,
                windows
            );


        candidateMaps.push(
            candidateMap
        );
    }


    /*
     * --------------------------------------------------------------
     * GLOBAL SOLVER
     * --------------------------------------------------------------
     */

    const result =
        await solveAllSections({

            sections:
                preparedSections,

            candidateMaps,

            occupancy
        });


    console.log(
        "\n========================================"
    );

    console.log(
        "GLOBAL SOLVER FINISHED"
    );

    console.log(
        `Success: ${result.success}`
    );

    console.log(
        `Global search nodes: ` +
        `${result.globalSearchNodes}`
    );

    console.log(
        `Assignments: ` +
        `${result.assignments.length}`
    );

    console.log(
        `Time: ${result.elapsed} ms`
    );

    console.log(
        "========================================"
    );


    /*
     * --------------------------------------------------------------
     * FAILURE
     * --------------------------------------------------------------
     */

    if (!result.success) {

        throw new Error(
            `Unable to generate a valid schedule for ` +
            `all ${preparedSections.length} sections. ` +
            `Global search nodes: ` +
            `${result.globalSearchNodes}, ` +
            `Time: ${result.elapsed}ms`
        );
    }


    const allAssignments =
        result.assignments;


    /*
     * --------------------------------------------------------------
     * TRANSACTION
     * --------------------------------------------------------------
     */

    await db.query(
        "START TRANSACTION"
    );


    try {

        /*
         * DELETE OLD SCHEDULES
         */

        await db.query(`
            DELETE cs

            FROM class_schedules cs

            JOIN sections s
                ON s.id = cs.section_id

            WHERE s.program_id = ?
            AND s.academic_term_id = ?
        `, [
            programId,
            academicTermId
        ]);


        /*
         * INSERT NEW SCHEDULES
         */

        await saveAllSchedules(
            allAssignments,
            academicTermId
        );


        /*
         * COMMIT
         */

        await db.query(
            "COMMIT"
        );

    } catch (error) {

        await db.query(
            "ROLLBACK"
        );

        throw error;
    }


    /*
     * --------------------------------------------------------------
     * RESPONSE
     * --------------------------------------------------------------
     */

    const schedules =
        allAssignments.map(
            assignment => {

                const slots =
                    assignment.window.slots;


                const section =
                    preparedSections.find(
                        s =>
                            s.id ===
                            assignment.sectionId
                    );


                return {

                    section:
                        section?.section_name,

                    sectionId:
                        assignment.sectionId,

                    yearLevel:
                        section?.year_level,

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
                };
            }
        );


    /*
     * --------------------------------------------------------------
     * SUCCESS
     * --------------------------------------------------------------
     */

    console.log(
        "\n========================================"
    );

    console.log(
        "SCHEDULE GENERATION SUCCESSFUL"
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

    console.log(
        `Sections: ${preparedSections.length}`
    );

    console.log(
        `Assignments: ${allAssignments.length}`
    );

    console.log(
        "========================================\n"
    );


    return {

        success: true,

        programId,

        academicTermId,

        sectionCount:
            preparedSections.length,

        requirementCount:
            allAssignments.length,

        schedules
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