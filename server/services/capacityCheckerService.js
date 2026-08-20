const db = require("../config/db");

/*
|--------------------------------------------------------------------------
| CONFIG
|--------------------------------------------------------------------------
*/

const SECTION_CAPACITY = 50;

const DAY_ORDER = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
];

/*
 * Capacity checker is a forecasting tool.
 *
 * Existing schedules are LOCKED.
 * We simulate additional sections on top of them.
 */

const MAX_SIMULATION_ROUNDS = 100;
const MAX_SEARCH_NODES_PER_SECTION = 12000;
const MAX_TIME_MS_PER_SECTION = 2500;

/*
 * Overall safety limit.
 *
 * This prevents the checker from hanging forever when the
 * university is heavily occupied.
 */
const MAX_GLOBAL_TIME_MS = 30000;

const yearLevelMap = {
    1: "1st Year",
    2: "2nd Year",
    3: "3rd Year",
    4: "4th Year"
};

const log = (...args) => {
    console.log("[CAPACITY]", ...args);
};


/*
|--------------------------------------------------------------------------
| OCCUPANCY
|--------------------------------------------------------------------------
*/

const createOccupancy = () => ({
    professorSlots: new Map(),
    roomSlots: new Map()
});


const cloneOccupancy = (occupancy) => ({
    professorSlots: new Map(
        [...occupancy.professorSlots.entries()]
            .map(([id, slots]) => [id, new Set(slots)])
    ),

    roomSlots: new Map(
        [...occupancy.roomSlots.entries()]
            .map(([id, slots]) => [id, new Set(slots)])
    )
});


const reserve = (
    map,
    resourceId,
    slots
) => {

    const id = Number(resourceId);

    if (!map.has(id)) {
        map.set(id, new Set());
    }

    const occupied = map.get(id);

    for (const slot of slots) {
        occupied.add(Number(slot.id));
    }
};


const release = (
    map,
    resourceId,
    slots
) => {

    const id = Number(resourceId);

    const occupied = map.get(id);

    if (!occupied) {
        return;
    }

    for (const slot of slots) {
        occupied.delete(Number(slot.id));
    }

    if (occupied.size === 0) {
        map.delete(id);
    }
};


const hasConflict = (
    map,
    resourceId,
    slots
) => {

    const id = Number(resourceId);

    const occupied = map.get(id);

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
                'Saturday',
                'Sunday'
            ),
            start_time
    `);

    return rows.map(slot => ({
        id: Number(slot.id),
        day: slot.day,
        start_time: slot.start_time,
        end_time: slot.end_time
    }));
};

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


const buildWindows = (
    slotsByDay,
    hours
) => {

    const windows = [];

    const requiredHours = Number(hours);

    if (
        !Number.isInteger(requiredHours) ||
        requiredHours <= 0
    ) {
        return windows;
    }

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
            i <= daySlots.length - requiredHours;
            i++
        ) {

            const candidate =
                daySlots.slice(
                    i,
                    i + requiredHours
                );

            let consecutive = true;

            for (
                let j = 1;
                j < candidate.length;
                j++
            ) {

                if (
                    String(
                        candidate[j - 1].end_time
                    ) !==
                    String(
                        candidate[j].start_time
                    )
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

    return rows.map(room => ({
        id: Number(room.id),
        room_name: room.room_name,
        room_type:
            String(room.room_type).toLowerCase(),
        capacity:
            Number(room.capacity)
    }));
};


const getSuitableRooms = (
    requirement,
    rooms
) => {

    const requiredType =
        requirement.type === "laboratory"
            ? "laboratory"
            : "lecture";

    return rooms.filter(room => {

        return (
            room.room_type === requiredType &&
            room.capacity >= SECTION_CAPACITY
        );
    });
};


/*
|--------------------------------------------------------------------------
| PROFESSORS
|--------------------------------------------------------------------------
*/

const getProfessorMap = async (
    subjectIds
) => {

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
            id: Number(row.id),
            employee_id: row.employee_id,
            firstname: row.firstname,
            lastname: row.lastname,
            department: row.department
        });
    }

    return map;
};


/*
|--------------------------------------------------------------------------
| EXISTING SCHEDULE OCCUPANCY
|--------------------------------------------------------------------------
*/

const getExistingOccupancy = async (
    academicTermId
) => {

    const occupancy =
        createOccupancy();

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

    for (const row of rows) {

        if (row.professor_id != null) {

            reserve(
                occupancy.professorSlots,
                row.professor_id,
                [{ id: row.time_slot_id }]
            );
        }

        if (row.room_id != null) {

            reserve(
                occupancy.roomSlots,
                row.room_id,
                [{ id: row.time_slot_id }]
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

    const [rows] = await db.query(`
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
        id: Number(row.id),

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

    if (!normalizedYear) {
        return [];
    }

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

        WHERE
            cs.program_id = ?

        AND
            cs.year_level = ?

        AND
            cs.semester = at.semester

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

    for (const subject of subjects) {

        const lectureUnits =
            Number(
                subject.lecture_units || 0
            );

        const labUnits =
            Number(
                subject.lab_units || 0
            );

        if (lectureUnits > 0) {

            requirements.push({
                id: id++,

                subject_id:
                    Number(subject.subject_id),

                subject_code:
                    subject.subject_code,

                subject_name:
                    subject.subject_name,

                type: "lecture",

                hours: lectureUnits
            });
        }

        if (labUnits > 0) {

            requirements.push({
                id: id++,

                subject_id:
                    Number(subject.subject_id),

                subject_code:
                    subject.subject_code,

                subject_name:
                    subject.subject_name,

                type: "laboratory",

                hours: labUnits * 3
            });
        }
    }

    return requirements;
};


/*
|--------------------------------------------------------------------------
| CANDIDATES
|--------------------------------------------------------------------------
*/

const assignmentHasConflict = (
    assignment,
    occupancy,
    sectionOccupiedSlots
) => {

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

    if (
        hasConflict(
            occupancy.professorSlots,
            assignment.professor.id,
            assignment.window.slots
        )
    ) {
        return true;
    }

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


const scoreAssignment = (
    assignment,
    occupancy
) => {

    const professorLoad =
        occupancy.professorSlots
            .get(assignment.professor.id)
            ?.size || 0;

    const roomLoad =
        occupancy.roomSlots
            .get(assignment.room.id)
            ?.size || 0;

    /*
     * Prefer less-used resources.
     *
     * This is important because the capacity checker should
     * preserve scarce resources for future sections.
     */

    return (
        professorLoad * 10000 +
        roomLoad * 1000 +
        Number(assignment.room.capacity)
    );
};


const buildCandidateMap = ({
    sectionId,
    requirements,
    professorMap,
    rooms,
    windowsByHours
}) => {

    const candidateMap = new Map();

    for (const requirement of requirements) {

        const professors =
            professorMap.get(
                Number(requirement.subject_id)
            ) || [];

        const suitableRooms =
            getSuitableRooms(
                requirement,
                rooms
            );

        const windows =
            windowsByHours.get(
                Number(requirement.hours)
            ) || [];

        const candidates = [];

        for (const window of windows) {

            for (const professor of professors) {

                for (const room of suitableRooms) {

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

        candidateMap.set(
            requirement.id,
            candidates
        );
    }

    return candidateMap;
};


/*
|--------------------------------------------------------------------------
| VALID CANDIDATES
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

    for (const candidate of candidates) {

        if (
            assignmentHasConflict(
                candidate,
                occupancy,
                sectionOccupiedSlots
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
| SOLVE ONE SECTION
|--------------------------------------------------------------------------
*/

const solveSection = ({
    sectionId,
    requirements,
    candidateMap,
    occupancy,
    globalDeadline
}) => {

    const start =
        Date.now();

    let nodes = 0;

    const assignments = [];

    const assigned =
        new Set();

    const sectionOccupiedSlots =
        new Set();

    let timedOut = false;


    const backtrack = () => {

        nodes++;

        /*
         * Global timeout.
         */
        if (
            Date.now() >= globalDeadline
        ) {
            timedOut = true;
            return false;
        }

        /*
         * Per-section timeout.
         */
        if (
            Date.now() - start >=
            MAX_TIME_MS_PER_SECTION
        ) {
            timedOut = true;
            return false;
        }

        if (
            nodes >
            MAX_SEARCH_NODES_PER_SECTION
        ) {
            timedOut = true;
            return false;
        }

        /*
         * Complete.
         */
        if (
            assigned.size ===
            requirements.length
        ) {
            return true;
        }


        /*
         * MRV.
         */
        let selected =
            null;

        let candidates =
            null;

        let smallest =
            Infinity;


        for (const requirement of requirements) {

            if (
                assigned.has(
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

            if (!valid.length) {
                return false;
            }

            if (
                valid.length <
                smallest
            ) {

                smallest =
                    valid.length;

                selected =
                    requirement;

                candidates =
                    valid;
            }
        }


        if (!selected) {
            return false;
        }


        /*
         * Best candidate first.
         */
        candidates.sort(
            (a, b) =>
                scoreAssignment(a, occupancy) -
                scoreAssignment(b, occupancy)
        );


        for (const candidate of candidates) {

            if (
                Date.now() >= globalDeadline
            ) {
                timedOut = true;
                return false;
            }

            if (
                Date.now() - start >=
                MAX_TIME_MS_PER_SECTION
            ) {
                timedOut = true;
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


            /*
             * Reserve.
             */
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


            assignments.push(candidate);

            assigned.add(
                selected.id
            );


            /*
             * Forward checking.
             */
            let possible = true;

            for (const requirement of requirements) {

                if (
                    assigned.has(
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

                if (!valid.length) {

                    possible = false;
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
             * Undo.
             */
            assigned.delete(
                selected.id
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

        timedOut,

        assignments:
            success
                ? [...assignments]
                : [],

        nodes,

        elapsed:
            Date.now() - start
    };
};


/*
|--------------------------------------------------------------------------
| CURRICULUM CACHE
|--------------------------------------------------------------------------
*/

const buildCurriculumCache = async (
    programs,
    academicTermId
) => {

    const cache = new Map();

    for (const program of programs) {

        for (
            let year = 1;
            year <= 4;
            year++
        ) {

            const key =
                `${program.id}-${year}`;

            const subjects =
                await getCurriculum(
                    program.id,
                    year,
                    academicTermId
                );

            cache.set(
                key,
                subjects
            );
        }
    }

    return cache;
};


/*
|--------------------------------------------------------------------------
| BUILD ALL WINDOWS
|--------------------------------------------------------------------------
*/

const buildWindowsCache = (
    timeSlots,
    curriculumCache
) => {

    const slotsByDay =
        groupSlotsByDay(
            timeSlots
        );

    const hoursSet =
        new Set();

    for (const subjects of curriculumCache.values()) {

        const requirements =
            buildRequirements(subjects);

        for (const requirement of requirements) {
            hoursSet.add(
                requirement.hours
            );
        }
    }

    const windowsByHours =
        new Map();

    for (const hours of hoursSet) {

        windowsByHours.set(
            hours,
            buildWindows(
                slotsByDay,
                hours
            )
        );
    }

    return windowsByHours;
};


/*
|--------------------------------------------------------------------------
| SIMULATE ONE PROGRAM/YEAR
|--------------------------------------------------------------------------
*/

const simulateProgramYear = ({
    program,
    yearLevel,
    curriculumCache,
    professorMap,
    rooms,
    windowsByHours,
    globalOccupancy,
    globalDeadline,
    additionalSectionNumber
}) => {

    const key =
        `${program.id}-${yearLevel}`;

    const subjects =
        curriculumCache.get(key) || [];

    if (!subjects.length) {

        return {
            success: false,
            reason: "NO_CURRICULUM"
        };
    }


    const requirements =
        buildRequirements(subjects);

    if (!requirements.length) {

        return {
            success: false,
            reason: "NO_REQUIREMENTS"
        };
    }


    const sectionId =
        `SIM-${program.id}-${yearLevel}-${additionalSectionNumber}`;


    const candidateMap =
        buildCandidateMap({
            sectionId,
            requirements,
            professorMap,
            rooms,
            windowsByHours
        });


    /*
     * Static impossible check.
     *
     * Do this BEFORE expensive backtracking.
     */

    for (const requirement of requirements) {

        const candidates =
            candidateMap.get(
                requirement.id
            ) || [];

        if (!candidates.length) {

            return {
                success: false,

                reason:
                    "NO_STATIC_CANDIDATES",

                failedSubject:
                    requirement.subject_code,

                failedType:
                    requirement.type
            };
        }
    }


    /*
     * IMPORTANT:
     *
     * Never modify global occupancy directly.
     *
     * Only commit the cloned occupancy if the
     * entire section succeeds.
     */

    const workingOccupancy =
        cloneOccupancy(
            globalOccupancy
        );


    const result =
        solveSection({
            sectionId,
            requirements,
            candidateMap,
            occupancy:
                workingOccupancy,
            globalDeadline
        });


    if (!result.success) {

        return {
            success: false,

            reason:
                result.timedOut
                    ? "SEARCH_LIMIT"
                    : "NO_VALID_SCHEDULE",

            timedOut:
                result.timedOut,

            nodes:
                result.nodes,

            elapsed:
                result.elapsed
        };
    }


    return {

        success: true,

        occupancy:
            workingOccupancy,

        section: {

            sectionNumber:
                additionalSectionNumber,

            sectionId,

            programId:
                Number(program.id),

            programName:
                program.program_name,

            yearLevel,

            yearName:
                yearLevelMap[yearLevel],

            capacity:
                SECTION_CAPACITY,

            status:
                "SCHEDULABLE",

            assignments:
                result.assignments.map(
                    assignment => ({

                        subjectId:
                            assignment.requirement.subject_id,

                        subjectCode:
                            assignment.requirement.subject_code,

                        subjectName:
                            assignment.requirement.subject_name,

                        type:
                            assignment.requirement.type,

                        professorId:
                            assignment.professor.id,

                        professor:
                            `${assignment.professor.firstname} ` +
                            `${assignment.professor.lastname}`,

                        roomId:
                            assignment.room.id,

                        room:
                            assignment.room.room_name,

                        day:
                            assignment.window.day,

                        timeSlots:
                            assignment.window.slots.map(
                                slot => ({
                                    id:
                                        Number(slot.id),

                                    start:
                                        slot.start_time,

                                    end:
                                        slot.end_time
                                })
                            )
                    })
                ),

            searchNodes:
                result.nodes,

            elapsed:
                result.elapsed
        }
    };
};


/*
|--------------------------------------------------------------------------
| MAIN CAPACITY CHECK
|--------------------------------------------------------------------------
*/

const checkEnrollmentCapacity = async ({
    academicTermId
}) => {

    const startedAt =
        Date.now();

    const globalDeadline =
        startedAt +
        MAX_GLOBAL_TIME_MS;


    log("====================================================");
    log("UNIVERSITY CAPACITY CHECK");
    log("Academic Term:", academicTermId);
    log("Section Capacity:", SECTION_CAPACITY);
    log("====================================================");


    /*
     * LOAD BASE DATA
     */

    const [
        programs,
        timeSlots,
        rooms,
        existingData,
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
     * Existing schedules are LOCKED.
     */

    let globalOccupancy =
        cloneOccupancy(
            existingData.occupancy
        );


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
            (total, section) =>
                total +
                Number(
                    section.maxStudents ||
                    SECTION_CAPACITY
                ),
            0
        );


    /*
     * CURRICULUM
     */

    const curriculumCache =
        await buildCurriculumCache(
            programs,
            academicTermId
        );


    /*
     * SUBJECT IDS
     */

    const subjectIds =
        new Set();

    for (
        const subjects
        of curriculumCache.values()
    ) {

        for (const subject of subjects) {

            subjectIds.add(
                Number(subject.subject_id)
            );
        }
    }


    /*
     * PROFESSORS
     */

    const professorMap =
        await getProfessorMap(
            [...subjectIds]
        );


    /*
     * WINDOWS
     */

    const windowsByHours =
        buildWindowsCache(
            timeSlots,
            curriculumCache
        );


    /*
     * SIMULATION RESULTS
     */

    const additionalScheduleForecast = [];

    const failedProgramYears = [];

    let additionalSections = 0;

    let additionalCapacity = 0;

    let attempts = 0;

    let successfulSimulations = 0;

    let noValidSchedule = 0;

    let searchLimitReached = false;

    let simulationRound = 0;


    /*
     * -------------------------------------------------------
     * ROUND-ROBIN SIMULATION
     * -------------------------------------------------------
     *
     * We DON'T finish one program completely before moving
     * to another program.
     *
     * This prevents BSCS, for example, from consuming all
     * university resources before BSIT/BSN/etc. get a chance.
     *
     * Round 1:
     *   BSCS 1
     *   BSCS 2
     *   BSCS 3
     *   BSCS 4
     *   BSIT 1
     *   ...
     *
     * Round 2:
     *   BSCS 1
     *   BSCS 2
     *   ...
     *
     * Continue until no section can be added.
     */

    let activeTargets =
        programs.flatMap(
            program =>
                [1, 2, 3, 4].map(
                    yearLevel => ({
                        program,
                        yearLevel
                    })
                )
        );


    while (
        activeTargets.length > 0 &&
        simulationRound <
        MAX_SIMULATION_ROUNDS
    ) {

        if (
            Date.now() >=
            globalDeadline
        ) {

            searchLimitReached = true;
            break;
        }


        simulationRound++;

        let successfulThisRound = 0;

        const nextTargets = [];


        for (const target of activeTargets) {

            if (
                Date.now() >=
                globalDeadline
            ) {

                searchLimitReached = true;
                break;
            }


            const {
                program,
                yearLevel
            } = target;


            attempts++;


            /*
             * The section number is GLOBAL.
             *
             * This is only a forecast identifier.
             */

            const sectionNumber =
                additionalSections + 1;


            log(
                `Simulating additional section ` +
                `${sectionNumber} -> ` +
                `${program.program_name} ` +
                `${yearLevelMap[yearLevel]}`
            );


            const result =
                simulateProgramYear({

                    program,

                    yearLevel,

                    curriculumCache,

                    professorMap,

                    rooms,

                    windowsByHours,

                    globalOccupancy,

                    globalDeadline,

                    additionalSectionNumber:
                        sectionNumber

                });


            if (result.success) {

                /*
                 * COMMIT.
                 */

                globalOccupancy =
                    result.occupancy;


                additionalSections++;

                additionalCapacity +=
                    SECTION_CAPACITY;

                successfulSimulations++;

                successfulThisRound++;


                /*
                 * Save detailed successful section.
                 */

                additionalScheduleForecast.push(
                    result.section
                );


                log(
                    `SUCCESS Additional Section ` +
                    `${sectionNumber} | ` +
                    `${program.program_name} | ` +
                    `${yearLevelMap[yearLevel]} | ` +
                    `${result.section.elapsed}ms`
                );


                /*
                 * This program/year gets another chance
                 * in the next round.
                 */

                nextTargets.push(target);

            } else {

                if (result.reason === "SEARCH_LIMIT") {

                    searchLimitReached = true;

                    log(
                        `SEARCH LIMIT ` +
                        `${program.program_name} | ` +
                        `${yearLevelMap[yearLevel]}`
                    );

                } else {

                    noValidSchedule++;

                    log(
                        `FAILED ` +
                        `${program.program_name} ` +
                        `${yearLevelMap[yearLevel]} ` +
                        `| reason=${result.reason}`
                    );
                }


                /*
                 * We keep failed program/year out of the
                 * next round.
                 *
                 * This is critical to prevent the checker
                 * from getting stuck repeatedly testing the
                 * same impossible combination.
                 */

                failedProgramYears.push({

                    programId:
                        Number(program.id),

                    programName:
                        program.program_name,

                    yearLevel,

                    yearName:
                        yearLevelMap[yearLevel],

                    reason:
                        result.reason,

                    failedSubject:
                        result.failedSubject || null,

                    failedType:
                        result.failedType || null
                });
            }
        }


        /*
         * If nothing succeeded during the entire round,
         * there is no reason to continue.
         */

        if (
            successfulThisRound === 0
        ) {

            break;
        }


        activeTargets =
            nextTargets;
    }


    /*
     * -------------------------------------------------------
     * GROUP FORECAST BY PROGRAM/YEAR
     * -------------------------------------------------------
     */

    const groupedForecast =
        new Map();


    for (
        const section
        of additionalScheduleForecast
    ) {

        const key =
            `${section.programId}-${section.yearLevel}`;


        if (!groupedForecast.has(key)) {

            groupedForecast.set(key, {

                programId:
                    section.programId,

                programName:
                    section.programName,

                yearLevel:
                    section.yearLevel,

                yearName:
                    section.yearName,

                additionalSections:
                    0,

                additionalSeats:
                    0,

                sections:
                    []
            });
        }


        const group =
            groupedForecast.get(key);


        group.additionalSections++;

        group.additionalSeats +=
            section.capacity;

        group.sections.push({

            sectionNumber:
                section.sectionNumber,

            sectionId:
                section.sectionId,

            capacity:
                section.capacity,

            status:
                section.status,

            searchNodes:
                section.searchNodes,

            elapsed:
                section.elapsed
        });
    }


    const programYearForecast =
        [...groupedForecast.values()];


    /*
     * -------------------------------------------------------
     * TOTAL CAPACITY
     * -------------------------------------------------------
     */

    const universityCapacity =
        existingSectionCapacity +
        additionalCapacity;


    /*
     * -------------------------------------------------------
     * RESOURCE UTILIZATION
     * -------------------------------------------------------
     */

    const usedProfessorSlots =
        [...globalOccupancy.professorSlots.values()]
            .reduce(
                (total, slots) =>
                    total + slots.size,
                0
            );


    const usedRoomSlots =
        [...globalOccupancy.roomSlots.values()]
            .reduce(
                (total, slots) =>
                    total + slots.size,
                0
            );


    const totalProfessorSlots =
        professorMap.size > 0
            ? (
                new Set(
                    [...professorMap.values()]
                        .flat()
                        .map(
                            professor =>
                                professor.id
                        )
                ).size *
                timeSlots.length
            )
            : 0;


    const totalRoomSlots =
        rooms.length *
        timeSlots.length;


    const professorUtilization =
        totalProfessorSlots > 0
            ? Number(
                (
                    usedProfessorSlots /
                    totalProfessorSlots
                ) * 100
            ).toFixed(2)
            : 0;


    const roomUtilization =
        totalRoomSlots > 0
            ? Number(
                (
                    usedRoomSlots /
                    totalRoomSlots
                ) * 100
            ).toFixed(2)
            : 0;


    /*
     * -------------------------------------------------------
     * STATUS
     * -------------------------------------------------------
     */

    let status =
        "MAXIMUM_REACHED";

    let stopReason =
        "NO_MORE_SCHEDULABLE_SECTIONS";


    if (searchLimitReached) {

        status =
            "SIMULATION_LIMIT_REACHED";

        stopReason =
            "GLOBAL_TIME_LIMIT";
    }

    else if (
        simulationRound >=
        MAX_SIMULATION_ROUNDS
    ) {

        status =
            "SIMULATION_LIMIT_REACHED";

        stopReason =
            "MAX_ROUNDS_REACHED";
    }


    const elapsed =
        Date.now() -
        startedAt;


    /*
     * -------------------------------------------------------
     * LOG
     * -------------------------------------------------------
     */

    log("====================================================");
    log("CAPACITY RESULT");
    log("====================================================");

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
        "University capacity:",
        universityCapacity
    );

    log(
        "Confirmed additional seats:",
        additionalCapacity
    );

    log(
        "Status:",
        status
    );

    log(
        "Stop reason:",
        stopReason
    );

    log(
        "Simulation attempts:",
        attempts
    );

    log(
        "Successful simulations:",
        successfulSimulations
    );

    log(
        "No valid schedule:",
        noValidSchedule
    );

    log(
        "Simulation rounds:",
        simulationRound
    );

    log(
        "Elapsed:",
        elapsed,
        "ms"
    );


    log(
        "----------------------------------------------------"
    );

    log(
        "ADDITIONAL SCHEDULABLE SECTIONS"
    );

    for (
        const section
        of additionalScheduleForecast
    ) {

        log(
            `Section ${section.sectionNumber}:`,
            section.programName,
            "|",
            section.yearName,
            "|",
            `${section.capacity} seats`
        );
    }

    log("====================================================");


    /*
     * -------------------------------------------------------
     * RETURN
     * -------------------------------------------------------
     */

    return {

        success: true,

        message:
            "University capacity successfully simulated using scheduler-equivalent resource constraints.",

        academicTermId:


            Number(academicTermId),


        /*
         * EXISTING
         */

        existing: {

            scheduledSections:
                scheduledSections.length,

            incompleteSections:
                incompleteSections.length,

            capacity:
                existingSectionCapacity
        },


        /*
         * ADDITIONAL
         */

        additional: {

            sections:
                additionalSections,

            seats:
                additionalCapacity,

            confirmed:
                true
        },


        /*
         * TOTAL
         */

        university: {

            capacity:
                universityCapacity,

            existingCapacity:
                existingSectionCapacity,

            additionalCapacity:
                additionalCapacity,

            totalSections:
                scheduledSections.length +
                additionalSections
        },


        /*
         * THIS IS THE IMPORTANT PART FOR YOUR UI.
         *
         * Every successfully simulated section is here.
         */

        additionalScheduleForecast,

        /*
         * Grouped by program + year.
         */

        programYearForecast,


        /*
         * Failed program/year combinations.
         */

        failedProgramYears,


        /*
         * SIMULATION
         */

        simulation: {

            status,

            stopReason,

            attempts,

            successful:
                successfulSimulations,

            failed:
                noValidSchedule,

            rounds:
                simulationRound,

            elapsedMs:
                elapsed,

            maxGlobalTimeMs:
                MAX_GLOBAL_TIME_MS,

            maxRounds:
                MAX_SIMULATION_ROUNDS,

            maxSearchNodesPerSection:
                MAX_SEARCH_NODES_PER_SECTION,

            maxTimeMsPerSection:
                MAX_TIME_MS_PER_SECTION,

            algorithm:
                "MRV + Backtracking + Forward Checking",

            existingSchedulesLocked:
                true,

            simulationOnly:
                true
        },


        /*
         * RESOURCE REPORT
         */

        resources: {

            rooms: {

                total:
                    rooms.length,

                lecture:
                    rooms.filter(
                        room =>
                            room.room_type ===
                            "lecture"
                    ).length,

                laboratory:
                    rooms.filter(
                        room =>
                            room.room_type ===
                            "laboratory"
                    ).length,

                capacity:
                    rooms.reduce(
                        (total, room) =>
                            total +
                            room.capacity,
                        0
                    )
            },


            professors: {

                total:
                    new Set(
                        [...professorMap.values()]
                            .flat()
                            .map(
                                professor =>
                                    professor.id
                            )
                    ).size,

                subjectsWithProfessors:
                    professorMap.size,

                utilization:
                    professorUtilization
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
                    ).size
            },


            roomUtilization:
                roomUtilization
        }
    };
};


/*
|--------------------------------------------------------------------------
| GET PROGRAMS
|--------------------------------------------------------------------------
*/

const getPrograms = async () => {

    const [rows] = await db.query(`
        SELECT
            id,
            program_name

        FROM programs

        ORDER BY id
    `);

    return rows.map(row => ({
        id: Number(row.id),
        program_name: row.program_name
    }));
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


        return res.json(result);

    } catch (error) {

        console.error(
            "[CAPACITY CHECKER ERROR]"
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