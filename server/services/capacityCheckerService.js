const db = require("../config/db");

/*
|--------------------------------------------------------------------------
| UNIVERSITY PROFESSOR CAPACITY + SECTION SIMULATION CHECKER
|--------------------------------------------------------------------------
|
| IMPORTANT
|--------------------------------------------------------------------------
|
| Existing return fields are preserved.
|
| NEW:
|
| simulatedSections
|
| This simulation DOES NOT use:
|
|   student_sections
|
| It also DOES NOT use existing section rows to determine capacity.
|
| It calculates how many sections can theoretically be supported from:
|
|   - active professors
|   - professor max weekly hours
|   - professor qualifications
|   - curriculum
|   - lecture units
|   - laboratory units
|
| Default:
|
|   1 lecture unit = 1 hour
|   1 laboratory unit = 3 hours
|
| Student capacity:
|
|   50 students / section
|
|--------------------------------------------------------------------------
*/

const DEFAULT_MAX_WEEKLY_HOURS = 18;
const DEFAULT_STUDENTS_PER_SECTION = 50;

const MAX_SIMULATION_SECTIONS = 5000;


/*
|--------------------------------------------------------------------------
| BASIC HELPERS
|--------------------------------------------------------------------------
*/

const num = value => {

    const n = Number(value);

    return Number.isFinite(n)
        ? n
        : 0;
};


const positiveInt = value => {

    const n = Number(value);

    return Number.isInteger(n) && n > 0
        ? n
        : 0;
};


const normalizeText = value =>
    String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");


const round2 = value =>
    Number(
        Number(value || 0).toFixed(2)
    );


/*
|--------------------------------------------------------------------------
| YEAR LEVEL NORMALIZATION
|--------------------------------------------------------------------------
*/

const normalizeYearLevel = value => {

    const raw =
        normalizeText(value);

    if (!raw) {
        return "";
    }

    if (
        raw.includes("1st") ||
        raw.includes("first") ||
        raw === "1" ||
        raw === "year 1" ||
        raw === "year_1" ||
        raw === "1st year"
    ) {

        return "year_1";
    }

    if (
        raw.includes("2nd") ||
        raw.includes("second") ||
        raw === "2" ||
        raw === "year 2" ||
        raw === "year_2" ||
        raw === "2nd year"
    ) {

        return "year_2";
    }

    if (
        raw.includes("3rd") ||
        raw.includes("third") ||
        raw === "3" ||
        raw === "year 3" ||
        raw === "year_3" ||
        raw === "3rd year"
    ) {

        return "year_3";
    }

    if (
        raw.includes("4th") ||
        raw.includes("fourth") ||
        raw === "4" ||
        raw === "year 4" ||
        raw === "year_4" ||
        raw === "4th year"
    ) {

        return "year_4";
    }

    return raw.replace(/\s+/g, "_");
};


/*
|--------------------------------------------------------------------------
| SEMESTER NORMALIZATION
|--------------------------------------------------------------------------
*/

const normalizeSemester = value => {

    const raw =
        normalizeText(value);

    if (!raw) {
        return "";
    }

    if (
        raw === "1" ||
        raw === "1st" ||
        raw === "1st semester" ||
        raw === "first semester" ||
        raw.includes("1st semester") ||
        raw.includes("first semester")
    ) {

        return "1st semester";
    }

    if (
        raw === "2" ||
        raw === "2nd" ||
        raw === "2nd semester" ||
        raw === "second semester" ||
        raw.includes("2nd semester") ||
        raw.includes("second semester")
    ) {

        return "2nd semester";
    }

    if (
        raw === "summer" ||
        raw === "summer semester" ||
        raw.includes("summer")
    ) {

        return "summer";
    }

    return raw;
};


/*
|--------------------------------------------------------------------------
| DINIC MAX FLOW
|--------------------------------------------------------------------------
*/

class Dinic {

    constructor(nodeCount) {

        this.nodeCount =
            nodeCount;

        this.graph =
            Array.from(
                {
                    length: nodeCount
                },
                () => []
            );
    }


    addEdge(
        from,
        to,
        capacity
    ) {

        const safeCapacity =
            Math.max(
                0,
                Math.floor(
                    Number(capacity) || 0
                )
            );

        const forward = {

            to,

            rev:
                this.graph[to].length,

            capacity:
                safeCapacity,

            originalCapacity:
                safeCapacity
        };

        const backward = {

            to:
                from,

            rev:
                this.graph[from].length,

            capacity:
                0,

            originalCapacity:
                0
        };

        this.graph[from].push(
            forward
        );

        this.graph[to].push(
            backward
        );

        return {

            from,

            index:
                this.graph[from].length - 1
        };
    }


    bfs(
        source,
        sink
    ) {

        const level =
            new Array(
                this.nodeCount
            ).fill(-1);

        const queue = [];

        level[source] = 0;

        queue.push(source);

        let head = 0;

        while (
            head <
            queue.length
        ) {

            const node =
                queue[head++];

            for (
                const edge
                of this.graph[node]
            ) {

                if (
                    edge.capacity > 0 &&
                    level[edge.to] < 0
                ) {

                    level[edge.to] =
                        level[node] + 1;

                    queue.push(
                        edge.to
                    );
                }
            }
        }

        return level[sink] >= 0
            ? level
            : null;
    }


    dfs(
        node,
        sink,
        pushed,
        level,
        ptr
    ) {

        if (
            node === sink
        ) {

            return pushed;
        }

        while (
            ptr[node] <
            this.graph[node].length
        ) {

            const edge =
                this.graph[node][
                    ptr[node]
                ];

            if (
                edge.capacity > 0 &&
                level[edge.to] ===
                    level[node] + 1
            ) {

                const flow =
                    this.dfs(
                        edge.to,
                        sink,
                        Math.min(
                            pushed,
                            edge.capacity
                        ),
                        level,
                        ptr
                    );

                if (
                    flow > 0
                ) {

                    edge.capacity -=
                        flow;

                    this.graph[
                        edge.to
                    ][
                        edge.rev
                    ].capacity +=
                        flow;

                    return flow;
                }
            }

            ptr[node]++;
        }

        return 0;
    }


    maxFlow(
        source,
        sink
    ) {

        let flow = 0;

        while (true) {

            const level =
                this.bfs(
                    source,
                    sink
                );

            if (!level) {
                break;
            }

            const ptr =
                new Array(
                    this.nodeCount
                ).fill(0);

            while (true) {

                const pushed =
                    this.dfs(
                        source,
                        sink,
                        Number.MAX_SAFE_INTEGER,
                        level,
                        ptr
                    );

                if (
                    pushed <= 0
                ) {

                    break;
                }

                flow +=
                    pushed;
            }
        }

        return flow;
    }


    getUsedCapacity(
        edgeReference
    ) {

        const edge =
            this.graph[
                edgeReference.from
            ][
                edgeReference.index
            ];

        return (
            edge.originalCapacity -
            edge.capacity
        );
    }
}


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
        ORDER BY id ASC
    `);

    return rows.map(
        row => ({

            id:
                positiveInt(
                    row.id
                ),

            name:
                row.program_name

        })
    );
};


/*
|--------------------------------------------------------------------------
| GET ACADEMIC TERM
|--------------------------------------------------------------------------
*/

const getAcademicTerm = async academicTermId => {

    const termId =
        positiveInt(
            academicTermId
        );

    if (
        termId <= 0
    ) {

        throw new Error(
            "A valid academicTermId is required."
        );
    }

    const [rows] = await db.query(`
        SELECT
            id,
            semester
        FROM academic_terms
        WHERE id = ?
        LIMIT 1
    `, [
        termId
    ]);

    if (
        rows.length === 0
    ) {

        throw new Error(
            `Academic term with ID ${termId} was not found.`
        );
    }

    return {

        id:
            positiveInt(
                rows[0].id
            ),

        semester:
            rows[0].semester

    };
};


/*
|--------------------------------------------------------------------------
| EXISTING SECTION DATA
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| This is retained ONLY because the existing return/UI uses sectionCount.
|
| It is NOT used by the simulated section capacity.
|
|--------------------------------------------------------------------------
*/

const getProgramSections = async (
    programId,
    academicTermId
) => {

    const [rows] = await db.query(`
        SELECT
            year_level,
            COUNT(*) AS section_count
        FROM sections
        WHERE program_id = ?
          AND academic_term_id = ?
        GROUP BY year_level
        ORDER BY year_level ASC
    `, [
        programId,
        academicTermId
    ]);

    const sectionsByYearLevel =
        new Map();

    let totalSections = 0;

    for (
        const row
        of rows
    ) {

        const yearLevel =
            normalizeYearLevel(
                row.year_level
            );

        const sectionCount =
            positiveInt(
                row.section_count
            );

        if (
            !yearLevel
        ) {

            continue;
        }

        sectionsByYearLevel.set(
            yearLevel,
            sectionCount
        );

        totalSections +=
            sectionCount;
    }

    return {

        rows,

        sectionsByYearLevel,

        totalSections

    };
};


/*
|--------------------------------------------------------------------------
| GET PROGRAM CURRICULUM
|--------------------------------------------------------------------------
*/

const getProgramCurriculum = async (
    programId,
    academicTerm
) => {

    const termSemester =
        normalizeSemester(
            academicTerm?.semester
        );

    if (
        !termSemester
    ) {

        throw new Error(
            `Academic term ${academicTerm?.id || ""} has no valid semester value.`
        );
    }

    const [rows] = await db.query(`
        SELECT

            cs.id AS curriculum_subject_id,

            cs.subject_id,

            cs.year_level,

            cs.semester,

            sub.subject_code,

            sub.subject_name,

            sub.lecture_units,

            sub.lab_units

        FROM curriculum_subjects cs

        INNER JOIN subjects sub
            ON sub.id = cs.subject_id

        WHERE cs.program_id = ?

        ORDER BY
            cs.year_level ASC,
            cs.semester ASC,
            sub.subject_code ASC
    `, [
        programId
    ]);

    const filteredRows =
        rows.filter(
            row =>
                normalizeSemester(
                    row.semester
                ) ===
                termSemester
        );

    return filteredRows.map(
        row => ({

            curriculumSubjectId:
                positiveInt(
                    row.curriculum_subject_id
                ),

            subjectId:
                positiveInt(
                    row.subject_id
                ),

            yearLevel:
                String(
                    row.year_level ?? ""
                ).trim(),

            normalizedYearLevel:
                normalizeYearLevel(
                    row.year_level
                ),

            semester:
                String(
                    row.semester ?? ""
                ).trim(),

            subjectCode:
                row.subject_code,

            subjectName:
                row.subject_name,

            lectureUnits:
                Math.max(
                    0,
                    num(
                        row.lecture_units
                    )
                ),

            labUnits:
                Math.max(
                    0,
                    num(
                        row.lab_units
                    )
                )

        })
    );
};


/*
|--------------------------------------------------------------------------
| GET UNIVERSITY CURRICULUM
|--------------------------------------------------------------------------
*/

const getUniversityCurriculum = async (
    programs,
    academicTerm
) => {

    const results = [];

    for (
        const program
        of programs
    ) {

        const curriculum =
            await getProgramCurriculum(
                program.id,
                academicTerm
            );

        results.push({

            programId:
                program.id,

            programName:
                program.name,

            curriculum

        });
    }

    return results;
};


/*
|--------------------------------------------------------------------------
| SUBJECT WEEKLY HOURS
|--------------------------------------------------------------------------
*/

const getSubjectWeeklyHours = subject => {

    const lectureHours =
        Math.max(
            0,
            num(
                subject.lectureUnits
            )
        );

    const laboratoryHours =
        Math.max(
            0,
            num(
                subject.labUnits
            )
        ) * 3;

    return {

        lectureHours,

        laboratoryHours,

        totalHours:
            lectureHours +
            laboratoryHours

    };
};


/*
|--------------------------------------------------------------------------
| GET ACTIVE PROFESSOR QUALIFICATIONS
|--------------------------------------------------------------------------
*/

const getProfessorQualifications = async subjects => {

    if (
        !Array.isArray(subjects) ||
        subjects.length === 0
    ) {

        return {

            professors: [],

            qualificationsBySubject:
                new Map(),

            qualificationsByProfessor:
                new Map(),

            totalActiveProfessors:
                0,

            qualifiedProfessorCount:
                0

        };
    }

    const subjectIds =
        [
            ...new Set(
                subjects
                    .map(
                        subject =>
                            positiveInt(
                                subject.subjectId
                            )
                    )
                    .filter(
                        id => id > 0
                    )
            )
        ];

    if (
        subjectIds.length === 0
    ) {

        return {

            professors: [],

            qualificationsBySubject:
                new Map(),

            qualificationsByProfessor:
                new Map(),

            totalActiveProfessors:
                0,

            qualifiedProfessorCount:
                0

        };
    }

    const [professorRows] =
        await db.query(`
            SELECT

                p.id AS professor_id,

                p.user_id,

                p.employee_id,

                p.firstname,

                p.lastname,

                p.max_weekly_hours

            FROM profesor p

            INNER JOIN users u
                ON u.id = p.user_id

            WHERE u.role = 'professor'
              AND u.status = 'active'

            ORDER BY
                p.id ASC
        `);

    const professorMap =
        new Map();

    for (
        const row
        of professorRows
    ) {

        const professorId =
            positiveInt(
                row.professor_id
            );

        if (
            professorId <= 0
        ) {

            continue;
        }

        const maxHours =
            row.max_weekly_hours == null
                ? DEFAULT_MAX_WEEKLY_HOURS
                : Math.max(
                    0,
                    num(
                        row.max_weekly_hours
                    )
                );

        professorMap.set(
            professorId,
            {

                professorId,

                userId:
                    positiveInt(
                        row.user_id
                    ),

                employeeId:
                    row.employee_id,

                firstname:
                    row.firstname,

                lastname:
                    row.lastname,

                name:
                    `${row.firstname || ""} ${row.lastname || ""}`
                        .trim(),

                maxWeeklyHours:
                    maxHours,

                qualifiedSubjectIds:
                    new Set()

            }
        );
    }

    const qualificationsBySubject =
        new Map();

    const qualificationsByProfessor =
        new Map();

    const placeholders =
        subjectIds
            .map(
                () => "?"
            )
            .join(",");

    const [qualificationRows] =
        await db.query(`
            SELECT DISTINCT

                ps.professor_id,

                ps.subject_id

            FROM professor_subjects ps

            INNER JOIN profesor p
                ON p.id = ps.professor_id

            INNER JOIN users u
                ON u.id = p.user_id

            WHERE u.role = 'professor'
              AND u.status = 'active'
              AND ps.subject_id IN (${placeholders})

            ORDER BY
                ps.professor_id ASC,
                ps.subject_id ASC
        `, subjectIds);

    for (
        const row
        of qualificationRows
    ) {

        const professorId =
            positiveInt(
                row.professor_id
            );

        const subjectId =
            positiveInt(
                row.subject_id
            );

        if (
            professorId <= 0 ||
            subjectId <= 0
        ) {

            continue;
        }

        const professor =
            professorMap.get(
                professorId
            );

        if (!professor) {
            continue;
        }

        professor.qualifiedSubjectIds.add(
            subjectId
        );

        if (
            !qualificationsBySubject.has(
                subjectId
            )
        ) {

            qualificationsBySubject.set(
                subjectId,
                new Set()
            );
        }

        qualificationsBySubject
            .get(subjectId)
            .add(
                professorId
            );

        if (
            !qualificationsByProfessor.has(
                professorId
            )
        ) {

            qualificationsByProfessor.set(
                professorId,
                new Set()
            );
        }

        qualificationsByProfessor
            .get(professorId)
            .add(
                subjectId
            );
    }

    const professors =
        [
            ...professorMap.values()
        ];

    const qualifiedProfessorCount =
        professors.filter(
            professor =>
                professor
                    .qualifiedSubjectIds
                    .size > 0
        ).length;

    console.log(
        `[PROFESSOR POOL] Active professors: ${professors.length} | ` +
        `Qualified: ${qualifiedProfessorCount} | ` +
        `Requested subjects: ${subjectIds.length}`
    );

    return {

        professors,

        qualificationsBySubject,

        qualificationsByProfessor,

        totalActiveProfessors:
            professors.length,

        qualifiedProfessorCount

    };
};


/*
|--------------------------------------------------------------------------
| BUILD SUBJECT REQUIREMENTS
|--------------------------------------------------------------------------
*/

const buildSubjectRequirements = ({
    curriculum,
    sectionsByYearLevel,
    qualificationsBySubject,
    programId = null,
    programName = null
}) => {

    const requirements = [];

    for (
        const subject
        of curriculum
    ) {

        const weekly =
            getSubjectWeeklyHours(
                subject
            );

        const yearKey =
            normalizeYearLevel(
                subject.yearLevel
            );

        const sectionCount =
            positiveInt(
                sectionsByYearLevel.get(
                    yearKey
                )
            );

        const requiredHours =
            sectionCount *
            weekly.totalHours;

        const qualifiedSet =
            qualificationsBySubject?.get(
                subject.subjectId
            );

        const qualifiedProfessorIds =
            qualifiedSet instanceof Set
                ? [...qualifiedSet]
                : [];

        requirements.push({

            requirementKey:
                programId != null
                    ? `${programId}:${subject.curriculumSubjectId}`
                    : String(
                        subject.curriculumSubjectId
                    ),

            programId,

            programName,

            curriculumSubjectId:
                subject.curriculumSubjectId,

            subjectId:
                subject.subjectId,

            subjectCode:
                subject.subjectCode,

            subjectName:
                subject.subjectName,

            yearLevel:
                subject.yearLevel,

            normalizedYearLevel:
                yearKey,

            semester:
                subject.semester,

            lectureUnits:
                subject.lectureUnits,

            labUnits:
                subject.labUnits,

            lectureHours:
                weekly.lectureHours,

            laboratoryHours:
                weekly.laboratoryHours,

            weeklyHoursPerSection:
                weekly.totalHours,

            sectionCount,

            requiredHours,

            qualifiedProfessorIds,

            qualifiedProfessorCount:
                qualifiedProfessorIds.length,

            hasQualifiedProfessor:
                qualifiedProfessorIds.length > 0,

            missingProfessor:
                requiredHours > 0 &&
                qualifiedProfessorIds.length === 0

        });
    }

    return requirements;
};


/*
|--------------------------------------------------------------------------
| TOTAL REQUIRED HOURS
|--------------------------------------------------------------------------
*/

const calculateRequiredHours = requirements =>
    requirements.reduce(
        (
            total,
            requirement
        ) =>
            total +
            num(
                requirement.requiredHours
            ),
        0
    );


/*
|--------------------------------------------------------------------------
| MAX FLOW PROFESSOR ALLOCATION
|--------------------------------------------------------------------------
*/

const allocateProfessorHoursMaxFlow = ({
    requirements,
    professors
}) => {

    const activeRequirements =
        requirements.filter(
            requirement =>
                requirement.requiredHours > 0
        );

    if (
        activeRequirements.length === 0
    ) {

        return {

            feasible:
                true,

            requiredHours:
                0,

            allocatedHours:
                0,

            shortageHours:
                0,

            professorsUsed:
                0,

            allocations:
                [],

            requirementResults:
                [],

            allocatedByProfessor:
                new Map()

        };
    }

    const safeProfessors =
        Array.isArray(
            professors
        )
            ? professors
            : [];

    const usableProfessors =
        safeProfessors.filter(
            professor =>
                num(
                    professor.maxWeeklyHours
                ) > 0
        );

    const SOURCE = 0;

    const professorStart =
        1;

    const requirementStart =
        professorStart +
        usableProfessors.length;

    const SINK =
        requirementStart +
        activeRequirements.length;

    const nodeCount =
        SINK + 1;

    const flow =
        new Dinic(
            nodeCount
        );

    const professorNodeMap =
        new Map();

    usableProfessors.forEach(
        (
            professor,
            index
        ) => {

            const node =
                professorStart +
                index;

            professorNodeMap.set(
                professor.professorId,
                node
            );

            flow.addEdge(
                SOURCE,
                node,
                Math.floor(
                    num(
                        professor.maxWeeklyHours
                    )
                )
            );
        }
    );

    const requirementNodeMap =
        new Map();

    activeRequirements.forEach(
        (
            requirement,
            index
        ) => {

            const node =
                requirementStart +
                index;

            requirementNodeMap.set(
                requirement.requirementKey,
                node
            );

            flow.addEdge(
                node,
                SINK,
                Math.floor(
                    num(
                        requirement.requiredHours
                    )
                )
            );
        }
    );

    const professorRequirementEdges =
        [];

    for (
        const professor
        of usableProfessors
    ) {

        const professorNode =
            professorNodeMap.get(
                professor.professorId
            );

        for (
            const requirement
            of activeRequirements
        ) {

            if (
                !requirement
                    .qualifiedProfessorIds
                    .includes(
                        professor.professorId
                    )
            ) {

                continue;
            }

            const requirementNode =
                requirementNodeMap.get(
                    requirement.requirementKey
                );

            const edge =
                flow.addEdge(
                    professorNode,
                    requirementNode,
                    Math.min(
                        Math.floor(
                            num(
                                professor.maxWeeklyHours
                            )
                        ),
                        Math.floor(
                            num(
                                requirement.requiredHours
                            )
                        )
                    )
                );

            professorRequirementEdges.push({

                professorId:
                    professor.professorId,

                requirementKey:
                    requirement.requirementKey,

                subjectId:
                    requirement.subjectId,

                subjectCode:
                    requirement.subjectCode,

                subjectName:
                    requirement.subjectName,

                edge

            });
        }
    }

    const requiredHours =
        activeRequirements.reduce(
            (
                total,
                requirement
            ) =>
                total +
                Math.floor(
                    num(
                        requirement.requiredHours
                    )
                ),
            0
        );

    const allocatedHours =
        flow.maxFlow(
            SOURCE,
            SINK
        );

    const shortageHours =
        Math.max(
            0,
            requiredHours -
            allocatedHours
        );

    const allocations = [];

    const allocatedByRequirement =
        new Map();

    const allocatedByProfessor =
        new Map();

    for (
        const item
        of professorRequirementEdges
    ) {

        const used =
            flow.getUsedCapacity(
                item.edge
            );

        if (
            used <= 0
        ) {

            continue;
        }

        allocations.push({

            professorId:
                item.professorId,

            requirementKey:
                item.requirementKey,

            subjectId:
                item.subjectId,

            subjectCode:
                item.subjectCode,

            subjectName:
                item.subjectName,

            hours:
                used

        });

        allocatedByRequirement.set(
            item.requirementKey,
            (
                allocatedByRequirement.get(
                    item.requirementKey
                ) || 0
            ) + used
        );

        allocatedByProfessor.set(
            item.professorId,
            (
                allocatedByProfessor.get(
                    item.professorId
                ) || 0
            ) + used
        );
    }

    const requirementResults =
        activeRequirements.map(
            requirement => {

                const allocated =
                    allocatedByRequirement.get(
                        requirement.requirementKey
                    ) || 0;

                const shortage =
                    Math.max(
                        0,
                        requirement.requiredHours -
                        allocated
                    );

                return {

                    requirementKey:
                        requirement.requirementKey,

                    programId:
                        requirement.programId,

                    programName:
                        requirement.programName,

                    curriculumSubjectId:
                        requirement.curriculumSubjectId,

                    subjectId:
                        requirement.subjectId,

                    subjectCode:
                        requirement.subjectCode,

                    subjectName:
                        requirement.subjectName,

                    yearLevel:
                        requirement.yearLevel,

                    sectionCount:
                        requirement.sectionCount,

                    weeklyHoursPerSection:
                        requirement.weeklyHoursPerSection,

                    requiredHours:
                        requirement.requiredHours,

                    allocatedHours:
                        allocated,

                    shortageHours:
                        shortage,

                    qualifiedProfessorCount:
                        requirement.qualifiedProfessorCount,

                    feasible:
                        shortage <= 0,

                    reason:
                        requirement.qualifiedProfessorCount === 0
                            ? "NO_QUALIFIED_PROFESSOR"
                            : shortage > 0
                                ? "INSUFFICIENT_SHARED_QUALIFIED_CAPACITY"
                                : "ALLOCATED"

                };
            }
        );

    return {

        feasible:
            allocatedHours >=
            requiredHours,

        requiredHours,

        allocatedHours,

        shortageHours,

        professorsUsed:
            allocatedByProfessor.size,

        allocations,

        requirementResults,

        allocatedByProfessor

    };
};


/*
|--------------------------------------------------------------------------
| SUBJECT BOTTLENECKS
|--------------------------------------------------------------------------
*/

const calculateSubjectBottlenecks = ({
    requirementResults
}) => {

    return requirementResults
        .filter(
            requirement =>
                requirement.requiredHours > 0 &&
                requirement.shortageHours > 0
        )
        .map(
            requirement => ({

                subjectId:
                    requirement.subjectId,

                subjectCode:
                    requirement.subjectCode,

                subjectName:
                    requirement.subjectName,

                programId:
                    requirement.programId,

                programName:
                    requirement.programName,

                yearLevel:
                    requirement.yearLevel,

                sectionCount:
                    requirement.sectionCount,

                weeklyHoursPerSection:
                    requirement.weeklyHoursPerSection,

                requiredHours:
                    requirement.requiredHours,

                allocatedHours:
                    requirement.allocatedHours,

                capacityShortage:
                    requirement.shortageHours,

                qualifiedProfessorCount:
                    requirement.qualifiedProfessorCount,

                reason:
                    requirement.reason

            })
        );
};


/*
|--------------------------------------------------------------------------
| PROFESSOR DETAILS
|--------------------------------------------------------------------------
*/

const calculateProfessorDetails = ({
    professors,
    requirements,
    allocationsByProfessor
}) => {

    const safeProfessors =
        Array.isArray(
            professors
        )
            ? professors
            : [];

    return safeProfessors.map(
        professor => {

            const qualifiedRequirements =
                requirements.filter(
                    requirement =>
                        requirement.requiredHours > 0 &&
                        requirement
                            .qualifiedProfessorIds
                            .includes(
                                professor.professorId
                            )
                );

            const potentialProgramHours =
                qualifiedRequirements.reduce(
                    (
                        total,
                        requirement
                    ) =>
                        total +
                        num(
                            requirement.requiredHours
                        ),
                    0
                );

            const allocatedHours =
                allocationsByProfessor?.get(
                    professor.professorId
                ) || 0;

            const maxWeeklyHours =
                Math.max(
                    0,
                    num(
                        professor.maxWeeklyHours
                    )
                );

            return {

                professorId:
                    professor.professorId,

                userId:
                    professor.userId,

                employeeId:
                    professor.employeeId,

                name:
                    professor.name,

                maxWeeklyHours,

                qualifiedSubjects:
                    professor
                        .qualifiedSubjectIds
                        instanceof Set
                        ? [
                            ...professor
                                .qualifiedSubjectIds
                        ]
                        : [],

                qualifiedSubjectsCount:
                    professor
                        .qualifiedSubjectIds
                        instanceof Set
                        ? professor
                            .qualifiedSubjectIds
                            .size
                        : 0,

                qualifiedForActiveSubjects:
                    qualifiedRequirements.length,

                potentialProgramHours,

                allocatedHours,

                remainingCapacity:
                    Math.max(
                        0,
                        maxWeeklyHours -
                        allocatedHours
                    ),

                utilization:
                    maxWeeklyHours > 0
                        ? round2(
                            (
                                allocatedHours /
                                maxWeeklyHours
                            ) * 100
                        )
                        : 0

            };
        }
    );
};


/*
|--------------------------------------------------------------------------
| YEAR LEVEL DEMAND
|--------------------------------------------------------------------------
*/

const calculateYearLevelDemand = ({
    curriculum,
    sectionsByYearLevel
}) => {

    const yearMap =
        new Map();

    for (
        const subject
        of curriculum
    ) {

        const yearKey =
            normalizeYearLevel(
                subject.yearLevel
            );

        if (
            !yearKey
        ) {

            continue;
        }

        if (
            !yearMap.has(
                yearKey
            )
        ) {

            yearMap.set(
                yearKey,
                {

                    yearLevel:
                        subject.yearLevel,

                    normalizedYearLevel:
                        yearKey,

                    sectionCount:
                        positiveInt(
                            sectionsByYearLevel.get(
                                yearKey
                            )
                        ),

                    subjectCount:
                        0,

                    activeSubjectCount:
                        0,

                    requiredHours:
                        0

                }
            );
        }

        const entry =
            yearMap.get(
                yearKey
            );

        const weekly =
            getSubjectWeeklyHours(
                subject
            );

        entry.subjectCount++;

        if (
            entry.sectionCount > 0 &&
            weekly.totalHours > 0
        ) {

            entry.activeSubjectCount++;

            entry.requiredHours +=
                entry.sectionCount *
                weekly.totalHours;
        }
    }

    return [
        ...yearMap.values()
    ].sort(
        (
            a,
            b
        ) =>
            a.normalizedYearLevel
                .localeCompare(
                    b.normalizedYearLevel
                )
    );
};


/*
|--------------------------------------------------------------------------
| BUILD SIMULATION REQUIREMENTS
|--------------------------------------------------------------------------
*/

const buildSimulationRequirements = ({
    curriculum,
    sectionsByYearLevel,
    qualificationsBySubject,
    programId,
    programName
}) => {

    return buildSubjectRequirements({

        curriculum,

        sectionsByYearLevel,

        qualificationsBySubject,

        programId,

        programName

    });
};


/*
|--------------------------------------------------------------------------
| TEST SIMULATED SECTION COUNTS
|--------------------------------------------------------------------------
*/

const testSimulatedSectionCounts = ({
    curriculum,
    professors,
    qualificationsBySubject,
    sectionCounts,
    programId,
    programName
}) => {

    const requirements =
        buildSimulationRequirements({

            curriculum,

            sectionsByYearLevel:
                sectionCounts,

            qualificationsBySubject,

            programId,

            programName

        });

    const activeRequirements =
        requirements.filter(
            requirement =>
                requirement.requiredHours > 0
        );

    if (
        activeRequirements.length === 0
    ) {

        return {

            feasible:
                true,

            requiredHours:
                0,

            allocatedHours:
                0,

            shortageHours:
                0,

            allocation:
                null,

            requirements

        };
    }

    const allocation =
        allocateProfessorHoursMaxFlow({

            requirements,

            professors

        });

    return {

        feasible:
            allocation.feasible,

        requiredHours:
            allocation.requiredHours,

        allocatedHours:
            allocation.allocatedHours,

        shortageHours:
            allocation.shortageHours,

        allocation,

        requirements

    };
};


/*
|--------------------------------------------------------------------------
| GET ACTIVE YEAR LEVELS
|--------------------------------------------------------------------------
*/

const getActiveYearLevels = curriculum => {

    const map =
        new Map();

    for (
        const subject
        of curriculum
    ) {

        const yearKey =
            normalizeYearLevel(
                subject.yearLevel
            );

        const weekly =
            getSubjectWeeklyHours(
                subject
            );

        if (
            !yearKey ||
            weekly.totalHours <= 0
        ) {

            continue;
        }

        if (
            !map.has(
                yearKey
            )
        ) {

            map.set(
                yearKey,
                {

                    normalizedYearLevel:
                        yearKey,

                    yearLevel:
                        subject.yearLevel,

                    subjectCount:
                        0,

                    weeklyHours:
                        0,

                    minimumQualifiedProfessorCount:
                        Number.MAX_SAFE_INTEGER

                }
            );
        }

        const entry =
            map.get(
                yearKey
            );

        entry.subjectCount++;

        entry.weeklyHours +=
            weekly.totalHours;
    }

    return [
        ...map.values()
    ].sort(
        (
            a,
            b
        ) =>
            a.normalizedYearLevel
                .localeCompare(
                    b.normalizedYearLevel
                )
    );
};


/*
|--------------------------------------------------------------------------
| SIMULATE MAXIMUM SECTIONS
|--------------------------------------------------------------------------
|
| THIS IS THE NEW PART.
|
| No sections table.
| No student_sections.
|
| Starts at ZERO sections.
|
| It repeatedly tries to add one section to each active year level.
|
| A candidate section is accepted only when the ENTIRE resulting
| curriculum demand can still be allocated through qualified
| professors.
|
|--------------------------------------------------------------------------
*/

const calculateMaximumSchedulableSections = ({
    curriculum,
    professors,
    qualificationsBySubject,
    programId,
    programName
}) => {

    const activeYears =
        getActiveYearLevels(
            curriculum
        );

    if (
        activeYears.length === 0
    ) {

        return {

            maxSchedulableSections:
                0,

            maxBalancedSections:
                0,

            estimatedStudentCapacity:
                0,

            studentsPerSection:
                DEFAULT_STUDENTS_PER_SECTION,

            sectionsByYearLevel:
                {},

            studentsByYearLevel:
                {},

            balancedSectionsByYearLevel:
                {},

            totalWeeklyTeachingHours:
                0,

            simulationFeasible:
                false,

            simulationStatus:
                "NO_ACTIVE_YEAR_LEVELS"

        };
    }


    /*
    |--------------------------------------------------------------------------
    | CHECK WHETHER ANY SECTION IS POSSIBLE
    |--------------------------------------------------------------------------
    */

    const sectionCounts =
        new Map();

    for (
        const year
        of activeYears
    ) {

        sectionCounts.set(
            year.normalizedYearLevel,
            0
        );
    }


    /*
    |--------------------------------------------------------------------------
    | GREEDY MAXIMUM SECTION SIMULATION
    |--------------------------------------------------------------------------
    |
    | The next section is tested for every year.
    |
    | We choose the candidate with the lowest remaining slack first.
    |
    | This prevents the simulator from blindly filling the easiest
    | year while starving highly qualified-subject-dependent years.
    |
    |--------------------------------------------------------------------------
    */

    let totalSections = 0;

    let simulationStoppedBecauseOfCapacity =
        false;

    while (
        totalSections <
        MAX_SIMULATION_SECTIONS
    ) {

        const candidates = [];

        for (
            const year
            of activeYears
        ) {

            const yearKey =
                year.normalizedYearLevel;

            const current =
                sectionCounts.get(
                    yearKey
                ) || 0;

            const candidateCounts =
                new Map(
                    sectionCounts
                );

            candidateCounts.set(
                yearKey,
                current + 1
            );

            const test =
                testSimulatedSectionCounts({

                    curriculum,

                    professors,

                    qualificationsBySubject,

                    sectionCounts:
                        candidateCounts,

                    programId,

                    programName

                });

            if (
                !test.feasible
            ) {

                continue;
            }

            const candidateAllocation =
                test.allocation;

            const remainingCapacity =
                candidateAllocation

                    ? Math.max(
                        0,
                        candidateAllocation
                            .allocatedHours
                        -
                        candidateAllocation
                            .requiredHours
                    )

                    : Number.MAX_SAFE_INTEGER;

            candidates.push({

                yearKey,

                test,

                remainingCapacity

            });
        }


        /*
        |--------------------------------------------------------------------------
        | NO MORE FEASIBLE SECTION
        |--------------------------------------------------------------------------
        */

        if (
            candidates.length === 0
        ) {

            simulationStoppedBecauseOfCapacity =
                true;

            break;
        }


        /*
        |--------------------------------------------------------------------------
        | CHOOSE BEST CANDIDATE
        |--------------------------------------------------------------------------
        |
        | Priority:
        |
        | 1. Smallest remaining capacity
        | 2. Lower current section count
        | 3. Lower year level
        |
        |--------------------------------------------------------------------------
        */

        candidates.sort(
            (
                a,
                b
            ) => {

                if (
                    a.remainingCapacity !==
                    b.remainingCapacity
                ) {

                    return (
                        a.remainingCapacity -
                        b.remainingCapacity
                    );
                }

                const aCount =
                    sectionCounts.get(
                        a.yearKey
                    ) || 0;

                const bCount =
                    sectionCounts.get(
                        b.yearKey
                    ) || 0;

                if (
                    aCount !==
                    bCount
                ) {

                    return (
                        aCount -
                        bCount
                    );
                }

                return a.yearKey
                    .localeCompare(
                        b.yearKey
                    );
            }
        );


        const selected =
            candidates[0];

        sectionCounts.set(
            selected.yearKey,
            (
                sectionCounts.get(
                    selected.yearKey
                ) || 0
            ) + 1
        );

        totalSections++;
    }


    /*
    |--------------------------------------------------------------------------
    | BALANCED SECTION SIMULATION
    |--------------------------------------------------------------------------
    |
    | This calculates how many sections EACH active year can have if all
    | active year levels receive the same number of sections.
    |
    | Example:
    |
    | 4 years
    | 10 balanced sections
    |
    | = 40 sections total
    |
    |--------------------------------------------------------------------------
    */

    let low = 0;

    let high =
        Math.max(
            0,
            Math.floor(
                totalSections /
                Math.max(
                    1,
                    activeYears.length
                )
            ) + 1
        );

    let balancedSections = 0;

    while (
        low <= high
    ) {

        const mid =
            Math.floor(
                (
                    low +
                    high
                ) / 2
            );

        const testCounts =
            new Map();

        for (
            const year
            of activeYears
        ) {

            testCounts.set(
                year.normalizedYearLevel,
                mid
            );
        }

        const test =
            testSimulatedSectionCounts({

                curriculum,

                professors,

                qualificationsBySubject,

                sectionCounts:
                    testCounts,

                programId,

                programName

            });

        if (
            test.feasible
        ) {

            balancedSections =
                mid;

            low =
                mid + 1;

        } else {

            high =
                mid - 1;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | BALANCED MAP
    |--------------------------------------------------------------------------
    */

    const balancedSectionsByYearLevel =
        {};

    for (
        const year
        of activeYears
    ) {

        balancedSectionsByYearLevel[
            year.normalizedYearLevel
        ] =
            balancedSections;
    }


    /*
    |--------------------------------------------------------------------------
    | ACTUAL MAXIMUM MAP
    |--------------------------------------------------------------------------
    */

    const sectionsByYearLevel =
        {};

    const studentsByYearLevel =
        {};

    let totalWeeklyTeachingHours = 0;

    for (
        const year
        of activeYears
    ) {

        const count =
            sectionCounts.get(
                year.normalizedYearLevel
            ) || 0;

        sectionsByYearLevel[
            year.normalizedYearLevel
        ] = count;

        studentsByYearLevel[
            year.normalizedYearLevel
        ] =
            count *
            DEFAULT_STUDENTS_PER_SECTION;

        totalWeeklyTeachingHours +=
            count *
            year.weeklyHours;
    }


    /*
    |--------------------------------------------------------------------------
    | TOTAL STUDENT CAPACITY
    |--------------------------------------------------------------------------
    */

    const estimatedStudentCapacity =
        totalSections *
        DEFAULT_STUDENTS_PER_SECTION;


    /*
    |--------------------------------------------------------------------------
    | STATUS
    |--------------------------------------------------------------------------
    */

    let simulationStatus =
        "MAXIMUM_REACHED";

    if (
        totalSections === 0
    ) {

        simulationStatus =
            "NO_SECTION_FEASIBLE";

    } else if (
        simulationStoppedBecauseOfCapacity
    ) {

        simulationStatus =
            "CAPACITY_LIMIT_REACHED";
    }


    return {

        maxSchedulableSections:
            totalSections,

        maxBalancedSections:
            balancedSections,

        estimatedStudentCapacity,

        studentsPerSection:
            DEFAULT_STUDENTS_PER_SECTION,

        sectionsByYearLevel,

        studentsByYearLevel,

        balancedSectionsByYearLevel,

        totalWeeklyTeachingHours:
            totalWeeklyTeachingHours,

        activeYearLevels:
            activeYears.map(
                year => ({

                    yearLevel:
                        year.yearLevel,

                    normalizedYearLevel:
                        year.normalizedYearLevel,

                    subjects:
                        year.subjectCount,

                    weeklyHoursPerSection:
                        year.weeklyHours

                })
            ),

        simulationFeasible:
            totalSections > 0,

        simulationStatus

    };
};


/*
|--------------------------------------------------------------------------
| CALCULATE PROGRAM CAPACITY
|--------------------------------------------------------------------------
*/

const calculateProgramCapacity = ({
    sections,
    curriculum,
    professors,
    qualificationsBySubject,
    academicSemester,
    programId,
    programName
}) => {

    const safeSections =
        sections || {

            sectionsByYearLevel:
                new Map(),

            totalSections:
                0

        };

    const safeCurriculum =
        Array.isArray(
            curriculum
        )
            ? curriculum
            : [];

    const safeProfessors =
        Array.isArray(
            professors
        )
            ? professors
            : [];


    /*
    |--------------------------------------------------------------------------
    | CURRENT EXISTING SECTION REQUIREMENTS
    |--------------------------------------------------------------------------
    |
    | KEEPING THIS EXACTLY FOR BACKWARD COMPATIBILITY.
    |
    |--------------------------------------------------------------------------
    */

    const requirements =
        buildSubjectRequirements({

            curriculum:
                safeCurriculum,

            sectionsByYearLevel:
                safeSections
                    .sectionsByYearLevel instanceof Map
                    ? safeSections
                        .sectionsByYearLevel
                    : new Map(),

            qualificationsBySubject,

            programId,

            programName

        });

    const activeRequirements =
        requirements.filter(
            requirement =>
                requirement.requiredHours > 0
        );

    const totalRequiredHours =
        calculateRequiredHours(
            requirements
        );


    /*
    |--------------------------------------------------------------------------
    | PROFESSOR CAPACITY
    |--------------------------------------------------------------------------
    */

    const totalAvailableCapacity =
        safeProfessors.reduce(
            (
                total,
                professor
            ) =>
                total +
                Math.max(
                    0,
                    num(
                        professor.maxWeeklyHours
                    )
                ),
            0
        );

    const qualifiedProfessors =
        safeProfessors.filter(
            professor =>
                activeRequirements.some(
                    requirement =>
                        requirement
                            .qualifiedProfessorIds
                            .includes(
                                professor.professorId
                            )
                )
        );

    const totalQualifiedProfessorCapacity =
        qualifiedProfessors.reduce(
            (
                total,
                professor
            ) =>
                total +
                Math.max(
                    0,
                    num(
                        professor.maxWeeklyHours
                    )
                ),
            0
        );

    const allocation =
        allocateProfessorHoursMaxFlow({

            requirements,

            professors:
                qualifiedProfessors

        });

    const subjectBottlenecks =
        calculateSubjectBottlenecks({

            requirementResults:
                allocation.requirementResults

        });

    const maxProfessorHours =
        qualifiedProfessors.length > 0

            ? Math.max(
                ...qualifiedProfessors.map(
                    professor =>
                        Math.max(
                            0,
                            num(
                                professor.maxWeeklyHours
                            )
                        )
                )
            )

            : 0;

    const hoursOnlyLowerBound =
        totalRequiredHours > 0 &&
        maxProfessorHours > 0

            ? Math.ceil(
                totalRequiredHours /
                maxProfessorHours
            )

            : 0;


    /*
    |--------------------------------------------------------------------------
    | NEW SECTION SIMULATION
    |--------------------------------------------------------------------------
    */

    const simulatedSections =
        calculateMaximumSchedulableSections({

            curriculum:
                safeCurriculum,

            professors:
                safeProfessors,

            qualificationsBySubject,

            programId,

            programName

        });


    /*
    |--------------------------------------------------------------------------
    | STATUS
    |--------------------------------------------------------------------------
    */

    let status =
        "SUFFICIENT";

    if (
        safeSections.totalSections === 0
    ) {

        status =
            "NO_SECTIONS";

    } else if (
        safeCurriculum.length === 0
    ) {

        status =
            "NO_ACTIVE_SUBJECTS";

    } else if (
        activeRequirements.length === 0
    ) {

        status =
            "NO_ACTIVE_SUBJECTS";

    } else if (
        !allocation.feasible
    ) {

        status =
            "INSUFFICIENT_QUALIFIED_CAPACITY";
    }


    const professorDetails =
        calculateProfessorDetails({

            professors:
                qualifiedProfessors,

            requirements,

            allocationsByProfessor:
                allocation.allocatedByProfessor

        });


    const yearLevelDemand =
        calculateYearLevelDemand({

            curriculum:
                safeCurriculum,

            sectionsByYearLevel:
                safeSections
                    .sectionsByYearLevel instanceof Map
                    ? safeSections
                        .sectionsByYearLevel
                    : new Map()

        });


    return {

        /*
        |--------------------------------------------------------------------------
        | EXISTING RETURN - PRESERVED
        |--------------------------------------------------------------------------
        */

        status,

        semester:
            academicSemester || null,

        sufficient:
            status === "SUFFICIENT" ||
            status === "NO_SECTIONS" ||
            status === "NO_ACTIVE_SUBJECTS",

        sectionCount:
            safeSections.totalSections,

        subjectsAnalyzed:
            safeCurriculum.length,

        activeSubjects:
            activeRequirements.length,

        requiredTeachingHours:
            totalRequiredHours,

        availableProfessorCapacity:
            totalAvailableCapacity,

        totalQualifiedProfessorCapacity,

        allocatableQualifiedCapacity:
            allocation.allocatedHours,

        allocationShortageHours:
            allocation.shortageHours,

        professorsAvailable:
            safeProfessors.length,

        qualifiedProfessorsAvailable:
            qualifiedProfessors.length,

        hoursOnlyLowerBound,

        minimumProfessorsNeeded:
            hoursOnlyLowerBound,

        professorsUsedByCapacityAllocation:
            allocation.professorsUsed,

        professorShortage:
            Math.max(
                0,
                hoursOnlyLowerBound -
                qualifiedProfessors.length
            ),

        subjectBottlenecks,

        allocationFeasible:
            allocation.feasible,

        allocationFailure:
            allocation.feasible

                ? null

                : {

                    shortageHours:
                        allocation.shortageHours,

                    requiredHours:
                        allocation.requiredHours,

                    allocatedHours:
                        allocation.allocatedHours

                },

        yearLevelDemand,

        professors:
            professorDetails,

        requirements:
            allocation.requirementResults,

        rawRequirements:
            requirements,

        allocations:
            allocation.allocations,

        sectionsByYearLevel:
            Object.fromEntries(
                safeSections
                    .sectionsByYearLevel instanceof Map
                    ? safeSections
                        .sectionsByYearLevel
                    : new Map()
            ),


        /*
        |--------------------------------------------------------------------------
        | NEW RETURN
        |--------------------------------------------------------------------------
        */

        simulatedSections

    };
};


/*
|--------------------------------------------------------------------------
| CHECK SINGLE PROGRAM
|--------------------------------------------------------------------------
*/

const checkProgram = async ({
    program,
    academicTermId,
    academicTerm,
    preloadedCurriculum = null,
    preloadedProfessorData = null
}) => {

    console.log(
        "\n----------------------------------------"
    );

    console.log(
        "PROGRAM CAPACITY CHECK"
    );

    console.log(
        `Program ID: ${program.id}`
    );

    console.log(
        `Program: ${program.name}`
    );

    console.log(
        `Academic Term: ${academicTermId}`
    );

    console.log(
        `Semester: ${
            normalizeSemester(
                academicTerm?.semester
            ) || "UNKNOWN"
        }`
    );

    console.log(
        "----------------------------------------"
    );

    try {

        const sections =
            await getProgramSections(
                program.id,
                academicTermId
            );


        /*
        |--------------------------------------------------------------------------
        | CURRICULUM
        |--------------------------------------------------------------------------
        */

        const curriculum =
            Array.isArray(
                preloadedCurriculum
            )
                ? preloadedCurriculum
                : await getProgramCurriculum(
                    program.id,
                    academicTerm
                );


        /*
        |--------------------------------------------------------------------------
        | PROFESSOR DATA
        |--------------------------------------------------------------------------
        */

        const qualificationData =
            preloadedProfessorData ||
            await getProfessorQualifications(
                curriculum
            );

        const professors =
            qualificationData.professors || [];


        /*
        |--------------------------------------------------------------------------
        | IMPORTANT
        |--------------------------------------------------------------------------
        |
        | Even when existing section count is ZERO, we still run the
        | simulation.
        |
        |--------------------------------------------------------------------------
        */

        if (
            sections.totalSections === 0
        ) {

            const simulatedSections =
                calculateMaximumSchedulableSections({

                    curriculum,

                    professors,

                    qualificationsBySubject:
                        qualificationData
                            .qualificationsBySubject,

                    programId:
                        program.id,

                    programName:
                        program.name

                });


            console.log(
                `[CAPACITY] ${program.name} | ` +
                `Existing sections: 0 | ` +
                `Simulated maximum: ` +
                `${simulatedSections.maxSchedulableSections}`
            );


            return {

                programId:
                    program.id,

                programName:
                    program.name,

                passed:
                    true,

                skipped:
                    true,

                reason:
                    "No existing sections found. Professor capacity simulation was still performed.",

                failureType:
                    null,

                sectionCount:
                    0,

                professorCapacity: {

                    status:
                        "NO_SECTIONS",

                    semester:
                        normalizeSemester(
                            academicTerm?.semester
                        ),

                    sufficient:
                        true,

                    sectionCount:
                        0,

                    subjectsAnalyzed:
                        curriculum.length,

                    activeSubjects:
                        curriculum.filter(
                            subject =>
                                getSubjectWeeklyHours(
                                    subject
                                ).totalHours > 0
                        ).length,

                    requiredTeachingHours:
                        0,

                    availableProfessorCapacity:
                        professors.reduce(
                            (
                                total,
                                professor
                            ) =>
                                total +
                                Math.max(
                                    0,
                                    num(
                                        professor.maxWeeklyHours
                                    )
                                ),
                            0
                        ),

                    totalQualifiedProfessorCapacity:
                        0,

                    allocatableQualifiedCapacity:
                        0,

                    allocationShortageHours:
                        0,

                    professorsAvailable:
                        professors.length,

                    qualifiedProfessorsAvailable:
                        qualificationData
                            .qualifiedProfessorCount,

                    hoursOnlyLowerBound:
                        0,

                    minimumProfessorsNeeded:
                        0,

                    professorsUsedByCapacityAllocation:
                        0,

                    professorShortage:
                        0,

                    subjectBottlenecks:
                        [],

                    allocationFeasible:
                        true,

                    allocationFailure:
                        null,

                    yearLevelDemand:
                        [],

                    professors:
                        [],

                    requirements:
                        [],

                    rawRequirements:
                        [],

                    allocations:
                        [],

                    sectionsByYearLevel:
                        {},

                    simulatedSections

                }

            };
        }


        /*
        |--------------------------------------------------------------------------
        | NORMAL CAPACITY CHECK
        |--------------------------------------------------------------------------
        */

        const professorCapacity =
            calculateProgramCapacity({

                sections,

                curriculum,

                professors,

                qualificationsBySubject:
                    qualificationData
                        .qualificationsBySubject,

                academicSemester:
                    normalizeSemester(
                        academicTerm?.semester
                    ),

                programId:
                    program.id,

                programName:
                    program.name

            });


        console.log(
            `\n[CAPACITY RESULT] ${program.name}`
        );

        console.log(
            `Existing Sections: ${professorCapacity.sectionCount}`
        );

        console.log(
            `Simulated Maximum Sections: ` +
            `${professorCapacity.simulatedSections.maxSchedulableSections}`
        );

        console.log(
            `Simulated Student Capacity: ` +
            `${professorCapacity.simulatedSections.estimatedStudentCapacity}`
        );

        console.log(
            `Balanced Sections/Year: ` +
            `${professorCapacity.simulatedSections.maxBalancedSections}`
        );

        console.log(
            `Required teaching hours: ${professorCapacity.requiredTeachingHours}`
        );

        console.log(
            `Available professor capacity: ${professorCapacity.availableProfessorCapacity}`
        );

        console.log(
            `Qualified professor capacity: ${professorCapacity.totalQualifiedProfessorCapacity}`
        );

        console.log(
            `Actually allocatable capacity: ${professorCapacity.allocatableQualifiedCapacity}`
        );

        console.log(
            `Allocation shortage hours: ${professorCapacity.allocationShortageHours}`
        );

        console.log(
            `Active professors available: ${professorCapacity.professorsAvailable}`
        );

        console.log(
            `Qualified professors available: ${professorCapacity.qualifiedProfessorsAvailable}`
        );

        console.log(
            `Professors used: ${professorCapacity.professorsUsedByCapacityAllocation}`
        );

        console.log(
            `Professor shortage: ${professorCapacity.professorShortage}`
        );

        console.log(
            `Subject bottlenecks: ${professorCapacity.subjectBottlenecks.length}`
        );

        console.log(
            `Allocation feasible: ${professorCapacity.allocationFeasible}`
        );

        console.log(
            `Status: ${professorCapacity.status}`
        );


        if (
            professorCapacity.yearLevelDemand.length > 0
        ) {

            console.log(
                "[YEAR LEVEL DEMAND]"
            );

            for (
                const year
                of professorCapacity.yearLevelDemand
            ) {

                console.log(
                    `  ${year.yearLevel} ` +
                    `(${year.normalizedYearLevel}) | ` +
                    `Sections: ${year.sectionCount} | ` +
                    `Subjects: ${year.subjectCount} | ` +
                    `Active: ${year.activeSubjectCount} | ` +
                    `Hours: ${year.requiredHours}`
                );
            }
        }


        /*
        |--------------------------------------------------------------------------
        | NEW SIMULATION LOG
        |--------------------------------------------------------------------------
        */

        console.log(
            "\n[SECTION SIMULATION]"
        );

        console.log(
            `Maximum schedulable sections: ` +
            `${professorCapacity.simulatedSections.maxSchedulableSections}`
        );

        console.log(
            `Maximum balanced sections/year: ` +
            `${professorCapacity.simulatedSections.maxBalancedSections}`
        );

        console.log(
            `Students per section: ` +
            `${professorCapacity.simulatedSections.studentsPerSection}`
        );

        console.log(
            `Estimated student capacity: ` +
            `${professorCapacity.simulatedSections.estimatedStudentCapacity}`
        );

        console.log(
            `Simulation status: ` +
            `${professorCapacity.simulatedSections.simulationStatus}`
        );


        const passed =
            professorCapacity.sufficient;


        return {

            programId:
                program.id,

            programName:
                program.name,

            passed,

            skipped:
                false,

            reason:
                passed

                    ? professorCapacity.status ===
                      "NO_ACTIVE_SUBJECTS"

                        ? `No curriculum subjects found for ${professorCapacity.semester}.`

                        : "Professor capacity is sufficient based on active-professor qualification-aware global allocation."

                    : `Professor capacity check failed: ${professorCapacity.status}.`,

            failureType:
                passed
                    ? null
                    : "PROFESSOR_CAPACITY_FAILURE",

            sectionCount:
                professorCapacity.sectionCount,

            professorCapacity

        };

    } catch (
        error
    ) {

        console.error(
            `[PROGRAM ERROR] ${program.name}:`,
            error
        );

        return {

            programId:
                program.id,

            programName:
                program.name,

            passed:
                false,

            skipped:
                false,

            reason:
                error?.message ||
                String(error),

            failureType:
                "PROGRAM_CHECK_ERROR",

            sectionCount:
                0,

            professorCapacity:
                null

        };
    }
};


/*
|--------------------------------------------------------------------------
| BUILD UNIVERSITY REQUIREMENTS
|--------------------------------------------------------------------------
*/

const buildUniversityRequirements = ({
    programData,
    qualificationsBySubject
}) => {

    const requirements = [];

    for (
        const data
        of programData
    ) {

        const requirementsForProgram =
            buildSubjectRequirements({

                curriculum:
                    data.curriculum,

                sectionsByYearLevel:
                    data.sections
                        .sectionsByYearLevel,

                qualificationsBySubject,

                programId:
                    data.programId,

                programName:
                    data.programName

            });

        requirements.push(
            ...requirementsForProgram
        );
    }

    return requirements;
};


/*
|--------------------------------------------------------------------------
| UNIVERSITY SECTION SIMULATION
|--------------------------------------------------------------------------
|
| This is intentionally separate from the existing global professor
| capacity result.
|
| It calculates the sum of each program's independent simulation.
|
| This means:
|
|   BSCS maximum = X
|   BSIT maximum = Y
|
| are independent program capacities.
|
| For actual simultaneous university scheduling, use globalAllocation.
|
|--------------------------------------------------------------------------
*/

const buildProgramSimulationSummary = results => {

    return results.map(
        result => {

            const simulation =
                result
                    ?.professorCapacity
                    ?.simulatedSections;

            return {

                programId:
                    result.programId,

                programName:
                    result.programName,

                existingSections:
                    num(
                        result.sectionCount
                    ),

                maxSchedulableSections:
                    num(
                        simulation
                            ?.maxSchedulableSections
                    ),

                maxBalancedSections:
                    num(
                        simulation
                            ?.maxBalancedSections
                    ),

                studentsPerSection:
                    num(
                        simulation
                            ?.studentsPerSection
                    ) ||
                    DEFAULT_STUDENTS_PER_SECTION,

                estimatedStudentCapacity:
                    num(
                        simulation
                            ?.estimatedStudentCapacity
                    ),

                sectionsByYearLevel:
                    simulation
                        ?.sectionsByYearLevel || {},

                studentsByYearLevel:
                    simulation
                        ?.studentsByYearLevel || {},

                balancedSectionsByYearLevel:
                    simulation
                        ?.balancedSectionsByYearLevel || {},

                simulationStatus:
                    simulation
                        ?.simulationStatus ||
                    "NOT_AVAILABLE"

            };
        }
    );
};


/*
|--------------------------------------------------------------------------
| CHECK UNIVERSITY CAPACITY
|--------------------------------------------------------------------------
*/

const checkUniversityCapacity = async academicTermId => {

    const termId =
        positiveInt(
            academicTermId
        );

    if (
        termId <= 0
    ) {

        throw new Error(
            "A valid academicTermId is required."
        );
    }


    const academicTerm =
        await getAcademicTerm(
            termId
        );

    const normalizedSemester =
        normalizeSemester(
            academicTerm.semester
        );

    if (
        !normalizedSemester
    ) {

        throw new Error(
            `Academic term ${termId} has an invalid or empty semester.`
        );
    }


    const programs =
        await getPrograms();


    console.log(
        "\n========================================"
    );

    console.log(
        "UNIVERSITY PROFESSOR CAPACITY CHECK"
    );

    console.log(
        "========================================"
    );

    console.log(
        `Academic Term: ${termId}`
    );

    console.log(
        `Academic Term Semester: ${normalizedSemester}`
    );

    console.log(
        `Programs: ${programs.length}`
    );

    console.log(
        "Professor population: ACTIVE users with role PROFESSOR"
    );

    console.log(
        "Scheduler: NOT USED"
    );

    console.log(
        "Existing sections are NOT used for simulation."
    );

    console.log(
        `Simulation students/section: ${DEFAULT_STUDENTS_PER_SECTION}`
    );


    /*
    |--------------------------------------------------------------------------
    | LOAD PROGRAM DATA
    |--------------------------------------------------------------------------
    */

    const programData = [];

    for (
        const program
        of programs
    ) {

        const sections =
            await getProgramSections(
                program.id,
                termId
            );

        const curriculum =
            await getProgramCurriculum(
                program.id,
                academicTerm
            );

        programData.push({

            programId:
                program.id,

            programName:
                program.name,

            sections,

            curriculum

        });
    }


    /*
    |--------------------------------------------------------------------------
    | ALL SUBJECTS
    |--------------------------------------------------------------------------
    */

    const allSubjects = [];

    for (
        const data
        of programData
    ) {

        allSubjects.push(
            ...data.curriculum
        );
    }


    /*
    |--------------------------------------------------------------------------
    | GLOBAL PROFESSOR DATA
    |--------------------------------------------------------------------------
    */

    const globalQualificationData =
        await getProfessorQualifications(
            allSubjects
        );

    const globalProfessors =
        globalQualificationData.professors || [];


    const globalQualifiedForAnything =
        globalProfessors.filter(
            professor =>
                professor
                    .qualifiedSubjectIds
                    .size > 0
        );


    console.log(
        "\n[GLOBAL PROFESSOR POOL]"
    );

    console.log(
        `Active professors: ${globalProfessors.length}`
    );

    console.log(
        `Qualified active professors: ${globalQualifiedForAnything.length}`
    );


    /*
    |--------------------------------------------------------------------------
    | PROGRAM RESULTS
    |--------------------------------------------------------------------------
    */

    const results = [];

    for (
        let index = 0;
        index < programs.length;
        index++
    ) {

        const program =
            programs[index];

        console.log(
            `\n[PROGRAM ${index + 1}/${programs.length}] ` +
            `${program.name}`
        );

        const data =
            programData.find(
                item =>
                    item.programId ===
                    program.id
            );

        const result =
            await checkProgram({

                program,

                academicTermId:
                    termId,

                academicTerm,

                preloadedCurriculum:
                    data?.curriculum || [],

                preloadedProfessorData:
                    globalQualificationData

            });

        results.push(
            result
        );
    }


    /*
    |--------------------------------------------------------------------------
    | UNIVERSITY REQUIREMENTS
    |--------------------------------------------------------------------------
    */

    const universityRequirements =
        buildUniversityRequirements({

            programData,

            qualificationsBySubject:
                globalQualificationData
                    .qualificationsBySubject

        });

    const activeUniversityRequirements =
        universityRequirements.filter(
            requirement =>
                requirement.requiredHours > 0
        );

    const totalUniversityRequiredHours =
        calculateRequiredHours(
            universityRequirements
        );


    /*
    |--------------------------------------------------------------------------
    | GLOBAL MAX FLOW
    |--------------------------------------------------------------------------
    */

    const globalAllocation =
        allocateProfessorHoursMaxFlow({

            requirements:
                universityRequirements,

            professors:
                globalProfessors

        });


    const globalBottlenecks =
        calculateSubjectBottlenecks({

            requirementResults:
                globalAllocation
                    .requirementResults

        });


    /*
    |--------------------------------------------------------------------------
    | GLOBAL PROFESSOR CAPACITY
    |--------------------------------------------------------------------------
    */

    const totalGlobalProfessorCapacity =
        globalProfessors.reduce(
            (
                total,
                professor
            ) =>
                total +
                Math.max(
                    0,
                    num(
                        professor.maxWeeklyHours
                    )
                ),
            0
        );


    const globalActiveRequirements =
        activeUniversityRequirements;


    const globalQualifiedProfessors =
        globalProfessors.filter(
            professor =>
                globalActiveRequirements.some(
                    requirement =>
                        requirement
                            .qualifiedProfessorIds
                            .includes(
                                professor.professorId
                            )
                )
        );


    const globalQualifiedProfessorCapacity =
        globalQualifiedProfessors.reduce(
            (
                total,
                professor
            ) =>
                total +
                Math.max(
                    0,
                    num(
                        professor.maxWeeklyHours
                    )
                ),
            0
        );


    const maxGlobalProfessorHours =
        globalQualifiedProfessors.length > 0

            ? Math.max(
                ...globalQualifiedProfessors.map(
                    professor =>
                        Math.max(
                            0,
                            num(
                                professor.maxWeeklyHours
                            )
                        )
                )
            )

            : 0;


    const globalHoursOnlyLowerBound =
        totalUniversityRequiredHours > 0 &&
        maxGlobalProfessorHours > 0

            ? Math.ceil(
                totalUniversityRequiredHours /
                maxGlobalProfessorHours
            )

            : 0;


    /*
    |--------------------------------------------------------------------------
    | RESULT GROUPS
    |--------------------------------------------------------------------------
    */

    const skipped =
        results.filter(
            result =>
                result.skipped === true
        );

    const failedProgramChecks =
        results.filter(
            result =>
                result.passed === false &&
                result.skipped === false
        );

    const passed =
        results.filter(
            result =>
                result.passed === true &&
                result.skipped === false
        );


    const globalCapacityPassed =
        globalAllocation.feasible;

    const universityPassed =
        failedProgramChecks.length === 0 &&
        globalCapacityPassed;


    /*
    |--------------------------------------------------------------------------
    | PROGRAM SUMMARY
    |--------------------------------------------------------------------------
    */

    const totalRequiredProfessorHours =
        results.reduce(
            (
                total,
                result
            ) =>
                total +
                num(
                    result
                        ?.professorCapacity
                        ?.requiredTeachingHours
                ),
            0
        );


    const totalProgramProfessorRequirement =
        results.reduce(
            (
                total,
                result
            ) =>
                total +
                num(
                    result
                        ?.professorCapacity
                        ?.hoursOnlyLowerBound
                ),
            0
        );


    const totalProgramProfessorShortage =
        results.reduce(
            (
                total,
                result
            ) =>
                total +
                num(
                    result
                        ?.professorCapacity
                        ?.professorShortage
                ),
            0
        );


    /*
    |--------------------------------------------------------------------------
    | EXISTING PROGRAM PROFESSOR CAPACITY
    |--------------------------------------------------------------------------
    */

    const programProfessorCapacity =
        results.map(
            result => {

                const capacity =
                    result?.professorCapacity || {};

                const totalProfessors =
                    num(
                        capacity.professorsAvailable
                    );

                const qualifiedProfessors =
                    num(
                        capacity.qualifiedProfessorsAvailable
                    );

                const professorsUsed =
                    num(
                        capacity.professorsUsedByCapacityAllocation
                    );

                const professorsNeeded =
                    num(
                        capacity.hoursOnlyLowerBound
                    );

                const professorShortage =
                    Math.max(
                        0,
                        num(
                            capacity.professorShortage
                        )
                    );

                const allocationFeasible =
                    capacity.allocationFeasible === true;

                return {

                    programId:
                        result.programId,

                    programName:
                        result.programName,

                    sectionCount:
                        num(
                            result.sectionCount
                        ),

                    totalProfessors,

                    qualifiedProfessors,

                    professorsUsed,

                    professorsNeeded,

                    professorShortage,

                    requiredTeachingHours:
                        num(
                            capacity.requiredTeachingHours
                        ),

                    allocatableQualifiedCapacity:
                        num(
                            capacity.allocatableQualifiedCapacity
                        ),

                    allocationShortageHours:
                        num(
                            capacity.allocationShortageHours
                        ),

                    allocationFeasible,

                    status:
                        allocationFeasible
                            ? "SUFFICIENT"
                            : "INSUFFICIENT",

                    subjectBottlenecks:
                        capacity.subjectBottlenecks || [],

                    subjectBottleneckCount:
                        Array.isArray(
                            capacity.subjectBottlenecks
                        )
                            ? capacity
                                .subjectBottlenecks
                                .length
                            : 0

                };

            }
        );


    /*
    |--------------------------------------------------------------------------
    | NEW PROGRAM SECTION SIMULATION SUMMARY
    |--------------------------------------------------------------------------
    */

    const programSectionSimulation =
        buildProgramSimulationSummary(
            results
        );


    /*
    |--------------------------------------------------------------------------
    | NEW TOTAL SIMULATED SECTION SUMMARY
    |--------------------------------------------------------------------------
    |
    | NOTE:
    |
    | This is the sum of INDEPENDENT program simulations.
    |
    | It should NOT be interpreted as the number of sections that all
    | programs can simultaneously schedule using the exact same professor
    | pool.
    |
    |--------------------------------------------------------------------------
    */

    const totalSimulatedSections =
        programSectionSimulation.reduce(
            (
                total,
                item
            ) =>
                total +
                num(
                    item.maxSchedulableSections
                ),
            0
        );


    const totalSimulatedStudentCapacity =
        programSectionSimulation.reduce(
            (
                total,
                item
            ) =>
                total +
                num(
                    item.estimatedStudentCapacity
                ),
            0
        );


    /*
    |--------------------------------------------------------------------------
    | LOG
    |--------------------------------------------------------------------------
    */

    console.log(
        "\n========================================"
    );

    console.log(
        "GLOBAL UNIVERSITY CAPACITY RESULT"
    );

    console.log(
        "========================================"
    );

    console.log(
        `Academic Term: ${termId}`
    );

    console.log(
        `Semester: ${normalizedSemester}`
    );

    console.log(
        `ACTIVE PROFESSORS: ${globalProfessors.length}`
    );

    console.log(
        `Globally qualified professors: ${globalQualifiedProfessors.length}`
    );

    console.log(
        `Total required teaching hours: ${totalUniversityRequiredHours}`
    );

    console.log(
        `Total active professor capacity: ${totalGlobalProfessorCapacity}`
    );

    console.log(
        `Globally qualified professor capacity: ${globalQualifiedProfessorCapacity}`
    );

    console.log(
        `Actually allocatable capacity: ${globalAllocation.allocatedHours}`
    );

    console.log(
        `Global shortage hours: ${globalAllocation.shortageHours}`
    );

    console.log(
        `Hours-only lower bound: ${globalHoursOnlyLowerBound}`
    );

    console.log(
        `Professors used: ${globalAllocation.professorsUsed}`
    );

    console.log(
        `Global allocation feasible: ${globalAllocation.feasible}`
    );

    console.log(
        `Global bottlenecks: ${globalBottlenecks.length}`
    );


    /*
    |--------------------------------------------------------------------------
    | SECTION SIMULATION LOG
    |--------------------------------------------------------------------------
    */

    console.log(
        "\n========================================"
    );

    console.log(
        "SIMULATED SECTION CAPACITY"
    );

    console.log(
        "========================================"
    );

    console.log(
        `Students per section: ${DEFAULT_STUDENTS_PER_SECTION}`
    );

    console.log(
        `Total independent simulated sections: ${totalSimulatedSections}`
    );

    console.log(
        `Total independent simulated student capacity: ${totalSimulatedStudentCapacity}`
    );


    for (
        const item
        of programSectionSimulation
    ) {

        console.log(
            `${item.programName} | ` +
            `Existing: ${item.existingSections} | ` +
            `Can Create: ${item.maxSchedulableSections} sections | ` +
            `Students: ${item.estimatedStudentCapacity}`
        );

        console.log(
            `  By year:`,
            item.sectionsByYearLevel
        );
    }


    /*
    |--------------------------------------------------------------------------
    | PROGRAM PROFESSOR LOG
    |--------------------------------------------------------------------------
    */

    console.log(
        "\n========================================"
    );

    console.log(
        "PROGRAM PROFESSOR CAPACITY SUMMARY"
    );

    console.log(
        "========================================"
    );

    for (
        const programCapacity
        of programProfessorCapacity
    ) {

        console.log(
            `${programCapacity.programName} | ` +
            `Total: ${programCapacity.totalProfessors} | ` +
            `Qualified: ${programCapacity.qualifiedProfessors} | ` +
            `Needed: ${programCapacity.professorsNeeded} | ` +
            `Used: ${programCapacity.professorsUsed} | ` +
            `Shortage: ${programCapacity.professorShortage} | ` +
            `Status: ${programCapacity.status}`
        );
    }


    /*
    |--------------------------------------------------------------------------
    | FAILED LOG
    |--------------------------------------------------------------------------
    */

    if (
        failedProgramChecks.length > 0
    ) {

        console.log(
            "\nFAILED PROGRAM CHECKS"
        );

        for (
            const result
            of failedProgramChecks
        ) {

            console.log(
                `- ${result.programName} ` +
                `(${result.programId})`
            );

            console.log(
                `  Reason: ${result.reason}`
            );

            if (
                result.professorCapacity
            ) {

                console.log(
                    `  Required hours: ` +
                    `${result.professorCapacity.requiredTeachingHours}`
                );

                console.log(
                    `  Allocatable hours: ` +
                    `${result.professorCapacity.allocatableQualifiedCapacity}`
                );

                console.log(
                    `  Shortage hours: ` +
                    `${result.professorCapacity.allocationShortageHours}`
                );
            }
        }
    }


    /*
    |--------------------------------------------------------------------------
    | RETURN
    |--------------------------------------------------------------------------
    |
    | EXISTING RETURN STRUCTURE IS PRESERVED.
    |
    | NEW FIELDS ARE ADDED:
    |
    |   programSectionSimulation
    |   simulatedSectionSummary
    |
    |--------------------------------------------------------------------------
    */

    return {

        passed:
            universityPassed,

        academicTermId:
            termId,

        semester:
            normalizedSemester,

        totalPrograms:
            programs.length,

        checkedPrograms:
            passed.length,

        skippedPrograms:
            skipped.length,

        passedPrograms:
            passed.length,

        failedPrograms:
            failedProgramChecks.length,


        professorSummary: {

            semester:
                normalizedSemester,

            totalRequiredProfessorHours,

            totalProgramProfessorRequirement,

            totalProgramProfessorShortage,

            note:
                "Program-scoped professor capacities may contain the same active professor multiple times. Use programProfessorCapacity for program-level modal data and globalProfessorSummary for university-wide capacity."

        },


        programProfessorCapacity,


        /*
        |--------------------------------------------------------------------------
        | NEW
        |--------------------------------------------------------------------------
        */

        programSectionSimulation,


        /*
        |--------------------------------------------------------------------------
        | NEW
        |--------------------------------------------------------------------------
        */

        simulatedSectionSummary: {

            studentsPerSection:
                DEFAULT_STUDENTS_PER_SECTION,

            totalSimulatedSections,

            totalSimulatedStudentCapacity,

            note:
                "Simulated sections are calculated independently per program using curriculum, active professor capacity, and professor qualifications. Existing sections and student_sections are not used to determine this value."

        },


        globalProfessorSummary: {

            semester:
                normalizedSemester,

            uniqueProfessors:
                globalProfessors.length,

            globallyQualifiedProfessors:
                globalQualifiedProfessors.length,

            totalRequiredTeachingHours:
                totalUniversityRequiredHours,

            totalProfessorCapacity:
                totalGlobalProfessorCapacity,

            totalQualifiedProfessorCapacity:
                globalQualifiedProfessorCapacity,

            allocatableQualifiedCapacity:
                globalAllocation.allocatedHours,

            shortageHours:
                globalAllocation.shortageHours,

            hoursOnlyLowerBound:
                globalHoursOnlyLowerBound,

            professorsUsedByCapacityAllocation:
                globalAllocation.professorsUsed,

            allocationFeasible:
                globalAllocation.feasible,

            subjectBottlenecks:
                globalBottlenecks.length,

            note:
                "uniqueProfessors contains only active users with role professor. Professors are counted once globally. Professor qualifications are taken from professor_subjects."

        },


        globalAllocation: {

            requiredHours:
                globalAllocation.requiredHours,

            allocatedHours:
                globalAllocation.allocatedHours,

            shortageHours:
                globalAllocation.shortageHours,

            feasible:
                globalAllocation.feasible,

            professorsUsed:
                globalAllocation.professorsUsed,

            allocations:
                globalAllocation.allocations,

            requirementResults:
                globalAllocation.requirementResults

        },


        globalSubjectBottlenecks:
            globalBottlenecks,


        results,


        failed:
            failedProgramChecks.map(
                result => ({

                    programId:
                        result.programId,

                    programName:
                        result.programName,

                    reason:
                        result.reason,

                    failureType:
                        result.failureType,

                    sectionCount:
                        result.sectionCount,

                    professorCapacity:
                        result.professorCapacity

                })
            ),


        skipped:
            skipped.map(
                result => ({

                    programId:
                        result.programId,

                    programName:
                        result.programName,

                    reason:
                        result.reason,

                    sectionCount:
                        result.sectionCount,

                    professorCapacity:
                        result.professorCapacity

                })
            ),


        passed:
            passed.map(
                result => ({

                    programId:
                        result.programId,

                    programName:
                        result.programName,

                    sectionCount:
                        result.sectionCount,

                    professorCapacity:
                        result.professorCapacity

                })
            ),


        message:
            universityPassed

                ? skipped.length > 0

                    ? `University professor capacity is sufficient for ${normalizedSemester}. ` +
                      `${skipped.length} program(s) had no existing sections, but section simulation was performed.`

                    : `University professor capacity is sufficient for ${normalizedSemester}.`

                : globalBottlenecks.length > 0

                    ? `University professor capacity is insufficient for ${normalizedSemester}. ` +
                      `${globalBottlenecks.length} subject-level bottleneck(s) were detected.`

                    : `University professor capacity is insufficient for ${normalizedSemester}.`

    };
};


/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {

    checkUniversityCapacity,

    checkEnrollmentCapacity:
        checkUniversityCapacity,

    checkProgram,

    getPrograms

};