import "./styles/allSubjects.css";
import { useState, useEffect, useMemo } from "react";

const AllSubjects = () => {
    const [subjects, setSubjects] = useState([]);
    const [programList, setProgramList] = useState([]);

    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [search, setSearch] = useState("");
    const [programFilter, setProgramFilter] = useState("all");
    const [semesterFilter, setSemesterFilter] = useState("all");
    const [yearFilter, setYearFilter] = useState("all");

    /*
    |--------------------------------------------------------------------------
    | EMPTY SUBJECT
    |--------------------------------------------------------------------------
    */

    const EMPTY_SUBJECT = {
        subject_code: "",
        subject_name: "",
        description: "",
        units: 0,
        lecture_units: 0,
        lab_units: 0,
        programs: []
    };

    const [subject, setSubject] = useState(EMPTY_SUBJECT);

    /*
    |--------------------------------------------------------------------------
    | INITIAL LOAD
    |--------------------------------------------------------------------------
    */

    useEffect(() => {
        fetchSubjects();
        getPrograms();
    }, []);

    /*
    |--------------------------------------------------------------------------
    | GENERIC LIST PARSER
    |--------------------------------------------------------------------------
    |
    | Handles:
    |
    | "1,2,3"
    | ["1", "2", "3"]
    | [1, 2, 3]
    | "BSCS, BSIT"
    | null
    |
    */

    const parseList = (value) => {
        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return [];
        }

        if (Array.isArray(value)) {
            return value
                .flatMap((item) => {
                    if (
                        item === null ||
                        item === undefined
                    ) {
                        return [];
                    }

                    return String(item)
                        .split(",")
                        .map((x) => x.trim());
                })
                .filter(Boolean);
        }

        return String(value)
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
    };

    /*
    |--------------------------------------------------------------------------
    | NORMALIZE ID
    |--------------------------------------------------------------------------
    */

    const normalizeId = (value) => {
        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return null;
        }

        const numeric = Number(value);

        if (!Number.isNaN(numeric)) {
            return String(numeric);
        }

        return String(value)
            .trim()
            .toLowerCase();
    };

    /*
    |--------------------------------------------------------------------------
    | NORMALIZE YEAR
    |--------------------------------------------------------------------------
    |
    | Supports:
    |
    | 1
    | "1"
    | "1st"
    | "1st Year"
    | "First Year"
    |
    */

    const normalizeYear = (value) => {
        const raw = String(value ?? "")
            .trim()
            .toLowerCase();

        if (!raw) {
            return "";
        }

        if (
            raw === "1" ||
            raw === "1st" ||
            raw === "1st year" ||
            raw === "first year"
        ) {
            return "1";
        }

        if (
            raw === "2" ||
            raw === "2nd" ||
            raw === "2nd year" ||
            raw === "second year"
        ) {
            return "2";
        }

        if (
            raw === "3" ||
            raw === "3rd" ||
            raw === "3rd year" ||
            raw === "third year"
        ) {
            return "3";
        }

        if (
            raw === "4" ||
            raw === "4th" ||
            raw === "4th year" ||
            raw === "fourth year"
        ) {
            return "4";
        }

        return raw;
    };

    /*
    |--------------------------------------------------------------------------
    | NORMALIZE SEMESTER
    |--------------------------------------------------------------------------
    |
    | Supports:
    |
    | "1st Semester"
    | "1st Sem"
    | "First Semester"
    | "1"
    | "2nd Semester"
    | etc.
    |
    */

    const normalizeSemester = (value) => {
        const raw = String(value ?? "")
            .trim()
            .toLowerCase();

        if (!raw) {
            return "";
        }

        if (
            raw === "1" ||
            raw === "1st" ||
            raw === "1st sem" ||
            raw === "1st semester" ||
            raw === "first semester"
        ) {
            return "1";
        }

        if (
            raw === "2" ||
            raw === "2nd" ||
            raw === "2nd sem" ||
            raw === "2nd semester" ||
            raw === "second semester"
        ) {
            return "2";
        }

        if (
            raw === "summer" ||
            raw === "summer semester"
        ) {
            return "summer";
        }

        return raw;
    };

    /*
    |--------------------------------------------------------------------------
    | NORMALIZE SUBJECT
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    | Backend may return different field formats depending
    | on the SQL query.
    |
    | We normalize everything here before the UI uses it.
    |
    */

    const normalizeSubject = (raw) => {
        /*
        |----------------------------------------------------------------------
        | PROGRAM IDS
        |----------------------------------------------------------------------
        */

        const programIds = [
            ...parseList(raw.program_ids),
            ...parseList(raw.program_id)
        ]
            .map(normalizeId)
            .filter(Boolean);

        /*
        |----------------------------------------------------------------------
        | PROGRAM NAMES
        |----------------------------------------------------------------------
        */

        const programNames = [
            ...parseList(raw.program_names),
            ...parseList(raw.program_name)
        ]
            .map((value) => String(value).trim())
            .filter(Boolean);

        /*
        |----------------------------------------------------------------------
        | YEAR LEVELS
        |----------------------------------------------------------------------
        */

        const yearLevels = [
            ...parseList(raw.year_levels),
            ...parseList(raw.year_level),
            ...parseList(raw.years),
            ...parseList(raw.year)
        ]
            .map(normalizeYear)
            .filter(Boolean);

        /*
        |----------------------------------------------------------------------
        | SEMESTERS
        |----------------------------------------------------------------------
        */

        const semesters = [
            ...parseList(raw.semesters),
            ...parseList(raw.semester)
        ]
            .map(normalizeSemester)
            .filter(Boolean);

        /*
        |----------------------------------------------------------------------
        | REMOVE DUPLICATES
        |----------------------------------------------------------------------
        */

        const uniqueProgramIds = [
            ...new Set(programIds)
        ];

        const uniqueProgramNames = [
            ...new Set(programNames)
        ];

        const uniqueYears = [
            ...new Set(yearLevels)
        ];

        const uniqueSemesters = [
            ...new Set(semesters)
        ];

        /*
        |----------------------------------------------------------------------
        | UNITS
        |----------------------------------------------------------------------
        */

        const lectureUnits =
            Number(raw.lecture_units) || 0;

        const labUnits =
            Number(raw.lab_units) || 0;

        /*
        | IMPORTANT:
        | Total units always comes from:
        |
        | lecture + lab
        |
        */

        const totalUnits =
            lectureUnits + labUnits;

        return {
            ...raw,

            program_ids: uniqueProgramIds,
            program_names: uniqueProgramNames,

            year_levels: uniqueYears,
            semesters: uniqueSemesters,

            lecture_units: lectureUnits,
            lab_units: labUnits,
            units: totalUnits,

            program_count:
                Number(
                    raw.program_count
                ) ||
                uniqueProgramIds.length ||
                uniqueProgramNames.length ||
                0
        };
    };

    /*
    |--------------------------------------------------------------------------
    | GET PROGRAMS
    |--------------------------------------------------------------------------
    */

    const getPrograms = async () => {
        try {
            const response = await fetch(
                "http://localhost:3000/api/auth/getPrograms"
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Failed to get programs"
                );
            }

            setProgramList(
                data.programs || []
            );
        } catch (err) {
            console.error(
                "Error getting programs:",
                err
            );
        }
    };

    /*
    |--------------------------------------------------------------------------
    | GET SUBJECTS
    |--------------------------------------------------------------------------
    */

    const fetchSubjects = async () => {
        try {
            setLoading(true);

            const token =
                localStorage.getItem(
                    "admin_token"
                );

            const response = await fetch(
                "http://localhost:3000/api/auth/getSubjects",
                {
                    method: "GET",
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Failed to fetch subjects"
                );
            }

            console.log(
                "RAW SUBJECTS FROM API:",
                data.subjects
            );

            /*
            |----------------------------------------------------------------------
            | NORMALIZE HERE
            |----------------------------------------------------------------------
            */

            const normalizedSubjects =
                (data.subjects || [])
                    .map(normalizeSubject);

            console.log(
                "NORMALIZED SUBJECTS:",
                normalizedSubjects
            );

            setSubjects(
                normalizedSubjects
            );

        } catch (error) {
            console.error(
                "Error fetching subjects:",
                error
            );
        } finally {
            setLoading(false);
        }
    };

    /*
    |--------------------------------------------------------------------------
    | FILTERED SUBJECTS
    |--------------------------------------------------------------------------
    */

    const filteredSubjects = useMemo(() => {
        const searchValue =
            search
                .trim()
                .toLowerCase();

        return subjects.filter(
            (sub) => {

                /*
                |--------------------------------------------------------------
                | SEARCH
                |--------------------------------------------------------------
                */

                const matchesSearch =
                    !searchValue ||
                    String(
                        sub.subject_code || ""
                    )
                        .toLowerCase()
                        .includes(
                            searchValue
                        ) ||
                    String(
                        sub.subject_name || ""
                    )
                        .toLowerCase()
                        .includes(
                            searchValue
                        ) ||
                    sub.program_names.some(
                        (program) =>
                            String(
                                program
                            )
                                .toLowerCase()
                                .includes(
                                    searchValue
                                )
                    );

                /*
                |--------------------------------------------------------------
                | PROGRAM
                |--------------------------------------------------------------
                */

                const selectedProgramId =
                    normalizeId(
                        programFilter
                    );

                const matchesProgram =
                    programFilter ===
                        "all" ||
                    sub.program_ids.some(
                        (id) =>
                            normalizeId(
                                id
                            ) ===
                            selectedProgramId
                    );

                /*
                |--------------------------------------------------------------
                | SEMESTER
                |--------------------------------------------------------------
                */

                const matchesSemester =
                    semesterFilter ===
                        "all" ||
                    sub.semesters.some(
                        (semester) =>
                            normalizeSemester(
                                semester
                            ) ===
                            normalizeSemester(
                                semesterFilter
                            )
                    );

                /*
                |--------------------------------------------------------------
                | YEAR
                |--------------------------------------------------------------
                */

                const matchesYear =
                    yearFilter ===
                        "all" ||
                    sub.year_levels.some(
                        (year) =>
                            normalizeYear(
                                year
                            ) ===
                            normalizeYear(
                                yearFilter
                            )
                    );

                return (
                    matchesSearch &&
                    matchesProgram &&
                    matchesSemester &&
                    matchesYear
                );
            }
        );
    }, [
        subjects,
        search,
        programFilter,
        semesterFilter,
        yearFilter
    ]);

    /*
    |--------------------------------------------------------------------------
    | AVAILABLE YEARS
    |--------------------------------------------------------------------------
    */

    const availableYears = useMemo(() => {
        const years =
            new Set();

        subjects.forEach(
            (sub) => {
                sub.year_levels.forEach(
                    (year) => {
                        years.add(
                            normalizeYear(
                                year
                            )
                        );
                    }
                );
            }
        );

        return Array.from(years)
            .filter(Boolean)
            .sort(
                (a, b) =>
                    Number(a) -
                    Number(b)
            );
    }, [subjects]);

    /*
    |--------------------------------------------------------------------------
    | AVAILABLE SEMESTERS
    |--------------------------------------------------------------------------
    */

    const availableSemesters =
        useMemo(() => {

            const semesters =
                new Set();

            subjects.forEach(
                (sub) => {
                    sub.semesters.forEach(
                        (semester) => {

                            const normalized =
                                normalizeSemester(
                                    semester
                                );

                            if (
                                normalized
                            ) {
                                semesters.add(
                                    normalized
                                );
                            }
                        }
                    );
                }
            );

            /*
            |--------------------------------------------------------------
            | DISPLAY LABELS
            |--------------------------------------------------------------
            */

            const order = {
                "1": 1,
                "2": 2,
                "summer": 3
            };

            return Array.from(
                semesters
            ).sort(
                (a, b) =>
                    (order[a] || 99) -
                    (order[b] || 99)
            );

        }, [subjects]);

    /*
    |--------------------------------------------------------------------------
    | DISPLAY HELPERS
    |--------------------------------------------------------------------------
    */

    const formatYear = (year) => {
        switch (
            normalizeYear(year)
        ) {
            case "1":
                return "1st Year";

            case "2":
                return "2nd Year";

            case "3":
                return "3rd Year";

            case "4":
                return "4th Year";

            default:
                return year;
        }
    };

    const formatSemester = (
        semester
    ) => {
        switch (
            normalizeSemester(
                semester
            )
        ) {
            case "1":
                return "1st Semester";

            case "2":
                return "2nd Semester";

            case "summer":
                return "Summer";

            default:
                return semester;
        }
    };

    /*
    |--------------------------------------------------------------------------
    | FORM CHANGE
    |--------------------------------------------------------------------------
    */

    const handleChange = (e) => {
        const {
            name,
            value
        } = e.target;

        /*
        |----------------------------------------------------------------------
        | LECTURE
        |----------------------------------------------------------------------
        */

        if (
            name ===
            "lecture_units"
        ) {
            const lectureUnits =
                Math.max(
                    0,
                    Number(value) || 0
                );

            setSubject(
                (prev) => {

                    const labUnits =
                        Number(
                            prev.lab_units
                        ) || 0;

                    return {
                        ...prev,
                        lecture_units:
                            lectureUnits,
                        units:
                            lectureUnits +
                            labUnits
                    };
                }
            );

            return;
        }

        /*
        |----------------------------------------------------------------------
        | LAB
        |----------------------------------------------------------------------
        */

        if (
            name ===
            "lab_units"
        ) {
            const labUnits =
                Math.max(
                    0,
                    Number(value) || 0
                );

            setSubject(
                (prev) => {

                    const lectureUnits =
                        Number(
                            prev.lecture_units
                        ) || 0;

                    return {
                        ...prev,
                        lab_units:
                            labUnits,
                        units:
                            lectureUnits +
                            labUnits
                    };
                }
            );

            return;
        }

        /*
        |----------------------------------------------------------------------
        | OTHER FIELDS
        |----------------------------------------------------------------------
        */

        setSubject(
            (prev) => ({
                ...prev,
                [name]: value
            })
        );
    };

    /*
    |--------------------------------------------------------------------------
    | CREATE SUBJECT
    |--------------------------------------------------------------------------
    */

    const createSubject = async (
        e
    ) => {
        e.preventDefault();

        if (
            !subject.subject_code.trim()
        ) {
            alert(
                "Please enter a subject code."
            );
            return;
        }

        if (
            !subject.subject_name.trim()
        ) {
            alert(
                "Please enter a subject name."
            );
            return;
        }

        if (
            subject.programs.length ===
            0
        ) {
            alert(
                "Please select at least one program."
            );
            return;
        }

        const lectureUnits =
            Number(
                subject.lecture_units
            ) || 0;

        const labUnits =
            Number(
                subject.lab_units
            ) || 0;

        const totalUnits =
            lectureUnits +
            labUnits;

        const payload = {
            ...subject,
            lecture_units:
                lectureUnits,
            lab_units:
                labUnits,
            units:
                totalUnits
        };

        try {
            setSaving(true);

            const token =
                localStorage.getItem(
                    "admin_token"
                );

            const response =
                await fetch(
                    "http://localhost:3000/api/auth/admin/createSubject",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                            Authorization:
                                `Bearer ${token}`
                        },
                        body:
                            JSON.stringify(
                                payload
                            )
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Failed to create subject"
                );
            }

            alert(
                data.message ||
                "Subject successfully added!"
            );

            setShowModal(false);

            setSubject({
                ...EMPTY_SUBJECT,
                programs: []
            });

            await fetchSubjects();

        } catch (error) {
            alert(
                `Error in creating subject: ${error.message}`
            );
        } finally {
            setSaving(false);
        }
    };

    /*
    |--------------------------------------------------------------------------
    | DELETE SUBJECT
    |--------------------------------------------------------------------------
    */

    const handleDelete = async (
        subjectCode
    ) => {

        const confirmed =
            window.confirm(
                `Are you sure you want to delete "${subjectCode}"?`
            );

        if (!confirmed) {
            return;
        }

        try {
            const token =
                localStorage.getItem(
                    "admin_token"
                );

            /*
            |----------------------------------------------------------------------
            | IMPORTANT
            |----------------------------------------------------------------------
            |
            | Since backend may return one aggregated row,
            | use its actual ID.
            |
            */

            const matchingSubjects =
                subjects.filter(
                    (sub) =>
                        String(
                            sub.subject_code
                        )
                            .trim()
                            .toUpperCase() ===
                        String(
                            subjectCode
                        )
                            .trim()
                            .toUpperCase()
                );

            const ids =
                matchingSubjects
                    .map(
                        (sub) =>
                            sub.id
                    )
                    .filter(Boolean);

            if (
                ids.length ===
                0
            ) {
                alert(
                    "No subject record found."
                );
                return;
            }

            /*
            |----------------------------------------------------------------------
            | Remove duplicate IDs
            |----------------------------------------------------------------------
            */

            const uniqueIds =
                [
                    ...new Set(
                        ids
                    )
                ];

            for (
                const id of uniqueIds
            ) {

                const response =
                    await fetch(
                        `http://localhost:3000/api/auth/admin/${id}/deleteSubject`,
                        {
                            method:
                                "DELETE",
                            headers: {
                                "Content-Type":
                                    "application/json",
                                Authorization:
                                    `Bearer ${token}`
                            }
                        }
                    );

                if (
                    !response.ok
                ) {

                    const data =
                        await response
                            .json()
                            .catch(
                                () =>
                                    ({})
                            );

                    throw new Error(
                        data.message ||
                        `Failed to delete subject ID ${id}`
                    );
                }
            }

            alert(
                `${subjectCode} deleted successfully.`
            );

            await fetchSubjects();

        } catch (err) {

            console.error(
                "Delete subject error:",
                err
            );

            alert(
                err.message
            );
        }
    };

    /*
    |--------------------------------------------------------------------------
    | RESET FILTERS
    |--------------------------------------------------------------------------
    */

    const clearFilters = () => {
        setSearch("");
        setProgramFilter("all");
        setSemesterFilter("all");
        setYearFilter("all");
    };

    const hasFilters =
        search.trim() !== "" ||
        programFilter !== "all" ||
        semesterFilter !== "all" ||
        yearFilter !== "all";

    /*
    |--------------------------------------------------------------------------
    | OPEN ADD MODAL
    |--------------------------------------------------------------------------
    */

    const openAddModal = () => {
        setSubject({
            ...EMPTY_SUBJECT,
            programs: []
        });

        setShowModal(true);
    };

    /*
    |--------------------------------------------------------------------------
    | RENDER
    |--------------------------------------------------------------------------
    */

    return (
        <div className="subjects-page">

            {/* HEADER */}

            <div className="subjects-header">

                <div className="subjects-title-section">

                    <div className="subjects-title-icon">
                        📚
                    </div>

                    <div>
                        <h2>
                            Subjects
                        </h2>

                        <p>
                            Manage and organize your
                            academic subjects
                        </p>
                    </div>

                </div>

                <div className="subjects-header-actions">

                    <button
                        type="button"
                        className="refresh-button"
                        onClick={
                            fetchSubjects
                        }
                        disabled={
                            loading
                        }
                    >
                        ↻
                        <span>
                            Refresh
                        </span>
                    </button>

                    <button
                        type="button"
                        className="add-subject-button"
                        onClick={
                            openAddModal
                        }
                    >
                        <span>
                            +
                        </span>

                        Add Subject
                    </button>

                </div>

            </div>

            {/* STATISTICS */}

            <div className="subject-stats">

                <div className="stat-card">

                    <div className="stat-icon">
                        📚
                    </div>

                    <div>
                        <span>
                            Total Subjects
                        </span>

                        <strong>
                            {
                                subjects.length
                            }
                        </strong>
                    </div>

                </div>

                <div className="stat-card">

                    <div className="stat-icon">
                        🔎
                    </div>

                    <div>
                        <span>
                            Showing
                        </span>

                        <strong>
                            {
                                filteredSubjects.length
                            }
                        </strong>
                    </div>

                </div>

                <div className="stat-card">

                    <div className="stat-icon">
                        🎓
                    </div>

                    <div>
                        <span>
                            Programs
                        </span>

                        <strong>
                            {
                                programList.length
                            }
                        </strong>
                    </div>

                </div>

            </div>

            {/* FILTERS */}

            <div className="subject-filter-card">

                <div className="search-wrapper">

                    <span className="search-icon">
                        🔎
                    </span>

                    <input
                        type="text"
                        placeholder="Search subject code, name, or program..."
                        value={
                            search
                        }
                        onChange={(e) =>
                            setSearch(
                                e.target.value
                            )
                        }
                    />

                    {search && (
                        <button
                            type="button"
                            className="clear-search"
                            onClick={() =>
                                setSearch("")
                            }
                        >
                            ×
                        </button>
                    )}

                </div>

                {/* PROGRAM */}

                <div className="filter-group">

                    <select
                        value={
                            programFilter
                        }
                        onChange={(e) =>
                            setProgramFilter(
                                e.target.value
                            )
                        }
                    >

                        <option value="all">
                            All Programs
                        </option>

                        {programList.map(
                            (program) => (
                                <option
                                    key={
                                        program.id
                                    }
                                    value={
                                        String(
                                            program.id
                                        )
                                    }
                                >
                                    {
                                        program.program_name
                                    }
                                </option>
                            )
                        )}

                    </select>

                </div>

                {/* YEAR */}

                <div className="filter-group">

                    <select
                        value={
                            yearFilter
                        }
                        onChange={(e) =>
                            setYearFilter(
                                e.target.value
                            )
                        }
                    >

                        <option value="all">
                            All Years
                        </option>

                        {availableYears.map(
                            (year) => (
                                <option
                                    key={
                                        year
                                    }
                                    value={
                                        year
                                    }
                                >
                                    {
                                        formatYear(
                                            year
                                        )
                                    }
                                </option>
                            )
                        )}

                    </select>

                </div>

                {/* SEMESTER */}

                <div className="filter-group">

                    <select
                        value={
                            semesterFilter
                        }
                        onChange={(e) =>
                            setSemesterFilter(
                                e.target.value
                            )
                        }
                    >

                        <option value="all">
                            All Semesters
                        </option>

                        {availableSemesters.map(
                            (
                                semester
                            ) => (
                                <option
                                    key={
                                        semester
                                    }
                                    value={
                                        semester
                                    }
                                >
                                    {
                                        formatSemester(
                                            semester
                                        )
                                    }
                                </option>
                            )
                        )}

                    </select>

                </div>

                {hasFilters && (
                    <button
                        type="button"
                        className="clear-filters-button"
                        onClick={
                            clearFilters
                        }
                    >
                        Clear
                    </button>
                )}

            </div>

            {/* TABLE */}

            <div className="subjects-table-card">

                <div className="table-top">

                    <div>

                        <h3>
                            Subject List
                        </h3>

                        <p>
                            {
                                filteredSubjects.length
                            }{" "}
                            subject
                            {
                                filteredSubjects.length !==
                                1
                                    ? "s"
                                    : ""
                            }
                        </p>

                    </div>

                    {hasFilters && (
                        <div className="active-filter-label">
                            Filters active
                        </div>
                    )}

                </div>

                {loading ? (

                    <div className="subjects-loading">

                        <div className="loading-spinner"></div>

                        <p>
                            Loading subjects...
                        </p>

                    </div>

                ) : filteredSubjects.length ===
                  0 ? (

                    <div className="subjects-empty">

                        <div className="empty-icon">
                            🔍
                        </div>

                        <h3>
                            No subjects found
                        </h3>

                        <p>
                            Try changing your
                            search or filters.
                        </p>

                        {hasFilters && (
                            <button
                                type="button"
                                onClick={
                                    clearFilters
                                }
                                className="empty-clear-button"
                            >
                                Clear Filters
                            </button>
                        )}

                    </div>

                ) : (

                    <div className="table-wrapper">

                        <table>

                            <thead>

                                <tr>
                                    <th>
                                        #
                                    </th>

                                    <th>
                                        Subject
                                    </th>

                                    <th>
                                        Units
                                    </th>

                                    <th>
                                        Year
                                    </th>

                                    <th>
                                        Semester
                                    </th>

                                    <th>
                                        Programs
                                    </th>

                                    <th>
                                        Action
                                    </th>
                                </tr>

                            </thead>

                            <tbody>

                                {filteredSubjects.map(
                                    (
                                        sub,
                                        index
                                    ) => {

                                        const programNames =
                                            sub.program_names ||
                                            [];

                                        const yearLevels =
                                            sub.year_levels ||
                                            [];

                                        const semesters =
                                            sub.semesters ||
                                            [];

                                        const programCount =
                                            Number(
                                                sub.program_count
                                            ) ||
                                            programNames.length ||
                                            sub.program_ids.length ||
                                            0;

                                        return (
                                            <tr
                                                key={
                                                    sub.id ||
                                                    `${sub.subject_code}-${index}`
                                                }
                                            >

                                                {/* NUMBER */}

                                                <td className="row-number">
                                                    {
                                                        index +
                                                        1
                                                    }
                                                </td>

                                                {/* SUBJECT */}

                                                <td>

                                                    <div className="subject-info">

                                                        <span className="subject-code">
                                                            {
                                                                sub.subject_code
                                                            }
                                                        </span>

                                                        <strong>
                                                            {
                                                                sub.subject_name
                                                            }
                                                        </strong>

                                                        {sub.description && (
                                                            <small>
                                                                {
                                                                    sub.description
                                                                }
                                                            </small>
                                                        )}

                                                    </div>

                                                </td>

                                                {/* UNITS */}

                                                <td>

                                                    <span className="units-badge">
                                                        {
                                                            sub.units
                                                        }{" "}
                                                        units
                                                    </span>

                                                </td>

                                                {/* YEAR */}

                                                <td>

                                                    <div className="tag-list">

                                                        {yearLevels.length >
                                                        0 ? (
                                                            yearLevels.map(
                                                                (
                                                                    year
                                                                ) => (
                                                                    <span
                                                                        className="year-tag"
                                                                        key={
                                                                            year
                                                                        }
                                                                    >
                                                                        {
                                                                            formatYear(
                                                                                year
                                                                            )
                                                                        }
                                                                    </span>
                                                                )
                                                            )
                                                        ) : (
                                                            <span className="muted">
                                                                —
                                                            </span>
                                                        )}

                                                    </div>

                                                </td>

                                                {/* SEMESTER */}

                                                <td>

                                                    <div className="tag-list">

                                                        {semesters.length >
                                                        0 ? (
                                                            semesters.map(
                                                                (
                                                                    semester
                                                                ) => (
                                                                    <span
                                                                        className="semester-tag"
                                                                        key={
                                                                            semester
                                                                        }
                                                                    >
                                                                        {
                                                                            formatSemester(
                                                                                semester
                                                                            )
                                                                        }
                                                                    </span>
                                                                )
                                                            )
                                                        ) : (
                                                            <span className="muted">
                                                                —
                                                            </span>
                                                        )}

                                                    </div>

                                                </td>

                                                {/* PROGRAMS */}

                                                <td>

                                                    <div className="program-cell">

                                                        <div className="program-badges">

                                                            {programNames
                                                                .slice(
                                                                    0,
                                                                    3
                                                                )
                                                                .map(
                                                                    (
                                                                        program
                                                                    ) => (
                                                                        <span
                                                                            className="program-badge"
                                                                            key={
                                                                                program
                                                                            }
                                                                        >
                                                                            {
                                                                                program
                                                                            }
                                                                        </span>
                                                                    )
                                                                )}

                                                            {programNames.length >
                                                                3 && (
                                                                <span className="program-more">
                                                                    +
                                                                    {
                                                                        programNames.length -
                                                                        3
                                                                    }
                                                                </span>
                                                            )}

                                                        </div>

                                                        <small>
                                                            {
                                                                programCount
                                                            }{" "}
                                                            program
                                                            {
                                                                programCount !==
                                                                1
                                                                    ? "s"
                                                                    : ""
                                                            }
                                                        </small>

                                                    </div>

                                                </td>

                                                {/* ACTION */}

                                                <td>

                                                    <div className="action-buttons">

                                                        <button
                                                            type="button"
                                                            className="edit-button"
                                                            title="Edit subject"
                                                        >
                                                            Edit
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="delete-button"
                                                            onClick={() =>
                                                                handleDelete(
                                                                    sub.subject_code
                                                                )
                                                            }
                                                            title="Delete subject"
                                                        >
                                                            Delete
                                                        </button>

                                                    </div>

                                                </td>

                                            </tr>
                                        );
                                    }
                                )}

                            </tbody>

                        </table>

                    </div>

                )}

            </div>

            {/* ADD SUBJECT MODAL */}

            {showModal && (

                <div
                    className="subject-modal-overlay"
                    onMouseDown={(e) => {

                        if (
                            e.target ===
                                e.currentTarget &&
                            !saving
                        ) {
                            setShowModal(
                                false
                            );
                        }

                    }}
                >

                    <form
                        className="subject-modal"
                        onSubmit={
                            createSubject
                        }
                    >

                        {/* HEADER */}

                        <div className="modal-header">

                            <div>

                                <div className="modal-icon">
                                    📚
                                </div>

                                <div>
                                    <h2>
                                        Add Subject
                                    </h2>

                                    <p>
                                        Create a new
                                        academic
                                        subject
                                    </p>
                                </div>

                            </div>

                            <button
                                type="button"
                                className="modal-close"
                                disabled={
                                    saving
                                }
                                onClick={() =>
                                    setShowModal(
                                        false
                                    )
                                }
                            >
                                ×
                            </button>

                        </div>

                        {/* BODY */}

                        <div className="modal-body">

                            {/* CODE + NAME */}

                            <div className="form-row">

                                <div className="form-field">

                                    <label>
                                        Subject Code
                                    </label>

                                    <input
                                        name="subject_code"
                                        value={
                                            subject.subject_code
                                        }
                                        placeholder="e.g. CS101"
                                        onChange={
                                            handleChange
                                        }
                                        required
                                    />

                                </div>

                                <div className="form-field">

                                    <label>
                                        Subject Name
                                    </label>

                                    <input
                                        name="subject_name"
                                        value={
                                            subject.subject_name
                                        }
                                        placeholder="e.g. Introduction to Computing"
                                        onChange={
                                            handleChange
                                        }
                                        required
                                    />

                                </div>

                            </div>

                            {/* DESCRIPTION */}

                            <div className="form-field">

                                <label>
                                    Description
                                </label>

                                <textarea
                                    name="description"
                                    value={
                                        subject.description
                                    }
                                    placeholder="Enter a short description..."
                                    onChange={
                                        handleChange
                                    }
                                    rows="3"
                                />

                            </div>

                            {/* UNITS */}

                            <div className="form-row three">

                                {/* TOTAL */}

                                <div className="form-field">

                                    <label>
                                        Total Units
                                    </label>

                                    <input
                                        type="number"
                                        min="0"
                                        value={
                                            subject.units
                                        }
                                        readOnly
                                        className="computed-unit-input"
                                    />

                                    <small className="field-hint">
                                        Lecture + Lab
                                    </small>

                                </div>

                                {/* LECTURE */}

                                <div className="form-field">

                                    <label>
                                        Lecture Units
                                    </label>

                                    <input
                                        type="number"
                                        name="lecture_units"
                                        min="0"
                                        step="1"
                                        value={
                                            subject.lecture_units
                                        }
                                        onChange={
                                            handleChange
                                        }
                                    />

                                    <small className="field-hint">
                                        1 unit = 1 hour
                                    </small>

                                </div>

                                {/* LAB */}

                                <div className="form-field">

                                    <label>
                                        Lab Units
                                    </label>

                                    <input
                                        type="number"
                                        name="lab_units"
                                        min="0"
                                        step="1"
                                        value={
                                            subject.lab_units
                                        }
                                        onChange={
                                            handleChange
                                        }
                                    />

                                    <small className="field-hint">
                                        1 unit = 3 hours
                                    </small>

                                </div>

                            </div>

                            {/* UNIT SUMMARY */}

                            <div className="unit-summary">

                                <div className="unit-summary-item">

                                    <span>
                                        Lecture
                                    </span>

                                    <strong>
                                        {
                                            subject.lecture_units
                                        }
                                    </strong>

                                </div>

                                <span className="unit-plus">
                                    +
                                </span>

                                <div className="unit-summary-item">

                                    <span>
                                        Laboratory
                                    </span>

                                    <strong>
                                        {
                                            subject.lab_units
                                        }
                                    </strong>

                                </div>

                                <span className="unit-equals">
                                    =
                                </span>

                                <div className="unit-summary-item total">

                                    <span>
                                        Total
                                    </span>

                                    <strong>
                                        {
                                            subject.units
                                        }
                                    </strong>

                                </div>

                            </div>

                            {/* PROGRAMS */}

                            <div className="program-selection">

                                <div className="program-selection-header">

                                    <div>

                                        <label>
                                            Programs
                                        </label>

                                        <p>
                                            Select all
                                            programs
                                            that use
                                            this subject.
                                        </p>

                                    </div>

                                    <span>
                                        {
                                            subject
                                                .programs
                                                .length
                                        }{" "}
                                        selected
                                    </span>

                                </div>

                                <div className="program-checkboxes">

                                    {programList.map(
                                        (
                                            program
                                        ) => {

                                            const programId =
                                                Number(
                                                    program.id
                                                );

                                            const selected =
                                                subject.programs.includes(
                                                    programId
                                                );

                                            return (
                                                <label
                                                    key={
                                                        program.id
                                                    }
                                                    className={`program-option ${
                                                        selected
                                                            ? "selected"
                                                            : ""
                                                    }`}
                                                >

                                                    <input
                                                        type="checkbox"
                                                        value={
                                                            program.id
                                                        }
                                                        checked={
                                                            selected
                                                        }
                                                        onChange={(
                                                            e
                                                        ) => {

                                                            setSubject(
                                                                (
                                                                    prev
                                                                ) => {

                                                                    if (
                                                                        e
                                                                            .target
                                                                            .checked
                                                                    ) {

                                                                        if (
                                                                            prev.programs.includes(
                                                                                programId
                                                                            )
                                                                        ) {
                                                                            return prev;
                                                                        }

                                                                        return {
                                                                            ...prev,
                                                                            programs:
                                                                                [
                                                                                    ...prev.programs,
                                                                                    programId
                                                                                ]
                                                                        };
                                                                    }

                                                                    return {
                                                                        ...prev,
                                                                        programs:
                                                                            prev.programs.filter(
                                                                                (
                                                                                    id
                                                                                ) =>
                                                                                    id !==
                                                                                    programId
                                                                            )
                                                                    };
                                                                }
                                                            );

                                                        }}
                                                    />

                                                    <span className="custom-check">
                                                        ✓
                                                    </span>

                                                    <span className="program-option-name">
                                                        {
                                                            program.program_name
                                                        }
                                                    </span>

                                                </label>
                                            );
                                        }
                                    )}

                                </div>

                            </div>

                        </div>

                        {/* FOOTER */}

                        <div className="modal-footer">

                            <button
                                type="button"
                                className="cancel-button"
                                disabled={
                                    saving
                                }
                                onClick={() =>
                                    setShowModal(
                                        false
                                    )
                                }
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                className="save-button"
                                disabled={
                                    saving
                                }
                            >

                                {saving ? (
                                    <>
                                        <span className="button-spinner"></span>
                                        Saving...
                                    </>
                                ) : (
                                    "Save Subject"
                                )}

                            </button>

                        </div>

                    </form>

                </div>

            )}

        </div>
    );
};

export default AllSubjects;