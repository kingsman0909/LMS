
import React, { useEffect, useState } from "react";
import "./styles/Schedule.css";

const AdminSchedule = () => {

    // =========================
    // BASIC STATES
    // =========================

    const [search, setSearch] = useState("");
    const [yearFilter, setYearFilter] = useState("all");

    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [selectedSection, setSelectedSection] = useState(null);
    const [term, setTerm] = useState(null);
    const [programs, setPrograms] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [sections, setSections] = useState([]);
    const [students, setStudents] = useState([]);
    const [totalStudents, setTotalStudents] = useState(0);
    // =========================
    // GENERATE MODAL
    // =========================

    const [showGenerateModal, setShowGenerateModal] =
        useState(false);

    const [selectedProgram, setSelectedProgram] =
        useState("");

    const [selectedAcademicTerm, setSelectedAcademicTerm] =
        useState("");


    // =========================
    // FETCH CURRENT ACADEMIC TERM
    // =========================

    const fetchTerm = async () => {

        try {

            const token =
                localStorage.getItem("admin_token");

            const response = await fetch(
                "http://localhost:3000/api/auth/getAcademicTerm",
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

            console.log(
                "Academic Term:",
                data
            );

            if (!response.ok) {
                throw new Error(
                    data.message
                );
            }

            setTerm(data.term);

        } catch (error) {

            console.error(
                "Failed to fetch academic term:",
                error
            );
        }
    };

    const fetchTotalStudents = async () => {
    try {
        const token =
                localStorage.getItem("admin_token");

        const response = await fetch(
            "http://localhost:3000/api/auth/admin/getTotalStudents",
            {
                method: "GET",
                credentials: "include",
                headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                
            }
        );

        if (!response.ok) {
            throw new Error("Failed to fetch total students");
        }

        const data = await response.json();
        console.log("total student: ", data);
        setTotalStudents(data.totalStudents);
    } catch (error) {
        console.error("Error fetching total students:", error);
        return 0;
    }
};

    // =========================
    // GET PROGRAMS WITH SECTIONS
    // =========================

    const getPrograms = async () => {

        if (!term?.id) return;

        try {

            const token =
                localStorage.getItem(
                    "admin_token"
                );

            const response = await fetch(
                `http://localhost:3000/api/auth/admin/getProgramsWithSections?academicTermId=${term.id}`,
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

            console.log(
                "Programs:",
                data
            );

            if (!response.ok) {
                throw new Error(
                    data.message
                );
            }

            setPrograms(
                data.programs || []
            );

        } catch (error) {

            console.error(
                "Failed to fetch programs:",
                error
            );
        }
    };


    // =========================
    // GET SECTIONS
    // =========================

    const getSections = async () => {

        if (!term?.id) return;

        try {

            const token =
                localStorage.getItem(
                    "admin_token"
                );

            const response = await fetch(
                `http://localhost:3000/api/auth/admin/getScheduleSections?academicTermId=${term.id}`,
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

            console.log(
                "Schedule Sections:",
                data
            );

            if (!response.ok) {
                throw new Error(
                    data.message
                );
            }

            setSections(
                data.sections || []
            );

        } catch (error) {

            console.error(
                "Failed to fetch sections:",
                error
            );
        }
    };


    // =========================
    // GET SCHEDULES
    // =========================

    const getSchedules = async () => {

        if (!term?.id) return;

        try {

            const token =
                localStorage.getItem(
                    "admin_token"
                );

            const response = await fetch(
                `http://localhost:3000/api/auth/admin/getSchedules?academicTermId=${term.id}`,
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

            console.log(
                "Schedules:",
                data
            );

            if (!response.ok) {
                throw new Error(
                    data.message
                );
            }

            setSchedules(
                data.schedules || []
            );

        } catch (error) {

            console.error(
                "Failed to fetch schedules:",
                error
            );
        }
    };

    const fetchStudents = async () => {

        try {

            const token = localStorage.getItem("admin_token");

            if(!token){
                return <p>No token</p>
            }
            const response = await fetch(
                "http://localhost:3000/api/auth/admin/getStudents",
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (response.ok) {
                setStudents(data.students);
            }

        } catch (error) {
            console.error(error);
        }

    };

    // =========================
    // INITIAL FETCH
    // =========================

    useEffect(() => {

        fetchTerm();
        fetchStudents();
        fetchTotalStudents();

    }, []);

    // =========================
    // FETCH AFTER TERM IS READY
    // =========================

    useEffect(() => {

        if (!term?.id) return;

        getPrograms();
        getSections();
        getSchedules();

    }, [term]);


    // =========================
    // FILTER SECTIONS
    // =========================

    const filteredSections =
        sections.filter(section => {

            const sectionText =
                `${section.program || ""} ${section.year}-${section.section}`;

            const matchesSearch =
                sectionText
                    .toLowerCase()
                    .includes(
                        search.toLowerCase()
                    );

            const matchesYear =
                yearFilter === "all" ||
                section.year.toString()
                    === yearFilter;

            return (
                matchesSearch &&
                matchesYear
            );
        });

    

    // =========================
    // STATISTICS
    // =========================

    const scheduledCount =
        sections.filter(
            section =>
                section.status ===
                "Scheduled"
        ).length;


    const pendingCount =
        sections.filter(
            section =>
                section.status ===
                "Pending"
        ).length;



    // =========================
    // GENERATE SCHEDULE
    // =========================

    const handleGenerateSchedule =
        async () => {

            if (
                !selectedProgram ||
                !selectedAcademicTerm
            ) {

                alert(
                    "Please select a program and academic term."
                );

                return;
            }


            try {

                const token =
                    localStorage.getItem(
                        "admin_token"
                    );


                console.log(
                    "Generating schedule:",
                    {
                        programId:
                            selectedProgram,

                        academicTermId:
                            selectedAcademicTerm
                    }
                );


                const response =
                    await fetch(
                        "http://localhost:3000/api/auth/admin/schedule/generate",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",

                                Authorization:
                                    `Bearer ${token}`
                            },

                            body: JSON.stringify({

                                programId:
                                    Number(
                                        selectedProgram
                                    ),

                                academicTermId:
                                    Number(
                                        selectedAcademicTerm
                                    )

                            })
                        }
                    );


                const data =
                    await response.json();


                console.log(
                    "Generate Schedule Response:",
                    data
                );


                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        "Failed to generate schedule."
                    );
                }


                alert(
                    data.message ||
                    "Schedule generated successfully."
                );


                setShowGenerateModal(
                    false
                );


                // Refresh database data
                await getSections();
                await getSchedules();


            } catch (error) {

                console.error(
                    "Generate schedule error:",
                    error
                );

                alert(
                    error.message ||
                    "Something went wrong while generating schedule."
                );
            }
        };


    // =========================
    // VIEW SECTION SCHEDULE
    // =========================
const viewSchedule = (section) => {

    const sectionSchedules = schedules.filter(
        schedule =>
            Number(schedule.section_id) ===
            Number(section.id)
    );

    console.log("Section:", section);
    console.log("Section schedules:", sectionSchedules);

    if (sectionSchedules.length === 0) {
        alert(
            `No schedule found for ${section.program} ${section.year}-${section.section}`
        );
        return;
    }

    setSelectedSection({
        ...section,
        schedules: sectionSchedules
    });

    setShowScheduleModal(true);
};

const closeScheduleModal = () => {
    setShowScheduleModal(false);
    setSelectedSection(null);
};

    // =========================
    // YEAR LABEL
    // =========================

    const getYearLabel =
        (year) => {

            switch (
                Number(year)
            ) {

                case 1:
                    return "1st Year";

                case 2:
                    return "2nd Year";

                case 3:
                    return "3rd Year";

                case 4:
                    return "4th Year";

                default:
                    return `${year} Year`;
            }
        };


    // =========================
    // RENDER
    // =========================

    return (

        <div className="schedule-page">

            {/* ================= HEADER ================= */}

            <div className="schedule-header">

                <div>

                    <h1>
                        Schedule Management
                    </h1>

                    <p>
                        Manage and generate class schedules
                        for the academic term.
                    </p>

                </div>


                <div className="schedule-actions">

                    <button
                        className="generate-btn"
                        onClick={() =>
                            setShowGenerateModal(
                                true
                            )
                        }
                    >
                        Generate Schedule
                    </button>

                </div>

            </div>


            {/* ================= STATISTICS ================= */}

            <div className="schedule-stats">

                <div className="stat-card">

                    <div className="stat-label">
                        Total Sections
                    </div>

                    <div className="stat-value">
                        {sections.length}
                    </div>

                </div>


                <div className="stat-card">

                    <div className="stat-label">
                        Total Students
                    </div>

                    <div className="stat-value">
                        {totalStudents}
                    </div>

                </div>


                <div className="stat-card">

                    <div className="stat-label">
                        Scheduled
                    </div>

                    <div className="stat-value scheduled-number">
                        {scheduledCount}
                    </div>

                </div>


                <div className="stat-card">

                    <div className="stat-label">
                        Pending
                    </div>

                    <div className="stat-value pending-number">
                        {pendingCount}
                    </div>

                </div>

            </div>


            {/* ================= SECTIONS ================= */}

            <div className="section-container">

                <div className="a-section-header">

                    <div>

                        <h2>
                            Sections
                        </h2>

                        <p>
                            View the scheduling status
                            of each section.
                        </p>

                    </div>


                    <div className="section-filters">

                        <input
                            type="text"
                            placeholder="Search section..."
                            value={search}
                            onChange={(e) =>
                                setSearch(
                                    e.target.value
                                )
                            }
                        />


                        <select
                            value={yearFilter}
                            onChange={(e) =>
                                setYearFilter(
                                    e.target.value
                                )
                            }
                        >

                            <option value="all">
                                All Years
                            </option>

                            <option value="1">
                                1st Year
                            </option>

                            <option value="2">
                                2nd Year
                            </option>

                            <option value="3">
                                3rd Year
                            </option>

                            <option value="4">
                                4th Year
                            </option>

                        </select>

                    </div>

                </div>


                {/* ================= TABLE ================= */}

                <div className="table-wrapper">

                    <table>

                        <thead>

                            <tr>

                                <th>
                                    Section
                                </th>

                                <th>
                                    Year Level
                                </th>

                                <th>
                                    Students
                                </th>

                                <th>
                                    Classes
                                </th>

                                <th>
                                    Status
                                </th>

                                <th>
                                    Action
                                </th>

                            </tr>

                        </thead>


                        <tbody>

                            {filteredSections.length >
                            0 ? (

                                filteredSections.map(
                                    section => (

                                        <tr
                                            key={
                                                section.id
                                            }
                                        >

                                            <td>

                                                <div className="section-name">

                                                    <strong>
                                                        {section.program}
                                                    </strong>

                                                    <span>
                                                        {
                                                            section.year
                                                        }
                                                        -
                                                        {
                                                            section.section
                                                        }
                                                    </span>

                                                </div>

                                            </td>


                                            <td>
                                                {
                                                    getYearLabel(
                                                        section.year
                                                    )
                                                }
                                            </td>


                                            <td>

                                                <div className="student-count">

                                                    <span>
                                                        {
                                                            section.students ||
                                                            0
                                                        }
                                                    </span>

                                                    <small>
                                                        /
                                                        {
                                                            section.maxStudents
                                                        }
                                                    </small>

                                                </div>

                                            </td>


                                            <td>

                                                {
                                                    section.classes ||
                                                    0
                                                }

                                            </td>


                                            <td>

                                                <span
                                                    className={
                                                        section.status ===
                                                        "Scheduled"
                                                            ? "status scheduled"
                                                            : "status pending"
                                                    }
                                                >

                                                    <span className="status-dot">
                                                    </span>

                                                    {
                                                        section.status ||
                                                        "Pending"
                                                    }

                                                </span>

                                            </td>


                                            <td>

                                                <button
                                                    className="view-btn"
                                                    onClick={() =>
                                                        viewSchedule(
                                                            section
                                                        )
                                                    }
                                                >
                                                    View Schedule
                                                </button>

                                            </td>

                                        </tr>

                                    )
                                )

                            ) : (

                                <tr>

                                    <td
                                        colSpan="6"
                                        className="empty-state"
                                    >
                                        No sections found.
                                    </td>

                                </tr>

                            )}

                        </tbody>

                    </table>

                </div>

            </div>


            {/* ================= GENERATE MODAL ================= */}

            {showGenerateModal && (

                <div className="modal-overlay">

                    <div className="generate-modal">

                        <div className="modal-header">

                            <div>

                                <h2>
                                    Generate Schedule
                                </h2>

                                <p>
                                    Select the program and
                                    academic term.
                                </p>

                            </div>


                            <button
                                className="modal-close"
                                onClick={() =>
                                    setShowGenerateModal(
                                        false
                                    )
                                }
                            >
                                ×
                            </button>

                        </div>


                        <div className="modal-body">

                            {/* PROGRAM */}

                            <div className="form-group">

                                <label>
                                    Program
                                </label>

                                <select
                                    value={
                                        selectedProgram
                                    }
                                    onChange={(e) =>
                                        setSelectedProgram(
                                            e.target.value
                                        )
                                    }
                                >

                                    <option value="">
                                        Select Program
                                    </option>


                                    {programs.map(
                                        program => (

                                            <option
                                                key={
                                                    program.id
                                                }
                                                value={
                                                    program.id
                                                }
                                            >
                                                {
                                                    program.program_code
                                                }
                                                {" — "}
                                                {
                                                    program.program_name
                                                }
                                            </option>

                                        )
                                    )}

                                </select>

                            </div>


                            {/* ACADEMIC TERM */}

                            <div className="form-group">

                                <label>
                                    Academic Term
                                </label>

                                <select
                                    value={
                                        selectedAcademicTerm
                                    }
                                    onChange={(e) =>
                                        setSelectedAcademicTerm(
                                            e.target.value
                                        )
                                    }
                                >

                                    <option value="">
                                        Select Academic Term
                                    </option>


                                    {term && (

                                        <option
                                            value={
                                                term.id
                                            }
                                        >
                                            {
                                                term.school_year
                                            }
                                            {" — "}
                                            {
                                                term.semester
                                            }
                                        </option>

                                    )}

                                </select>

                            </div>

                        </div>


                        <div className="modal-footer">

                            <button
                                className="cancel-btn"
                                onClick={() =>
                                    setShowGenerateModal(
                                        false
                                    )
                                }
                            >
                                Cancel
                            </button>


                            <button
                                className="generate-btn"
                                onClick={
                                    handleGenerateSchedule
                                }
                            >
                                Generate Schedule
                            </button>

                        </div>

                    </div>

                </div>

            )}

            {showScheduleModal && selectedSection && (
    <div className="schedule-modal-overlay">

        <div className="schedule-modal">

            {/* HEADER */}
            <div className="schedule-modal-header">

                <div>
                    <h2>
                        {selectedSection.program}{" "}
                        {selectedSection.year}-
                        {selectedSection.section}
                    </h2>

                    <p>
                        Class Schedule
                    </p>
                </div>

                <button
                    className="schedule-modal-close"
                    onClick={closeScheduleModal}
                >
                    ×
                </button>

            </div>


            {/* BODY */}
                <div className="schedule-modal-body">

                    {selectedSection.schedules.map(
                        (schedule) => (

                            <div
                                className="schedule-card"
                                key={schedule.id}
                            >

                                <div className="schedule-card-header">

                                    <div>
                                        <strong>
                                            {schedule.subject_code}
                                        </strong>

                                        <span>
                                            {" - "}
                                            {schedule.subject_name}
                                        </span>
                                    </div>

                                    <span
                                        className={
                                            schedule.room_type ===
                                            "laboratory"
                                                ? "schedule-type lab"
                                                : "schedule-type lecture"
                                        }
                                    >
                                        {schedule.room_type.toUpperCase()}
                                    </span>

                                </div>


                                <div className="schedule-card-details">

                                    <div>
                                        <span className="detail-label">
                                            Day
                                        </span>

                                        <span>
                                            {schedule.day}
                                        </span>
                                    </div>


                                    <div>
                                        <span className="detail-label">
                                            Time
                                        </span>

                                        <span>
                                            {schedule.start_time.slice(0, 5)}
                                            {" - "}
                                            {schedule.end_time.slice(0, 5)}
                                        </span>
                                    </div>


                                    <div>
                                        <span className="detail-label">
                                            Room
                                        </span>

                                        <span>
                                            {schedule.room_name}
                                        </span>
                                    </div>


                                    <div>
                                        <span className="detail-label">
                                            Professor
                                        </span>

                                        <span>
                                            {schedule.professor_name}
                                        </span>
                                    </div>

                                </div>

                            </div>

                        )
                    )}

                </div>


                {/* FOOTER */}
                <div className="schedule-modal-footer">

                    <span>
                        {selectedSection.schedules.length} schedule entries
                    </span>

                    <button
                        onClick={closeScheduleModal}
                        className="schedule-modal-done"
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

export default AdminSchedule;
