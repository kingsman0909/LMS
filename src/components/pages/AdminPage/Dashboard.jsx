import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    FiUsers,
    FiUserCheck,
    FiBookOpen,
    FiLayers,
    FiCalendar,
    FiAlertTriangle,
    FiCheckCircle,
    FiClock,
    FiHome,
    FiArrowRight,
    FiRefreshCw,
} from "react-icons/fi";

import "./styles/AdminDashboard.css";
import { API_BASE_URL } from "../../../config";

const AdminDashboard = (props) => {

    const navigate = useNavigate();
    const [schedules, setSchedules] = useState([]);
    const [sections, setSections] = useState([]);
    const [scheduleGenerated, setScheduleGenerated] = useState(false);

    const [dashboard, setDashboard] = useState({
        totalStudents: 0,
        totalProfessors: 0,
        totalPrograms: 0,
        totalSections: 0,

        pendingApplications: 0,
        approvedApplications: 0,
        rejectedApplications: 0,

        totalSubjects: 0,
        totalClasses: 0,

        roomsUsed: 0,
        totalRooms: 0,

        professorsUsed: 0,

        scheduleConflicts: 0,

        recentApplications: [],
        alerts: [],
    });

    const getSections = async () => {

        if (!props.term?.id) return;

        try {

            const token =
                localStorage.getItem(
                    "admin_token"
                );

            const response = await fetch(`${API_BASE_URL}/api/auth/admin/getScheduleSections?academicTermId=${props.term.id}`,
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


    const getSchedules = async () => {

        if (!props.term?.id) return;

        try {

            const token =
                localStorage.getItem(
                    "admin_token"
                );

            const response = await fetch(`${API_BASE_URL}/api/auth/admin/getSchedules?academicTermId=${props.term.id}`,
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

            if( data.schedules && data.schedules.length > 0){
                setScheduleGenerated(true);
            }

        } catch (error) {

            console.error(
                "Failed to fetch schedules:",
                error
            );
        }
    };

    const getTotalClasses = () => {
            let total = 0;
            sections.filter(section => {
                total += section.classes;
            })

            return total;
        }

    const totalSubject = () => {
            const map = new Map();
            for (const s of schedules){
                map.set(s.subject_id, s.capacity);
            }

            return map.size;
        }
  


    const pendingCount =
        sections.filter(
            section =>
                section.status ===
                "Scheduled"
        ).length;


    const [loading, setLoading] = useState(false);

    useEffect(() => {
        getSections();
        getSchedules();
    }, [props.term]);

    
    const {
        totalStudents,
        totalProfessors,
        totalPrograms,
        totalSections,

        pendingApplications,
        approvedApplications,
        rejectedApplications,

        roomsUsed,
        totalRooms,

        professorsUsed,

        scheduleConflicts,

        recentApplications,
        alerts,
    } = dashboard;


    const roomUtilization =
        totalRooms > 0
            ? Math.round((roomsUsed / totalRooms) * 100)
            : 0;

    const professorUtilization =
        totalProfessors > 0
            ? Math.round(
                (professorsUsed / totalProfessors) * 100
            )
            : 0;


    if (loading) {
        return (
            <div className="admin-dashboard-loading">

                <FiRefreshCw className="loading-icon" />

                <p>Loading dashboard...</p>

            </div>
        );
    }


    return (

        <div className="d-admin-dashboard">

            {/* =========================================
                HEADER
            ========================================= */}

            <div className="d-admin-dashboard-header">

                <div>

                    <p className="dashboard-eyebrow">
                        ADMINISTRATOR
                    </p>

                    <h1>
                        Good morning, Admin 👋
                    </h1>

                    <p className="dashboard-subtitle">
                        Here's what's happening in your LMS today.
                    </p>

                </div>


                <button
                    className="dashboard-refresh-btn"
                >
                    <FiRefreshCw />

                    Refresh
                </button>

            </div>


            {/* =========================================
                ACADEMIC TERM
            ========================================= */}

            <div className="academic-term-card">

                <div className="academic-term-icon">
                    <FiCalendar />
                </div>

                <div className="academic-term-info">

                    <span>
                        CURRENT ACADEMIC TERM
                    </span>

                    <h2>
                        1st Semester
                    </h2>

                    <p>
                        Academic Year 2026–2027
                    </p>

                </div>


                <div className="academic-term-date">

                    <span>
                        June 22, 2026
                    </span>

                    <FiArrowRight />

                    <span>
                        October 2, 2026
                    </span>

                </div>

            </div>


            {/* =========================================
                STAT CARDS
            ========================================= */}

            <div className="dashboard-stats">

                <div className="stat-card">

                    <div className="stat-card-top">

                        <div className="stat-icon">
                            <FiUsers />
                        </div>

                    </div>

                    <div className="stat-value">
                        {totalStudents.toLocaleString()}
                    </div>

                    <div className="stat-label">
                        Total Students
                    </div>

                </div>


                <div className="stat-card">

                    <div className="stat-card-top">

                        <div className="stat-icon">
                            <FiUserCheck />
                        </div>

                    </div>

                    <div className="stat-value">
                        {totalProfessors.toLocaleString()}
                    </div>

                    <div className="stat-label">
                        Professors
                    </div>

                </div>


                <div className="stat-card">

                    <div className="stat-card-top">

                        <div className="stat-icon">
                            <FiBookOpen />
                        </div>

                    </div>

                    <div className="stat-value">
                        {totalPrograms}
                    </div>

                    <div className="stat-label">
                        Programs
                    </div>

                </div>


                <div className="stat-card">

                    <div className="stat-card-top">

                        <div className="stat-icon">
                            <FiLayers />
                        </div>

                    </div>

                    <div className="stat-value">
                        {totalSections}
                    </div>

                    <div className="stat-label">
                        Active Sections
                    </div>

                </div>

            </div>


            {/* =========================================
                MAIN GRID
            ========================================= */}

            <div className="dashboard-main-grid">


                {/* =====================================
                    ENROLLMENT
                ===================================== */}

                <div className="dashboard-card enrollment-card">

                    <div className="dashboard-card-header">

                        <div>

                            <h2>
                                Enrollment Overview
                            </h2>

                            <p>
                                Current student application status
                            </p>

                        </div>

                        <FiUsers />

                    </div>


                    <div className="enrollment-content">

                        <div className="enrollment-stat">

                            <span className="enrollment-number">
                                {approvedApplications}
                            </span>

                            <span>
                                Approved
                            </span>

                        </div>


                        <div className="enrollment-stat">

                            <span className="enrollment-number">
                                {pendingApplications}
                            </span>

                            <span>
                                Pending
                            </span>

                        </div>


                        <div className="enrollment-stat">

                            <span className="enrollment-number">
                                {rejectedApplications}
                            </span>

                            <span>
                                Rejected
                            </span>

                        </div>

                    </div>


                    <div className="enrollment-bar">

                        <div
                            className="enrollment-approved"
                            style={{
                                width:
                                    approvedApplications > 0
                                        ? "70%"
                                        : "0%",
                            }}
                        />

                    </div>


                    <button className="dashboard-link-btn">
                        View Applications

                        <FiArrowRight />

                    </button>

                </div>


                {/* =====================================
                    SCHEDULE STATUS
                ===================================== */}

                <div className="dashboard-card schedule-card">

                    <div className="dashboard-card-header">

                        <div>

                            <h2>
                                Schedule Status
                            </h2>

                            <p>
                                Current scheduling overview
                            </p>

                        </div>

                        <FiCalendar />

                    </div>


                    <div className="schedule-status">

                        <div
                            className={
                                scheduleGenerated
                                    ? "status-icon success"
                                    : "status-icon warning"
                            }
                        >
                            
                            {scheduleGenerated
                                ? <FiCheckCircle />
                                : <FiClock />
                            }

                        </div>


                        <div>

                            <h3>

                                {scheduleGenerated
                                    ? "Schedule Generated"
                                    : "Schedule Not Generated"
                                }

                            </h3>

                            <p>

                                {scheduleGenerated
                                    ? "The current academic term has an active schedule."
                                    : "Sections are waiting for schedule generation."
                                }

                            </p>

                        </div>

                    </div>


                    <div className="schedule-details">

                        <div>

                            <span>
                                Sections
                            </span>

                            <strong>
                                {pendingCount}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Subjects
                            </span>

                            <strong>
                                {totalSubject()}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Classes
                            </span>

                            <strong>
                                {getTotalClasses()}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Conflicts
                            </span>

                            <strong
                                className={
                                    scheduleConflicts > 0
                                        ? "danger-text"
                                        : "success-text"
                                }
                            >
                                {scheduleConflicts}
                            </strong>

                        </div>

                    </div>


                    <button className="dashboard-primary-btn" onClick={()=>{props.handlePage(6)}}>

                        {scheduleGenerated
                            ? "View Schedule"
                            : "Generate Schedule"
                        }

                    </button>

                </div>


                {/* =====================================
                    RESOURCE UTILIZATION
                ===================================== */}

                <div className="dashboard-card resource-card">

                    <div className="dashboard-card-header">

                        <div>

                            <h2>
                                Resource Utilization
                            </h2>

                            <p>
                                Current scheduling resources
                            </p>

                        </div>

                        <FiHome />

                    </div>


                    <div className="resource-item">

                        <div className="resource-label">

                            <span>
                                Rooms
                            </span>

                            <strong>
                                {roomUtilization}%
                            </strong>

                        </div>

                        <div className="resource-progress">

                            <div
                                style={{
                                    width: `${roomUtilization}%`,
                                }}
                            />

                        </div>

                    </div>


                    <div className="resource-item">

                        <div className="resource-label">

                            <span>
                                Professors
                            </span>

                            <strong>
                                {professorUtilization}%
                            </strong>

                        </div>

                        <div className="resource-progress">

                            <div
                                style={{
                                    width: `${professorUtilization}%`,
                                }}
                            />

                        </div>

                    </div>


                    <div className="resource-item">

                        <div className="resource-label">

                            <span>
                                Time Slots
                            </span>

                            <strong>
                                89%
                            </strong>

                        </div>

                        <div className="resource-progress">

                            <div
                                style={{
                                    width: "89%",
                                }}
                            />

                        </div>

                    </div>

                </div>


                {/* =====================================
                    ALERTS
                ===================================== */}

                <div className="dashboard-card alerts-card">

                    <div className="dashboard-card-header">

                        <div>

                            <h2>
                                System Alerts
                            </h2>

                            <p>
                                Items that may need your attention
                            </p>

                        </div>

                        <FiAlertTriangle />

                    </div>


                    <div className="alerts-list">

                        {alerts?.length > 0 ? (

                            alerts.map((alert, index) => (

                                <div
                                    className="alert-item"
                                    key={index}
                                >

                                    <div className="alert-icon">
                                        <FiAlertTriangle />
                                    </div>

                                    <span>
                                        {alert.message}
                                    </span>

                                </div>

                            ))

                        ) : (

                            <div className="no-alerts">

                                <FiCheckCircle />

                                <span>
                                    No alerts. Everything looks good!
                                </span>

                            </div>

                        )}

                    </div>

                </div>

            </div>


            {/* =========================================
                RECENT APPLICATIONS
            ========================================= */}

            <div className="dashboard-card recent-applications">

                <div className="dashboard-card-header">

                    <div>

                        <h2>
                            Recent Applications
                        </h2>

                        <p>
                            Latest student applications
                        </p>

                    </div>


                    <button className="dashboard-link-btn">

                        View All

                        <FiArrowRight />

                    </button>

                </div>


                <div className="applications-table">

                    <div className="table-header">

                        <span>
                            Student
                        </span>

                        <span>
                            Program
                        </span>

                        <span>
                            Status
                        </span>

                        <span>
                            Date
                        </span>

                    </div>


                    {recentApplications?.length > 0 ? (

                        recentApplications.map(
                            (application, index) => (

                                <div
                                    className="table-row"
                                    key={index}
                                >

                                    <span className="student-name">
                                        {application.name}
                                    </span>

                                    <span>
                                        {application.program}
                                    </span>

                                    <span>

                                        <span
                                            className={`application-status ${application.status?.toLowerCase()}`}
                                        >
                                            {application.status}
                                        </span>

                                    </span>

                                    <span>
                                        {application.date}
                                    </span>

                                </div>

                            )

                        )

                    ) : (

                        <div className="empty-table">

                            No recent applications.

                        </div>

                    )}

                </div>

            </div>

        </div>

    );
};

export default AdminDashboard;