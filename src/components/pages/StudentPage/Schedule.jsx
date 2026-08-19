import React, { useEffect, useState } from "react";
import "../../../styles/StudentPage.css";
import {
    FiMapPin,
    FiUser
} from "react-icons/fi";

const Schedule = (props) => {

    const [schedule, setSchedule] = useState([]);

    const days = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday"
    ];

    const timeSlots = [
        "7:00am - 8:00am",
        "8:00am - 9:00am",
        "9:00am - 10:00am",
        "10:00am - 11:00am",
        "11:00am - 12:00pm",
        "12:00pm - 1:00pm",
        "1:00pm - 2:00pm",
        "2:00pm - 3:00pm",
        "3:00pm - 4:00pm",
        "4:00pm - 5:00pm",
        "5:00pm - 6:00pm",
        "6:00pm - 7:00pm",
    ];


    // ==========================================
    // Convert "7:00am" → "07:00"
    // ==========================================

    const convertTo24Hour = (time) => {

        const match = time
            .toLowerCase()
            .match(/(\d+):(\d+)(am|pm)/);

        if (!match) return null;

        let hours = parseInt(match[1]);
        const minutes = match[2];
        const modifier = match[3];

        if (modifier === "pm" && hours !== 12) {
            hours += 12;
        }

        if (modifier === "am" && hours === 12) {
            hours = 0;
        }

        return `${String(hours).padStart(2, "0")}:${minutes}`;
    };


    // ==========================================
    // Get schedules from backend
    // ==========================================

    const getSchedule = async () => {

        if (!props.academicTerm?.id) return;

        if (!props.user?.profile?.section_id) return;

        try {

            const token = localStorage.getItem(
                `${props.user.role}_token`
            );

            if (!token) {
                console.error("No authentication token found.");
                return;
            }

            const params = new URLSearchParams({
                academicTermId: props.academicTerm.id,
                sectionId: props.user.profile.section_id
            });

            const response = await fetch(
                `http://localhost:3000/api/auth/student/getSchedule?${params}`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            console.log("Schedules:", data);

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to fetch schedules"
                );
            }

            setSchedule(
                data.schedules || []
            );

        } catch (error) {

            console.error(
                "Failed to fetch schedules:",
                error
            );

        }

    };


    // ==========================================
    // Fetch when academic term / section changes
    // ==========================================

    useEffect(() => {

        getSchedule();

    }, [
        props.academicTerm?.id,
        props.user?.profile?.section_id
    ]);


    return (

        <div className="schedule-page">

            {/* ==========================================
                HEADER
            ========================================== */}

            <div className="page-header">

                <div>

                    <h1>
                        My Schedule
                    </h1>

                    <p>
                        {props.user?.profile?.program_code || "BSCS"}
                        {" • "}
                        {props.user?.profile?.year_level
                            ? `${props.user.profile.year_level}${props.user.profile.year_level === 1 ? "st" : props.user.profile.year_level === 2 ? "nd" : props.user.profile.year_level === 3 ? "rd" : "th"} Year`
                            : "1st Year"}
                        {" • Section "}
                        {props.user?.profile?.section_name || "A"}
                    </p>

                </div>


                <div className="term-info">

                    <strong>
                        {props.academicTerm?.semester || "1st Semester"}
                    </strong>

                    <span>
                        {props.academicTerm?.academic_year ||
                            "Academic Year 2026–2027"}
                    </span>

                </div>

            </div>


            {/* ==========================================
                SCHEDULE TABLE
            ========================================== */}

            <div className="schedule-table-wrapper">

                <div className="schedule-table">


                    {/* ==========================================
                        TABLE HEADER
                    ========================================== */}

                    <div className="s-schedule-header time-column">
                        Time
                    </div>


                    {days.map(day => (

                        <div
                            key={day}
                            className="s-schedule-header"
                        >
                            {day}
                        </div>

                    ))}


                    {/* ==========================================
                        TIME ROWS
                    ========================================== */}

                    {timeSlots.map(time => (

                        <React.Fragment key={time}>


                            {/* TIME */}

                            <div className="schedule-time-cell">

                                {time}

                            </div>


                            {/* DAYS */}

                            {days.map(day => {


                                /*
                                 * Get the beginning of the
                                 * current timetable slot.
                                 *
                                 * Example:
                                 *
                                 * "7:00am - 8:00am"
                                 *
                                 * becomes:
                                 *
                                 * "07:00"
                                 */

                                const startTime =
                                    convertTo24Hour(
                                        time.split(" - ")[0]
                                    );


                                /*
                                 * Find schedule matching:
                                 *
                                 * day
                                 * +
                                 * start_time
                                 */

                                const classItem =
                                    schedule.find(
                                        item =>
                                            item.day
                                                ?.toLowerCase() === day &&
                                            item.start_time
                                                ?.slice(0, 5) === startTime
                                    );


                                return (

                                    <div
                                        key={`${day}-${time}`}
                                        className="schedule-cell"
                                    >

                                        {classItem && (

                                            <div className="class-block">


                                                {/* ROOM TYPE */}

                                                <span className="class-type" style={
                                                    classItem.room_type === "laboratory" ? {color: 'blue'} : {color: 'green'}
                                                 }>

                                                    {classItem.room_type === "laboratory"
                                                        ? "Laboratory"
                                                        : "Lecture"}

                                                </span>


                                                {/* SUBJECT CODE */}

                                                <strong>

                                                    {classItem.subject_code}

                                                </strong>


                                                {/* SUBJECT NAME */}

                                                <h3>

                                                    {classItem.subject_name}

                                                </h3>


                                                {/* PROFESSOR */}

                                                <div>

                                                    <FiUser />

                                                    <span>
                                                        {classItem.professor_name}
                                                    </span>

                                                </div>


                                                {/* ROOM */}

                                                <div>

                                                    <FiMapPin />

                                                    <span>
                                                        {classItem.room_name}
                                                    </span>

                                                </div>

                                            </div>

                                        )}

                                    </div>

                                );

                            })}

                        </React.Fragment>

                    ))}

                </div>

            </div>

        </div>

    );

};

export default Schedule;