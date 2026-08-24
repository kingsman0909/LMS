import "./styles/allSubjects.css";
import { useState, useEffect, useMemo } from "react";
import { API_BASE_URL } from "../../../config";

const AllSubjects = ({ academicTermId }) => {
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
    | UNIVERSITY CAPACITY
    |--------------------------------------------------------------------------
    */

    const [capacityLoading, setCapacityLoading] =
        useState(false);

    const [capacityResult, setCapacityResult] =
        useState(null);

    const [showCapacityModal, setShowCapacityModal] =
        useState(false);

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

    const [subject, setSubject] =
        useState(EMPTY_SUBJECT);

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
    */

    const normalizeSubject = (raw) => {

        const programIds = [
            ...parseList(raw.program_ids),
            ...parseList(raw.program_id)
        ]
            .map(normalizeId)
            .filter(Boolean);

        const programNames = [
            ...parseList(raw.program_names),
            ...parseList(raw.program_name)
        ]
            .map((value) =>
                String(value).trim()
            )
            .filter(Boolean);

        const yearLevels = [
            ...parseList(raw.year_levels),
            ...parseList(raw.year_level),
            ...parseList(raw.years),
            ...parseList(raw.year)
        ]
            .map(normalizeYear)
            .filter(Boolean);

        const semesters = [
            ...parseList(raw.semesters),
            ...parseList(raw.semester)
        ]
            .map(normalizeSemester)
            .filter(Boolean);

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

        const lectureUnits =
            Number(raw.lecture_units) || 0;

        const labUnits =
            Number(raw.lab_units) || 0;

        const totalUnits =
            lectureUnits + labUnits;

        return {
            ...raw,

            program_ids:
                uniqueProgramIds,

            program_names:
                uniqueProgramNames,

            year_levels:
                uniqueYears,

            semesters:
                uniqueSemesters,

            lecture_units:
                lectureUnits,

            lab_units:
                labUnits,

            units:
                totalUnits,

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

            const response =
                await fetch(`${API_BASE_URL}/api/auth/getPrograms`);

            const data =
                await response.json();

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

            const response =
                await fetch(`${API_BASE_URL}/api/auth/getSubjects`,
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
    | CHECK UNIVERSITY CAPACITY
    |--------------------------------------------------------------------------
    */

    const checkUniversityCapacity =
        async () => {

            const termId =
                Number(
                    academicTermId
                );

            if (
                !Number.isInteger(termId) ||
                termId <= 0
            ) {

                alert(
                    "A valid academic term is required."
                );

                return;
            }

            try {

                setCapacityLoading(
                    true
                );

                setShowCapacityModal(
                    true
                );

                setCapacityResult(
                    null
                );

                const token =
                    localStorage.getItem(
                        "admin_token"
                    );

                const response =
                    await fetch(`${API_BASE_URL}/api/auth/admin/checkUniversityCapacity?academicTermId=${encodeURIComponent(
                            termId
                        )}`,
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
                        "Failed to check university capacity."
                    );
                }

                console.log(
                    "UNIVERSITY CAPACITY RESULT:",
                    data
                );

                const result =
                    data.result ||
                    data.capacity ||
                    data;

                setCapacityResult(
                    result
                );

            } catch (error) {

                console.error(
                    "University capacity error:",
                    error
                );

                setCapacityResult({
                    passed: false,

                    message:
                        error.message ||
                        "Failed to check university capacity.",

                    error: true
                });

            } finally {

                setCapacityLoading(
                    false
                );

            }
        };

    /*
    |--------------------------------------------------------------------------
    | FILTERED SUBJECTS
    |--------------------------------------------------------------------------
    */

    const filteredSubjects =
        useMemo(() => {

            const searchValue =
                search
                    .trim()
                    .toLowerCase();

            return subjects.filter(
                (sub) => {

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

    const availableYears =
        useMemo(() => {

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

    const formatSemester =
        (semester) => {

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

    const createSubject = async (e) => {

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
                await fetch(`${API_BASE_URL}/api/auth/admin/createSubject`,
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

            setShowModal(
                false
            );

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

    const handleDelete =
        async (subjectCode) => {

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
                        await fetch(`${API_BASE_URL}/api/auth/admin/${id}/deleteSubject`,
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

                    {/* UNIVERSITY CAPACITY */}

                    <button
                        type="button"
                        className="capacity-check-button"
                        onClick={
                            checkUniversityCapacity
                        }
                        disabled={
                            capacityLoading
                        }
                    >

                        {capacityLoading ? (
                            <>
                                <span className="button-spinner"></span>
                                Checking...
                            </>
                        ) : (
                            <>
                                <span>
                                    ⚡
                                </span>

                                Check University Capacity
                            </>
                        )}

                    </button>

                    {/* REFRESH */}

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

                    {/* ADD */}

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

            {/* ==================================================================
                ADD SUBJECT MODAL
            ================================================================== */}

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

            {/* ==================================================================
                UNIVERSITY CAPACITY MODAL
            ================================================================== */}

            {showCapacityModal && (

                <div
                    className="subject-modal-overlay"
                    onMouseDown={(e) => {

                        if (
                            e.target ===
                                e.currentTarget &&
                            !capacityLoading
                        ) {

                            setShowCapacityModal(
                                false
                            );

                        }

                    }}
                >

                    <div
                        className="subject-modal capacity-modal"
                        onMouseDown={(e) =>
                            e.stopPropagation()
                        }
                    >

                        {/* HEADER */}

                        <div className="modal-header">

                            <div>

                                <div className="modal-icon">
                                    ⚡
                                </div>

                                <div>

                                    <h2>
                                        University Capacity
                                    </h2>

                                    <p>
                                        Professor capacity
                                        analysis
                                    </p>

                                </div>

                            </div>

                            <button
                                type="button"
                                className="modal-close"
                                disabled={
                                    capacityLoading
                                }
                                onClick={() =>
                                    setShowCapacityModal(
                                        false
                                    )
                                }
                            >
                                ×
                            </button>

                        </div>

                        {/* BODY */}

                        <div className="modal-body">

                            {capacityLoading ? (

                                <div className="subjects-loading">

                                    <div className="loading-spinner"></div>

                                    <p>
                                        Checking university
                                        professor capacity...
                                    </p>

                                    <small>
                                        Analyzing programs,
                                        sections,
                                        curriculum and
                                        professor qualifications.
                                    </small>

                                </div>

                            ) : capacityResult ? (

                                <>

                                    {/* STATUS */}

                                    <div
                                        className={
                                            capacityResult.passed
                                                ? "capacity-status success"
                                                : "capacity-status danger"
                                        }
                                    >

                                        <div className="capacity-status-icon">

                                            {
                                                capacityResult.passed
                                                    ? "✓"
                                                    : "!"
                                            }

                                        </div>

                                        <div>

                                            <strong>
                                                {
                                                    capacityResult.passed
                                                        ? "SUFFICIENT"
                                                        : "INSUFFICIENT"
                                                }
                                            </strong>

                                            <p>
                                                {
                                                    capacityResult.message ||
                                                    (
                                                        capacityResult.passed
                                                            ? "University professor capacity is sufficient."
                                                            : "University professor capacity is insufficient."
                                                    )
                                                }
                                            </p>

                                        </div>

                                    </div>

                                    {/* GLOBAL SUMMARY */}

                                    {
                                        capacityResult
                                            .globalProfessorSummary && (

                                            <div className="capacity-summary">

                                                <h3>
                                                    Global Professor Summary
                                                </h3>

                                                <div className="capacity-grid">

                                                    <div className="capacity-item">

                                                        <span>
                                                            Active Professors
                                                        </span>

                                                        <strong>
                                                            {
                                                                capacityResult
                                                                    .globalProfessorSummary
                                                                    .uniqueProfessors
                                                            }
                                                        </strong>

                                                    </div>

                                                    <div className="capacity-item">

                                                        <span>
                                                            Qualified Professors
                                                        </span>

                                                        <strong>
                                                            {
                                                                capacityResult
                                                                    .globalProfessorSummary
                                                                    .globallyQualifiedProfessors
                                                            }
                                                        </strong>

                                                    </div>

                                                    <div className="capacity-item">

                                                        <span>
                                                            Required Hours
                                                        </span>

                                                        <strong>
                                                            {
                                                                capacityResult
                                                                    .globalProfessorSummary
                                                                    .totalRequiredTeachingHours
                                                            }
                                                        </strong>

                                                    </div>

                                                    <div className="capacity-item">

                                                        <span>
                                                            Professor Capacity
                                                        </span>

                                                        <strong>
                                                            {
                                                                capacityResult
                                                                    .globalProfessorSummary
                                                                    .totalProfessorCapacity
                                                            }
                                                        </strong>

                                                    </div>

                                                    <div className="capacity-item">

                                                        <span>
                                                            Allocatable Capacity
                                                        </span>

                                                        <strong>
                                                            {
                                                                capacityResult
                                                                    .globalProfessorSummary
                                                                    .allocatableQualifiedCapacity
                                                            }
                                                        </strong>

                                                    </div>

                                                    <div className="capacity-item">

                                                        <span>
                                                            Shortage Hours
                                                        </span>

                                                        <strong
                                                            className={
                                                                Number(
                                                                    capacityResult
                                                                        .globalProfessorSummary
                                                                        .shortageHours
                                                                ) > 0
                                                                    ? "danger-text"
                                                                    : "success-text"
                                                            }
                                                        >
                                                            {
                                                                capacityResult
                                                                    .globalProfessorSummary
                                                                    .shortageHours
                                                            }
                                                        </strong>

                                                    </div>

                                                    <div className="capacity-item">

                                                        <span>
                                                            Professors Used
                                                        </span>

                                                        <strong>
                                                            {
                                                                capacityResult
                                                                    .globalProfessorSummary
                                                                    .professorsUsedByCapacityAllocation
                                                            }
                                                        </strong>

                                                    </div>

                                                    <div className="capacity-item">

                                                        <span>
                                                            Subject Bottlenecks
                                                        </span>

                                                        <strong
                                                            className={
                                                                Number(
                                                                    capacityResult
                                                                        .globalProfessorSummary
                                                                        .subjectBottlenecks
                                                                ) > 0
                                                                    ? "danger-text"
                                                                    : "success-text"
                                                            }
                                                        >
                                                            {
                                                                capacityResult
                                                                    .globalProfessorSummary
                                                                    .subjectBottlenecks
                                                            }
                                                        </strong>

                                                    </div>

                                                </div>

                                            </div>

                                        )
                                    }

                                    {/* PROGRAM SUMMARY */}

                                    <div className="capacity-program-summary">

                                        <h3>
                                            Program Results
                                        </h3>

                                        <div className="capacity-grid">

                                            <div className="capacity-item">

                                                <span>
                                                    Total Programs
                                                </span>

                                                <strong>
                                                    {
                                                        capacityResult
                                                            .totalPrograms
                                                    }
                                                </strong>

                                            </div>

                                            <div className="capacity-item">

                                                <span>
                                                    Checked Programs
                                                </span>

                                                <strong>
                                                    {
                                                        capacityResult
                                                            .checkedPrograms
                                                    }
                                                </strong>

                                            </div>

                                            <div className="capacity-item">

                                                <span>
                                                    Passed
                                                </span>

                                                <strong className="success-text">
                                                    {
                                                        capacityResult
                                                            .passedPrograms
                                                    }
                                                </strong>

                                            </div>

                                            <div className="capacity-item">

                                                <span>
                                                    Failed
                                                </span>

                                                <strong
                                                    className={
                                                        capacityResult
                                                            .failedPrograms > 0
                                                            ? "danger-text"
                                                            : "success-text"
                                                    }
                                                >
                                                    {
                                                        capacityResult
                                                            .failedPrograms
                                                    }
                                                </strong>

                                            </div>

                                            <div className="capacity-item">

                                                <span>
                                                    Skipped
                                                </span>

                                                <strong>
                                                    {
                                                        capacityResult
                                                            .skippedPrograms
                                                    }
                                                </strong>

                                            </div>

                                        </div>

                                    </div>

                                    {/* BOTTLENECKS */}

                                    {
                                        Array.isArray(
                                            capacityResult
                                                .globalSubjectBottlenecks
                                        ) &&
                                        capacityResult
                                            .globalSubjectBottlenecks
                                            .length > 0 && (

                                            <div className="capacity-bottlenecks">

                                                <h3>
                                                    Subject Bottlenecks
                                                </h3>

                                                <div className="bottleneck-list">

                                                    {
                                                        capacityResult
                                                            .globalSubjectBottlenecks
                                                            .map(
                                                                (
                                                                    bottleneck,
                                                                    index
                                                                ) => (

                                                                    <div
                                                                        className="bottleneck-item"
                                                                        key={
                                                                            `${bottleneck.programId || "program"}-${bottleneck.subjectCode || "subject"}-${index}`
                                                                        }
                                                                    >

                                                                        <div>

                                                                            <strong>
                                                                                {
                                                                                    bottleneck.subjectCode
                                                                                }
                                                                            </strong>

                                                                            <span>
                                                                                {
                                                                                    bottleneck.subjectName
                                                                                }
                                                                            </span>

                                                                        </div>

                                                                        <div className="bottleneck-values">

                                                                            <span>
                                                                                Required:
                                                                                {" "}
                                                                                {
                                                                                    bottleneck.requiredHours
                                                                                }
                                                                            </span>

                                                                            <span>
                                                                                Allocated:
                                                                                {" "}
                                                                                {
                                                                                    bottleneck.allocatedHours
                                                                                }
                                                                            </span>

                                                                            <span className="danger-text">
                                                                                Shortage:
                                                                                {" "}
                                                                                {
                                                                                    bottleneck.capacityShortage
                                                                                }
                                                                            </span>

                                                                            <span>
                                                                                Qualified:
                                                                                {" "}
                                                                                {
                                                                                    bottleneck.qualifiedProfessorCount
                                                                                }
                                                                            </span>

                                                                        </div>

                                                                    </div>

                                                                )
                                                            )

                                                    }

                                                </div>

                                            </div>

                                        )
                                    }

                                    {/* FAILED PROGRAMS */}

                                    {
                                        Array.isArray(
                                            capacityResult.failed
                                        ) &&
                                        capacityResult
                                            .failed
                                            .length > 0 && (

                                            <div className="capacity-bottlenecks">

                                                <h3>
                                                    Failed Programs
                                                </h3>

                                                <div className="bottleneck-list">

                                                    {
                                                        capacityResult
                                                            .failed
                                                            .map(
                                                                (
                                                                    failed,
                                                                    index
                                                                ) => (

                                                                    <div
                                                                        className="bottleneck-item"
                                                                        key={
                                                                            `${failed.programId}-${index}`
                                                                        }
                                                                    >

                                                                        <div>

                                                                            <strong>
                                                                                {
                                                                                    failed.programName
                                                                                }
                                                                            </strong>

                                                                            <span>
                                                                                Program ID:
                                                                                {" "}
                                                                                {
                                                                                    failed.programId
                                                                                }
                                                                            </span>

                                                                        </div>

                                                                        <div className="bottleneck-values">

                                                                            <span className="danger-text">
                                                                                {
                                                                                    failed.reason
                                                                                }
                                                                            </span>

                                                                        </div>

                                                                    </div>

                                                                )
                                                            )

                                                    }

                                                </div>

                                            </div>

                                        )
                                    }

                                </>

                            ) : (

                                <div className="subjects-empty">

                                    <div className="empty-icon">
                                        ⚡
                                    </div>

                                    <h3>
                                        No result
                                    </h3>

                                    <p>
                                        University capacity
                                        check did not return
                                        a result.
                                    </p>

                                </div>

                            )}

                        </div>

                        {/* FOOTER */}

                        <div className="modal-footer">

                            <button
                                type="button"
                                className="cancel-button"
                                disabled={
                                    capacityLoading
                                }
                                onClick={() =>
                                    setShowCapacityModal(
                                        false
                                    )
                                }
                            >
                                Close
                            </button>

                        </div>

                    </div>

                </div>

            )}

        </div>
    );
};

export default AllSubjects;