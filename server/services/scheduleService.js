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
    "Saturday",
    "Sunday"
];

const DAY_INDEX = new Map(
    DAY_ORDER.map((day, index) => [day, index])
);

/*
 * IMPORTANT
 *
 * Scheduler range:
 *
 * Monday    07:00 -> 22:00
 * Tuesday   07:00 -> 22:00
 * Wednesday 07:00 -> 22:00
 * Thursday  07:00 -> 22:00
 * Friday    07:00 -> 22:00
 * Saturday  07:00 -> 22:00
 * Sunday    07:00 -> 22:00
 *
 * We rely on the time_slots table for the actual hourly slots,
 * but these boundaries prevent accidental scheduling outside
 * the intended academic window.
 */

const SCHOOL_START = "07:00:00";
const SCHOOL_END = "22:00:00";

/*
|--------------------------------------------------------------------------
| SEARCH LIMITS
|--------------------------------------------------------------------------
|
| These are deliberately lower than your old configuration.
|
| Easy sections should finish through GREEDY.
| Only difficult sections enter BACKTRACKING.
|
*/

const MAX_BACKTRACK_NODES_PER_SECTION = 15000;
const MAX_TIME_MS_PER_SECTION = 2500;

const GREEDY_CANDIDATE_LIMIT = 40;
const BACKTRACK_CANDIDATE_LIMIT = 80;

const MAX_MRV_SCAN = 100;


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

const num = value => Number(value);

const normalizeTime = value => {

    if (value == null) {
        return "";
    }

    return String(value)
        .split(".")[0]
        .trim();
};


const timeToMinutes = value => {

    const normalized =
        normalizeTime(value);

    if (!normalized) {
        return -1;
    }

    const parts =
        normalized.split(":");

    return (
        Number(parts[0]) * 60 +
        Number(parts[1])
    );
};


const isInsideSchoolHours = slot => {

    const start =
        timeToMinutes(slot.start_time);

    const end =
        timeToMinutes(slot.end_time);

    return (
        start >= timeToMinutes(SCHOOL_START) &&
        end <= timeToMinutes(SCHOOL_END)
    );
};


/*
|--------------------------------------------------------------------------
| OCCUPANCY
|--------------------------------------------------------------------------
*/

const createOccupancy = () => {

    return {

        sectionSlots: new Map(),

        professorSlots: new Map(),

        roomSlots: new Map(),

        /*
         * Used only for scoring.
         *
         * Number of occupied hourly slots per day.
         */

        dayLoad: new Map(
            DAY_ORDER.map(day => [day, 0])
        )
    };
};


const getOccupiedSet = (
    map,
    key
) => {

    return map.get(num(key)) || null;
};


const hasSlotConflict = (
    map,
    key,
    slotIds
) => {

    const occupied =
        getOccupiedSet(
            map,
            key
        );

    if (!occupied) {
        return false;
    }

    for (const slotId of slotIds) {

        if (
            occupied.has(
                num(slotId)
            )
        ) {
            return true;
        }
    }

    return false;
};


const reserveSlotIds = (
    map,
    key,
    slotIds
) => {

    key = num(key);

    let occupied =
        map.get(key);

    if (!occupied) {

        occupied = new Set();

        map.set(
            key,
            occupied
        );
    }

    for (const slotId of slotIds) {

        occupied.add(
            num(slotId)
        );
    }
};


const releaseSlotIds = (
    map,
    key,
    slotIds
) => {

    key = num(key);

    const occupied =
        map.get(key);

    if (!occupied) {
        return;
    }

    for (const slotId of slotIds) {

        occupied.delete(
            num(slotId)
        );
    }

    if (occupied.size === 0) {
        map.delete(key);
    }
};


/*
|--------------------------------------------------------------------------
| DAY LOAD
|--------------------------------------------------------------------------
*/

const reserveDayLoad = (
    occupancy,
    day,
    hours
) => {

    occupancy.dayLoad.set(
        day,
        (
            occupancy.dayLoad.get(day) || 0
        ) + hours
    );
};


const releaseDayLoad = (
    occupancy,
    day,
    hours
) => {

    occupancy.dayLoad.set(
        day,
        Math.max(
            0,
            (
                occupancy.dayLoad.get(day) || 0
            ) - hours
        )
    );
};


/*
|--------------------------------------------------------------------------
| ASSIGNMENT
|--------------------------------------------------------------------------
*/

const reserveAssignment = (
    assignment,
    occupancy
) => {

    reserveSlotIds(
        occupancy.sectionSlots,
        assignment.sectionId,
        assignment.slotIds
    );

    reserveSlotIds(
        occupancy.professorSlots,
        assignment.professorId,
        assignment.slotIds
    );

    reserveSlotIds(
        occupancy.roomSlots,
        assignment.roomId,
        assignment.slotIds
    );

    reserveDayLoad(
        occupancy,
        assignment.day,
        assignment.slotIds.length
    );
};


const releaseAssignment = (
    assignment,
    occupancy
) => {

    releaseSlotIds(
        occupancy.sectionSlots,
        assignment.sectionId,
        assignment.slotIds
    );

    releaseSlotIds(
        occupancy.professorSlots,
        assignment.professorId,
        assignment.slotIds
    );

    releaseSlotIds(
        occupancy.roomSlots,
        assignment.roomId,
        assignment.slotIds
    );

    releaseDayLoad(
        occupancy,
        assignment.day,
        assignment.slotIds.length
    );
};


const releaseAssignments = (
    assignments,
    occupancy
) => {

    for (
        let i = assignments.length - 1;
        i >= 0;
        i--
    ) {

        releaseAssignment(
            assignments[i],
            occupancy
        );
    }
};


/*
|--------------------------------------------------------------------------
| SECTIONS
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
            academic_term_id,
            max_students
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

    return num(
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
| REQUIREMENTS
|--------------------------------------------------------------------------
*/

const buildRequirements = subjects => {

    const requirements = [];

    let requirementId = 0;

    for (const subject of subjects) {

        const lectureUnits =
            num(subject.lecture_units || 0);

        const labUnits =
            num(subject.lab_units || 0);

        if (lectureUnits > 0) {

            requirements.push({

                id:
                    requirementId++,

                subject_id:
                    num(subject.subject_id),

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

        if (labUnits > 0) {

            requirements.push({

                id:
                    requirementId++,

                subject_id:
                    num(subject.subject_id),

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
        AND day IN (
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday'
        )
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

    return rows
        .map(row => ({

            id:
                num(row.id),

            day:
                row.day,

            start_time:
                normalizeTime(row.start_time),

            end_time:
                normalizeTime(row.end_time)
        }))
        .filter(isInsideSchoolHours);
};


/*
|--------------------------------------------------------------------------
| GROUP SLOTS
|--------------------------------------------------------------------------
*/

const groupSlotsByDay = slots => {

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

    for (const slotsOfDay of map.values()) {

        slotsOfDay.sort(
            (a, b) =>
                timeToMinutes(a.start_time) -
                timeToMinutes(b.start_time)
        );
    }

    return map;
};


/*
|--------------------------------------------------------------------------
| WINDOWS
|--------------------------------------------------------------------------
|
| A window is a consecutive block.
|
| 3 hours:
| 07-10
| 08-11
| ...
| 19-22
|
| 6 hours:
| 07-13
| ...
| 16-22
|
|--------------------------------------------------------------------------
*/

const buildWindows = (
    slotsByDay,
    hours
) => {

    hours = num(hours);

    const windows = [];

    if (hours <= 0) {
        return windows;
    }

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

                if (
                    timeToMinutes(
                        candidate[j - 1].end_time
                    ) !==
                    timeToMinutes(
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

                dayIndex:
                    DAY_INDEX.get(day),

                slots:
                    candidate,

                slotIds:
                    candidate.map(
                        slot => num(slot.id)
                    ),

                start_time:
                    candidate[0].start_time,

                end_time:
                    candidate[
                        candidate.length - 1
                    ].end_time,

                hours
            });
        }
    }

    return windows;
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

        const subjectId =
            num(row.subject_id);

        if (!map.has(subjectId)) {
            map.set(subjectId, []);
        }

        map.get(subjectId).push({

            id:
                num(row.id),

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

    return rows.map(room => ({

        id:
            num(room.id),

        room_name:
            room.room_name,

        room_type:
            room.room_type,

        capacity:
            num(room.capacity)
    }));
};


/*
|--------------------------------------------------------------------------
| EXISTING SCHEDULES
|--------------------------------------------------------------------------
*/

const loadExistingSchedules = async (
    academicTermId
) => {

    const [rows] = await db.query(`
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

    return rows.map(row => ({

        ...row,

        section_id:
            num(row.section_id),

        subject_id:
            num(row.subject_id),

        professor_id:
            num(row.professor_id),

        room_id:
            num(row.room_id),

        time_slot_id:
            num(row.time_slot_id)
    }));
};


/*
|--------------------------------------------------------------------------
| EXISTING REQUIREMENT COUNTS
|--------------------------------------------------------------------------
*/

const getExistingRequirementCounts = rows => {

    const map = new Map();

    for (const row of rows) {

        const sectionId =
            num(row.section_id);

        const subjectId =
            num(row.subject_id);

        if (!map.has(sectionId)) {
            map.set(
                sectionId,
                new Map()
            );
        }

        const sectionMap =
            map.get(sectionId);

        const type =
            row.room_type === "laboratory"
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
| MISSING REQUIREMENTS
|--------------------------------------------------------------------------
*/

const getMissingRequirements = (
    section,
    counts
) => {

    const sectionCounts =
        counts.get(
            num(section.id)
        ) || new Map();

    const missing = [];

    for (const requirement of section.requirements) {

        const key =
            `${requirement.subject_id}:${requirement.type}`;

        const existing =
            sectionCounts.get(key) || 0;

        if (
            existing >=
            requirement.hours
        ) {
            continue;
        }

        missing.push({

            ...requirement,

            remainingHours:
                requirement.hours -
                existing
        });
    }

    return missing;
};


/*
|--------------------------------------------------------------------------
| VALID ROOMS
|--------------------------------------------------------------------------
*/

const getValidRooms = (
    requirement,
    section,
    rooms
) => {

    const requiredType =
        requirement.type === "laboratory"
            ? "laboratory"
            : "lecture";

    return rooms.filter(room => {

        if (
            room.room_type !==
            requiredType
        ) {
            return false;
        }

        return (
            room.capacity >=
            num(section.student_count)
        );
    });
};


/*
|--------------------------------------------------------------------------
| RESOURCE CONFLICT
|--------------------------------------------------------------------------
*/

const candidateHasConflict = (
    candidate,
    occupancy
) => {

    if (
        hasSlotConflict(
            occupancy.sectionSlots,
            candidate.sectionId,
            candidate.slotIds
        )
    ) {
        return true;
    }

    if (
        hasSlotConflict(
            occupancy.professorSlots,
            candidate.professorId,
            candidate.slotIds
        )
    ) {
        return true;
    }

    if (
        hasSlotConflict(
            occupancy.roomSlots,
            candidate.roomId,
            candidate.slotIds
        )
    ) {
        return true;
    }

    return false;
};


/*
|--------------------------------------------------------------------------
| CANDIDATE CREATION
|--------------------------------------------------------------------------
*/

const makeCandidate = (
    section,
    requirement,
    professor,
    room,
    window
) => {

    return {

        sectionId:
            num(section.id),

        requirementId:
            num(requirement.id),

        requirement,

        professor,
        professorId:
            num(professor.id),

        room,
        roomId:
            num(room.id),

        window,

        slotIds:
            window.slotIds,

        day:
            window.day,

        dayIndex:
            window.dayIndex,

        start_time:
            window.start_time,

        end_time:
            window.end_time,

        studentCount:
            num(section.student_count),

        roomWaste:
            room.capacity -
            num(section.student_count)
    };
};


/*
|--------------------------------------------------------------------------
| DAY BALANCING SCORE
|--------------------------------------------------------------------------
|
| THIS fixes the previous behavior.
|
| Old behavior:
|
| Monday 07-10
| Monday 10-13
| Monday 13-16
| Monday 16-19
|
| New behavior considers:
|
| current day load
| section's own load
| professor load
| room load
| time of day
|
| So Monday isn't automatically consumed first.
|--------------------------------------------------------------------------
*/

const scoreCandidate = (
    candidate,
    occupancy,
    professorMap
) => {

    const dayLoad =
        occupancy.dayLoad.get(
            candidate.day
        ) || 0;

    const professorLoad =
        occupancy.professorSlots
            .get(candidate.professorId)
            ?.size || 0;

    const roomLoad =
        occupancy.roomSlots
            .get(candidate.roomId)
            ?.size || 0;

    const professorCount =
        (
            professorMap.get(
                candidate.requirement.subject_id
            ) || []
        ).length;

    /*
     * Resource scarcity.
     */

    const professorScarcity =
        professorCount <= 1
            ? 30000
            : professorCount === 2
                ? 8000
                : professorCount === 3
                    ? 2000
                    : 0;

    /*
     * Spread classes over the week.
     *
     * Day load is intentionally weighted heavily.
     */

    const dayBalanceScore =
        dayLoad * 250;

    /*
     * Slightly prefer earlier days only AFTER
     * considering the current day load.
     */

    const dayPreference =
        candidate.dayIndex * 3;

    /*
     * Avoid excessive room waste.
     */

    const roomWasteScore =
        candidate.roomWaste * 2;

    /*
     * Earlier time gets only a SMALL preference.
     *
     * This is important.
     *
     * We don't want:
     *
     * Monday 7AM
     * Monday 10AM
     * Monday 1PM
     * ...
     *
     * simply because it is early.
     */

    const startMinutes =
        timeToMinutes(
            candidate.start_time
        );

    const timePreference =
        Math.max(
            0,
            startMinutes -
            timeToMinutes(SCHOOL_START)
        ) / 30;

    return (
        dayBalanceScore +
        professorLoad * 30 +
        roomLoad * 10 +
        professorScarcity +
        roomWasteScore +
        dayPreference +
        timePreference
    );
};


/*
|--------------------------------------------------------------------------
| PRECOMPUTED REQUIREMENT OPTIONS
|--------------------------------------------------------------------------
|
| We precompute professor + room combinations.
|
| Windows are already precomputed.
|
| Occupancy is checked only when actually solving.
|--------------------------------------------------------------------------
*/

const buildRequirementOptions = ({
    section,
    requirement,
    windowsByHours,
    professorMap,
    rooms
}) => {

    const hours =
        num(
            requirement.remainingHours ||
            requirement.hours
        );

    const windows =
        windowsByHours.get(hours) || [];

    const professors =
        professorMap.get(
            num(requirement.subject_id)
        ) || [];

    const validRooms =
        getValidRooms(
            requirement,
            section,
            rooms
        );

    const options = [];

    if (
        windows.length === 0 ||
        professors.length === 0 ||
        validRooms.length === 0
    ) {
        return options;
    }

    /*
     * Smaller adequate rooms first.
     */

    validRooms.sort(
        (a, b) => {

            const wasteA =
                a.capacity -
                section.student_count;

            const wasteB =
                b.capacity -
                section.student_count;

            return (
                wasteA - wasteB ||
                a.id - b.id
            );
        }
    );

    /*
     * Important:
     *
     * We DON'T create unlimited candidate objects.
     *
     * We store compact references.
     */

    for (const window of windows) {

        for (const professor of professors) {

            for (const room of validRooms) {

                options.push({

                    professor,
                    room,
                    window
                });
            }
        }
    }

    return options;
};


/*
|--------------------------------------------------------------------------
| CANDIDATE POOL
|--------------------------------------------------------------------------
*/

const getCandidatePool = ({
    section,
    requirement,
    options,
    occupancy,
    professorMap,
    limit
}) => {

    if (!options.length) {

        return {

            candidates: [],

            totalValid: 0
        };
    }

    const candidates = [];

    let totalValid = 0;

    for (const option of options) {

        const candidate =
            makeCandidate(
                section,
                requirement,
                option.professor,
                option.room,
                option.window
            );

        if (
            candidateHasConflict(
                candidate,
                occupancy
            )
        ) {
            continue;
        }

        totalValid++;

        /*
         * For normal cases we keep only a small pool.
         */

        if (
            candidates.length <
            limit
        ) {

            candidates.push(candidate);

            continue;
        }

        /*
         * Find current worst.
         */

        let worstIndex = 0;

        let worstScore =
            scoreCandidate(
                candidates[0],
                occupancy,
                professorMap
            );

        for (
            let i = 1;
            i < candidates.length;
            i++
        ) {

            const score =
                scoreCandidate(
                    candidates[i],
                    occupancy,
                    professorMap
                );

            if (
                score >
                worstScore
            ) {

                worstScore =
                    score;

                worstIndex =
                    i;
            }
        }

        const newScore =
            scoreCandidate(
                candidate,
                occupancy,
                professorMap
            );

        if (
            newScore <
            worstScore
        ) {

            candidates[
                worstIndex
            ] = candidate;
        }
    }

    candidates.sort(
        (a, b) =>
            scoreCandidate(
                a,
                occupancy,
                professorMap
            ) -
            scoreCandidate(
                b,
                occupancy,
                professorMap
            )
    );

    return {

        candidates,

        totalValid
    };
};


/*
|--------------------------------------------------------------------------
| REQUIREMENT FLEXIBILITY
|--------------------------------------------------------------------------
|
| FAST VERSION
|
| We stop scanning as soon as we know enough.
|--------------------------------------------------------------------------
*/

const estimateFlexibility = ({
    requirement,
    options,
    occupancy
}) => {

    if (!options.length) {
        return 0;
    }

    let count = 0;

    let scanned = 0;

    for (const option of options) {

        scanned++;

        const candidate = {

            sectionId:
                requirement.__sectionId,

            professorId:
                option.professor.id,

            roomId:
                option.room.id,

            slotIds:
                option.window.slotIds
        };

        if (
            hasSlotConflict(
                occupancy.sectionSlots,
                candidate.sectionId,
                candidate.slotIds
            )
        ) {
            continue;
        }

        if (
            hasSlotConflict(
                occupancy.professorSlots,
                candidate.professorId,
                candidate.slotIds
            )
        ) {
            continue;
        }

        if (
            hasSlotConflict(
                occupancy.roomSlots,
                candidate.roomId,
                candidate.slotIds
            )
        ) {
            continue;
        }

        count++;

        if (
            count >= 20 ||
            scanned >= MAX_MRV_SCAN
        ) {
            break;
        }
    }

    return count;
};


/*
|--------------------------------------------------------------------------
| SELECT MRV
|--------------------------------------------------------------------------
*/

const selectMRV = ({
    section,
    requirements,
    assignedIds,
    requirementOptions,
    occupancy
}) => {

    let selected = null;

    let bestFlexibility =
        Infinity;

    for (const requirement of requirements) {

        if (
            assignedIds.has(
                requirement.id
            )
        ) {
            continue;
        }

        requirement.__sectionId =
            num(section.id);

        const options =
            requirementOptions.get(
                requirement.id
            ) || [];

        const flexibility =
            estimateFlexibility({

                requirement,

                options,

                occupancy
            });

        if (
            flexibility === 0
        ) {

            return {

                requirement,

                flexibility: 0
            };
        }

        if (
            flexibility <
            bestFlexibility
        ) {

            bestFlexibility =
                flexibility;

            selected =
                requirement;
        }
    }

    return {

        requirement:
            selected,

        flexibility:
            bestFlexibility
    };
};


/*
|--------------------------------------------------------------------------
| FORWARD CHECK
|--------------------------------------------------------------------------
*/

const forwardCheck = ({
    section,
    requirements,
    assignedIds,
    requirementOptions,
    occupancy
}) => {

    for (const requirement of requirements) {

        if (
            assignedIds.has(
                requirement.id
            )
        ) {
            continue;
        }

        requirement.__sectionId =
            num(section.id);

        const options =
            requirementOptions.get(
                requirement.id
            ) || [];

        if (
            estimateFlexibility({

                requirement,

                options,

                occupancy
            }) === 0
        ) {
            return false;
        }
    }

    return true;
};


/*
|--------------------------------------------------------------------------
| GREEDY SOLVER
|--------------------------------------------------------------------------
*/

const solveGreedy = ({
    section,
    requirements,
    requirementOptions,
    professorMap,
    occupancy
}) => {

    const start =
        Date.now();

    console.log(
        `[GREEDY] Starting ${section.section_name}`
    );

    const assignments = [];

    const assignedIds =
        new Set();

    while (
        assignedIds.size <
        requirements.length
    ) {

        const selected =
            selectMRV({

                section,

                requirements,

                assignedIds,

                requirementOptions,

                occupancy
            });

        if (
            !selected.requirement ||
            selected.flexibility === 0
        ) {

            releaseAssignments(
                assignments,
                occupancy
            );

            return {

                success: false,

                assignments: [],

                failedRequirement:
                    selected.requirement || null,

                elapsed:
                    Date.now() - start
            };
        }

        const requirement =
            selected.requirement;

        const options =
            requirementOptions.get(
                requirement.id
            ) || [];

        const pool =
            getCandidatePool({

                section,

                requirement,

                options,

                occupancy,

                professorMap,

                limit:
                    GREEDY_CANDIDATE_LIMIT
            });

        if (
            !pool.candidates.length
        ) {

            releaseAssignments(
                assignments,
                occupancy
            );

            return {

                success: false,

                assignments: [],

                failedRequirement:
                    requirement,

                elapsed:
                    Date.now() - start
            };
        }

        const candidate =
            pool.candidates[0];

        reserveAssignment(
            candidate,
            occupancy
        );

        assignments.push(
            candidate
        );

        assignedIds.add(
            requirement.id
        );

        console.log(
            `[GREEDY] ${section.section_name} | ` +
            `${requirement.subject_code} ` +
            `${requirement.type} | ` +
            `${candidate.day} ` +
            `${candidate.start_time}-` +
            `${candidate.end_time} | ` +
            `${candidate.room.room_name} | ` +
            `${candidate.professor.firstname} ` +
            `${candidate.professor.lastname}`
        );
    }

    return {

        success: true,

        assignments,

        elapsed:
            Date.now() - start
    };
};


/*
|--------------------------------------------------------------------------
| BACKTRACKING
|--------------------------------------------------------------------------
*/

const solveBacktracking = ({
    section,
    requirements,
    requirementOptions,
    professorMap,
    occupancy
}) => {

    const start =
        Date.now();

    let nodes = 0;

    let timeout = false;

    let nodeLimit = false;

    const assignments = [];

    const assignedIds =
        new Set();


    const backtrack = () => {

        nodes++;

        if (
            Date.now() - start >=
            MAX_TIME_MS_PER_SECTION
        ) {

            timeout = true;

            return false;
        }

        if (
            nodes >
            MAX_BACKTRACK_NODES_PER_SECTION
        ) {

            nodeLimit = true;

            return false;
        }

        if (
            assignedIds.size ===
            requirements.length
        ) {

            return true;
        }

        const selected =
            selectMRV({

                section,

                requirements,

                assignedIds,

                requirementOptions,

                occupancy
            });

        if (
            !selected.requirement ||
            selected.flexibility === 0
        ) {

            return false;
        }

        const requirement =
            selected.requirement;

        const options =
            requirementOptions.get(
                requirement.id
            ) || [];

        const pool =
            getCandidatePool({

                section,

                requirement,

                options,

                occupancy,

                professorMap,

                limit:
                    BACKTRACK_CANDIDATE_LIMIT
            });

        if (
            !pool.candidates.length
        ) {

            return false;
        }

        for (
            const candidate
            of pool.candidates
        ) {

            if (
                timeout ||
                nodeLimit
            ) {
                return false;
            }

            if (
                candidateHasConflict(
                    candidate,
                    occupancy
                )
            ) {
                continue;
            }

            reserveAssignment(
                candidate,
                occupancy
            );

            assignments.push(
                candidate
            );

            assignedIds.add(
                requirement.id
            );

            if (
                forwardCheck({

                    section,

                    requirements,

                    assignedIds,

                    requirementOptions,

                    occupancy
                }) &&
                backtrack()
            ) {

                return true;
            }

            assignedIds.delete(
                requirement.id
            );

            assignments.pop();

            releaseAssignment(
                candidate,
                occupancy
            );
        }

        return false;
    };


    const success =
        backtrack();

    if (!success) {

        releaseAssignments(
            assignments,
            occupancy
        );
    }

    return {

        success,

        assignments:
            success
                ? [...assignments]
                : [],

        nodes,

        elapsed:
            Date.now() - start,

        timeout,

        nodeLimit,

        failureType:
            success
                ? null
                : timeout
                    ? "SEARCH_TIMEOUT"
                    : nodeLimit
                        ? "NODE_LIMIT"
                        : "CONSTRAINT_FAILURE"
    };
};


/*
|--------------------------------------------------------------------------
| HYBRID SOLVER
|--------------------------------------------------------------------------
*/

const solveHybrid = async ({
    section,
    requirements,
    requirementOptions,
    professorMap,
    occupancy
}) => {

    console.log(
        `\n[HYBRID] Solving ${section.section_name}`
    );

    /*
     * FIRST:
     *
     * Very fast greedy.
     */

    const greedy =
        solveGreedy({

            section,

            requirements,

            requirementOptions,

            professorMap,

            occupancy
        });

    if (
        greedy.success
    ) {

        console.log(
            `[HYBRID] Greedy succeeded for ` +
            `${section.section_name} ` +
            `(${greedy.elapsed}ms)`
        );

        return {

            success: true,

            method: "GREEDY",

            assignments:
                greedy.assignments,

            nodes: 0,

            elapsed:
                greedy.elapsed
        };
    }

    console.log(
        `[HYBRID] Greedy failed for ` +
        `${section.section_name}`
    );

    /*
     * SECOND:
     *
     * Only now use backtracking.
     */

    const backtrack =
        solveBacktracking({

            section,

            requirements,

            requirementOptions,

            professorMap,

            occupancy
        });

    console.log(
        `[BACKTRACK] ${section.section_name} | ` +
        `success=${backtrack.success} | ` +
        `nodes=${backtrack.nodes} | ` +
        `time=${backtrack.elapsed}ms`
    );

    return {

        success:
            backtrack.success,

        method:
            "BACKTRACK",

        assignments:
            backtrack.assignments,

        nodes:
            backtrack.nodes,

        elapsed:
            backtrack.elapsed,

        timeout:
            backtrack.timeout,

        nodeLimit:
            backtrack.nodeLimit,

        failureType:
            backtrack.failureType,

        failedRequirement:
            greedy.failedRequirement
    };
};


/*
|--------------------------------------------------------------------------
| RESERVE EXISTING
|--------------------------------------------------------------------------
*/

const reserveExistingSchedules = (
    rows,
    occupancy,
    slotDayMap
) => {

    for (const row of rows) {

        const slotId =
            num(row.time_slot_id);

        reserveSlotIds(
            occupancy.sectionSlots,
            row.section_id,
            [slotId]
        );

        reserveSlotIds(
            occupancy.professorSlots,
            row.professor_id,
            [slotId]
        );

        reserveSlotIds(
            occupancy.roomSlots,
            row.room_id,
            [slotId]
        );

        const day =
            slotDayMap.get(slotId);

        if (day) {

            reserveDayLoad(
                occupancy,
                day,
                1
            );
        }
    }
};


/*
|--------------------------------------------------------------------------
| SAVE
|--------------------------------------------------------------------------
*/

const saveSectionSchedules = async (
    assignments,
    academicTermId
) => {

    if (!assignments.length) {
        return;
    }

    await db.query(
        "START TRANSACTION"
    );

    try {

        for (const assignment of assignments) {

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

                    assignment.professorId,

                    assignment.roomId,

                    num(slot.id),

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
| GENERATE SCHEDULES
|--------------------------------------------------------------------------
*/

const generateSchedules = async req => {

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
        "OPTIMIZED WEEKLY RESOURCE SCHEDULER"
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

    if (!sections.length) {

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

    if (!timeSlots.length) {

        throw new Error(
            "No available time slots."
        );
    }

    const slotsByDay =
        groupSlotsByDay(
            timeSlots
        );

    const slotDayMap =
        new Map(
            timeSlots.map(
                slot => [
                    num(slot.id),
                    slot.day
                ]
            )
        );

    console.log(
        `Available time slots: ${timeSlots.length}`
    );

    for (const day of DAY_ORDER) {

        console.log(
            `[DAY] ${day}: ` +
            `${slotsByDay.get(day)?.length || 0} slots`
        );
    }

    /*
     * --------------------------------------------------------------
     * ROOMS
     * --------------------------------------------------------------
     */

    const rooms =
        await getRooms();

    if (!rooms.length) {

        throw new Error(
            "No available rooms."
        );
    }

    console.log(
        `Available rooms: ${rooms.length}`
    );

    /*
     * --------------------------------------------------------------
     * EXISTING
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

    const occupancy =
        createOccupancy();

    reserveExistingSchedules(
        existingSchedules,
        occupancy,
        slotDayMap
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

        if (!section.subjects.length) {

            console.log(
                `[SKIP] ${section.section_name} ` +
                `has no subjects`
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

        if (
            section.missingRequirements.length === 0
        ) {

            console.log(
                `[LOCKED] ${section.section_name}`
            );

            continue;
        }

        for (
            const requirement
            of section.missingRequirements
        ) {

            allSubjectIds.add(
                num(
                    requirement.subject_id
                )
            );
        }

        preparedSections.push(
            section
        );
    }

    if (!preparedSections.length) {

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

            scheduled: [],

            failed: [],

            schedules: [],

            message:
                "All sections already have complete schedules."
        };
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
     * BUILD WINDOWS ONCE
     * --------------------------------------------------------------
     */

    const uniqueHours =
        [
            ...new Set(
                preparedSections.flatMap(
                    section =>
                        section.missingRequirements.map(
                            requirement =>
                                num(
                                    requirement.remainingHours ||
                                    requirement.hours
                                )
                        )
                )
            )
        ];

    const windowsByHours =
        new Map();

    for (const hours of uniqueHours) {

        const windows =
            buildWindows(
                slotsByDay,
                hours
            );

        windowsByHours.set(
            hours,
            windows
        );

        console.log(
            `[WINDOWS] ${hours}-hour = ` +
            `${windows.length}`
        );
    }

    /*
     * --------------------------------------------------------------
     * PRECOMPUTE REQUIREMENT OPTIONS
     * --------------------------------------------------------------
     *
     * THIS IS ONE OF THE BIG PERFORMANCE IMPROVEMENTS.
     *
     * We don't repeatedly calculate:
     *
     * windows × professors × rooms
     *
     * during every MRV call.
     * --------------------------------------------------------------
     */

    for (
        const section
        of preparedSections
    ) {

        section.requirementOptions =
            new Map();

        for (
            const requirement
            of section.missingRequirements
        ) {

            const options =
                buildRequirementOptions({

                    section,

                    requirement,

                    windowsByHours,

                    professorMap,

                    rooms
                });

            section.requirementOptions.set(
                requirement.id,
                options
            );

            console.log(
                `[OPTIONS] ${section.section_name} | ` +
                `${requirement.subject_code} ` +
                `${requirement.type} | ` +
                `${options.length} options`
            );
        }
    }

    /*
     * --------------------------------------------------------------
     * SECTION ORDER
     * --------------------------------------------------------------
     *
     * Harder sections first.
     *
     * We don't fully scan every combination.
     */

    const sectionJobs =
        preparedSections.map(
            section => {

                let score = 0;

                for (
                    const requirement
                    of section.missingRequirements
                ) {

                    const options =
                        section.requirementOptions.get(
                            requirement.id
                        ) || [];

                    /*
                     * Fewer options = harder.
                     */

                    score +=
                        Math.min(
                            options.length,
                            100000
                        );
                }

                return {

                    section,

                    difficulty:
                        score
                };
            }
        );

    sectionJobs.sort(
        (a, b) =>
            a.difficulty -
            b.difficulty
    );

    console.log(
        "\n========================================"
    );

    console.log(
        "SECTION ORDER"
    );

    console.log(
        "========================================"
    );

    sectionJobs.forEach(
        (job, index) => {

            console.log(
                `${index + 1}. ` +
                `${job.section.section_name} ` +
                `options=${job.difficulty}`
            );
        }
    );

    /*
     * --------------------------------------------------------------
     * RESULTS
     * --------------------------------------------------------------
     */

    const scheduledSections = [];

    const failedSections = [];

    const generatedSchedules = [];

    /*
     * --------------------------------------------------------------
     * SOLVE
     * --------------------------------------------------------------
     */

    for (
        let index = 0;
        index < sectionJobs.length;
        index++
    ) {

        const section =
            sectionJobs[index].section;

        const sectionStart =
            Date.now();

        console.log(
            "\n========================================"
        );

        console.log(
            `[SECTION ${index + 1}/` +
            `${sectionJobs.length}] ` +
            `${section.section_name}`
        );

        console.log(
            `Students: ${section.student_count}`
        );

        console.log(
            `Requirements: ` +
            `${section.missingRequirements.length}`
        );

        console.log(
            "========================================"
        );

        const result =
            await solveHybrid({

                section,

                requirements:
                    section.missingRequirements,

                requirementOptions:
                    section.requirementOptions,

                professorMap,

                occupancy
            });

        if (result.success) {

            try {

                await saveSectionSchedules(
                    result.assignments,
                    academicTermId
                );

                scheduledSections.push(
                    section.section_name
                );

                for (
                    const assignment
                    of result.assignments
                ) {

                    generatedSchedules.push({

                        section:
                            section.section_name,

                        sectionId:
                            section.id,

                        yearLevel:
                            section.year_level,

                        subject:
                            assignment.requirement.subject_code,

                        subjectId:
                            assignment.requirement.subject_id,

                        type:
                            assignment.requirement.type,

                        professor:
                            `${assignment.professor.firstname} ${assignment.professor.lastname}`,

                        professorId:
                            assignment.professorId,

                        room:
                            assignment.room.room_name,

                        roomId:
                            assignment.roomId,

                        roomType:
                            assignment.room.room_type,

                        day:
                            assignment.day,

                        start:
                            assignment.start_time,

                        end:
                            assignment.end_time
                    });
                }

                console.log(
                    `[SAVED] ${section.section_name} ✅`
                );

                console.log(
                    `[SECTION TIME] ` +
                    `${Date.now() - sectionStart}ms`
                );

            } catch (error) {

                releaseAssignments(
                    result.assignments,
                    occupancy
                );

                failedSections.push({

                    sectionId:
                        section.id,

                    section:
                        section.section_name,

                    reason:
                        `Database save failed: ` +
                        error.message,

                    failureType:
                        "DATABASE_SAVE_FAILURE",

                    bottleneck:
                        "DATABASE",

                    bottleneckAnalysis: []
                });
            }

            continue;
        }

        /*
         * ----------------------------------------------------------
         * FAILURE
         * ----------------------------------------------------------
         */

        const failedRequirement =
            result.failedRequirement;

        failedSections.push({

            sectionId:
                section.id,

            section:
                section.section_name,

            reason:
                failedRequirement

                    ? `Unable to schedule ` +
                      `${failedRequirement.subject_code} ` +
                      `${failedRequirement.type}.`

                    : `Unable to schedule section ` +
                      `${section.section_name}.`,

            failureType:
                result.failureType ||
                "CONSTRAINT_FAILURE",

            bottleneck:
                "RESOURCE_COMBINATION",

            bottleneckAnalysis: []
        });

        console.log(
            `[FAILED] ${section.section_name} ❌`
        );

        console.log(
            `[SECTION TIME] ` +
            `${Date.now() - sectionStart}ms`
        );
    }

    /*
     * --------------------------------------------------------------
     * FINAL
     * --------------------------------------------------------------
     */

    const completeSuccess =
        failedSections.length === 0;

    const partial =
        scheduledSections.length > 0 &&
        failedSections.length > 0;

    const dayDistribution = {};

    for (const day of DAY_ORDER) {

        dayDistribution[day] =
            occupancy.dayLoad.get(day) || 0;
    }

    console.log(
        "\n========================================"
    );

    console.log(
        "SCHEDULER FINISHED"
    );

    console.log(
        "========================================"
    );

    console.log(
        `Success: ${completeSuccess}`
    );

    console.log(
        `Partial: ${partial}`
    );

    console.log(
        `Total sections: ${sections.length}`
    );

    console.log(
        `Scheduled: ${scheduledSections.length}`
    );

    console.log(
        `Failed: ${failedSections.length}`
    );

    console.log(
        "\nDAY DISTRIBUTION"
    );

    for (const day of DAY_ORDER) {

        console.log(
            `${day}: ${dayDistribution[day]} occupied hours`
        );
    }

    return {

        success:
            completeSuccess,

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

        schedules:
            generatedSchedules,

        dayDistribution,

        simulation: {

            algorithm:
                "OPTIMIZED_LAZY_GREEDY_MRV_BACKTRACK",

            schoolHours:
                `${SCHOOL_START} - ${SCHOOL_END}`,

            days:
                DAY_ORDER,

            maxBacktrackNodesPerSection:
                MAX_BACKTRACK_NODES_PER_SECTION,

            maxTimeMsPerSection:
                MAX_TIME_MS_PER_SECTION,

            greedyCandidateLimit:
                GREEDY_CANDIDATE_LIMIT,

            backtrackCandidateLimit:
                BACKTRACK_CANDIDATE_LIMIT,

            totalRooms:
                rooms.length,

            lectureRooms:
                rooms.filter(
                    room =>
                        room.room_type ===
                        "lecture"
                ).length,

            laboratoryRooms:
                rooms.filter(
                    room =>
                        room.room_type ===
                        "laboratory"
                ).length,

            availableTimeSlots:
                timeSlots.length,

            existingScheduleRows:
                existingSchedules.length
        },

        message:
            completeSuccess

                ? `All incomplete sections were scheduled successfully.`

                : partial

                    ? `Schedule generation partially completed. ` +
                      `${scheduledSections.length} section(s) scheduled and ` +
                      `${failedSections.length} section(s) failed.`

                    : `No incomplete sections could be scheduled.`
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