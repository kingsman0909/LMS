import React, { useEffect, useState } from "react";
import "../../../styles/StudentPage.css";
import { API_BASE_URL } from "../../../config";

import {
    FiMapPin,
    FiUser
} from "react-icons/fi";


const Schedule = (props) => {

    const [schedule, setSchedule] = useState([]);


    // =========================================================
    // DAYS
    // =========================================================

    const days = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday"
    ];


    // =========================================================
    // TIME SLOTS
    // 1 ROW = 1 HOUR
    // =========================================================

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
        "7:00pm - 8:00pm",
        "8:00pm - 9:00pm",
        "9:00pm - 10:00pm"
    ];


    // =========================================================
    // CONVERT TIME
    // "7:00am" -> "07:00"
    // =========================================================

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


    // =========================================================
    // TIME TO MINUTES
    // =========================================================

    const timeToMinutes = (time) => {

        if (!time) return null;

        const cleanTime = time
            .toLowerCase()
            .trim()
            .replace(/\s/g, "");


        const match = cleanTime.match(
            /(\d+):(\d+)(am|pm)/
        );

        if (match) {

            let hours = parseInt(match[1]);

            const minutes = parseInt(match[2]);

            const modifier = match[3];


            if (modifier === "pm" && hours !== 12) {
                hours += 12;
            }


            if (modifier === "am" && hours === 12) {
                hours = 0;
            }


            return hours * 60 + minutes;
        }


        // Handles backend format such as 07:00
        const twentyFourHour =
            cleanTime.match(
                /^(\d{1,2}):(\d{2})/
            );


        if (twentyFourHour) {

            const hours =
                parseInt(twentyFourHour[1]);

            const minutes =
                parseInt(twentyFourHour[2]);

            return hours * 60 + minutes;
        }


        return null;
    };


    // =========================================================
    // GET START ROW
    //
    // Grid:
    //
    // Header = row 1
    // 7 AM    = row 2
    // 8 AM    = row 3
    // 9 AM    = row 4
    // etc.
    // =========================================================

    const getStartRow = (startTime) => {

        const minutes =
            timeToMinutes(startTime);

        if (minutes === null) {
            return null;
        }


        const firstTime =
            timeToMinutes("7:00am");


        return (
            Math.floor(
                (minutes - firstTime) / 60
            ) + 2
        );
    };


    // =========================================================
    // GET HOW MANY ROWS THE CLASS SHOULD OCCUPY
    //
    // 7-8   = 1 row
    // 7-9   = 2 rows
    // 7-10  = 3 rows
    // =========================================================

    const getRowSpan = (
        startTime,
        endTime
    ) => {

        const start =
            timeToMinutes(startTime);

        const end =
            timeToMinutes(endTime);


        if (
            start === null ||
            end === null ||
            end <= start
        ) {
            return 1;
        }


        return Math.max(
            1,
            Math.ceil(
                (end - start) / 60
            )
        );
    };


    // =========================================================
    // MERGE CONTIGUOUS SCHEDULE RECORDS
    //
    // The backend may return one record per hour:
    // 7-8, 8-9, 9-10
    //
    // This converts those into ONE block:
    // 7-10
    //
    // Only contiguous records are merged, so:
    // 7-8 + 10-11 stays as TWO separate classes.
    // =========================================================

    const mergeScheduleBlocks = (items) => {

        const grouped = {};

        items.forEach(item => {

            const key = [
                item.day?.toLowerCase(),
                item.subject_code,
                item.subject_name,
                item.professor_name,
                item.room_name
            ].join("|");


            if (!grouped[key]) {
                grouped[key] = [];
            }


            grouped[key].push(item);

        });


        const merged = [];


        Object.values(grouped).forEach(group => {

            group.sort(
                (a, b) =>
                    timeToMinutes(a.start_time) -
                    timeToMinutes(b.start_time)
            );


            let current = null;


            group.forEach(item => {

                if (!current) {

                    current = {
                        ...item
                    };

                    return;
                }


                const currentEnd =
                    timeToMinutes(
                        current.end_time
                    );


                const itemStart =
                    timeToMinutes(
                        item.start_time
                    );


                // Merge only when the next record starts
                // exactly when the current record ends.
                if (
                    currentEnd !== null &&
                    itemStart !== null &&
                    currentEnd === itemStart
                ) {

                    const itemEnd =
                        timeToMinutes(
                            item.end_time
                        );


                    // Keep the latest ending time.
                    if (
                        itemEnd !== null &&
                        (
                            timeToMinutes(current.end_time) === null ||
                            itemEnd >
                                timeToMinutes(current.end_time)
                        )
                    ) {
                        current.end_time =
                            item.end_time;
                    }

                } else {

                    merged.push(current);

                    current = {
                        ...item
                    };

                }

            });


            if (current) {
                merged.push(current);
            }

        });


        return merged;
    };


    // =========================================================
    // FIND SCHEDULES
    // =========================================================

    const getSchedulesForDay = (day) => {

        return schedule.filter(
            item =>
                item.day?.toLowerCase() === day
        );
    };


    // =========================================================
    // GET SCHEDULE AT START TIME
    // =========================================================

    const getScheduleAtTime = (
        day,
        time
    ) => {

        const startTime =
            convertTo24Hour(
                time.split(" - ")[0]
            );


        return schedule.find(
            item =>
                item.day?.toLowerCase() === day &&
                item.start_time?.slice(0, 5) === startTime
        );
    };


    // =========================================================
    // FETCH SCHEDULE
    // =========================================================

    const getSchedule = async () => {

        if (!props.academicTerm?.id) {
            return;
        }


        if (!props.user?.profile?.section_id) {
            return;
        }


        try {

            const token =
                localStorage.getItem(
                    `${props.user.role}_token`
                );


            if (!token) {

                console.error(
                    "No authentication token found."
                );

                return;
            }


            const params =
                new URLSearchParams({
                    academicTermId:
                        props.academicTerm.id,

                    sectionId:
                        props.user.profile.section_id
                });


            const response =
                await fetch(
                    `${API_BASE_URL}/api/auth/student/getSchedule?${params}`,
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
                    data.message ||
                    "Failed to fetch schedules"
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


    // =========================================================
    // FETCH WHEN TERM / SECTION CHANGES
    // =========================================================

    useEffect(() => {

        getSchedule();

    }, [
        props.academicTerm?.id,
        props.user?.profile?.section_id
    ]);


    // =========================================================
    // MERGED SCHEDULE
    //
    // Render the merged list so a 7-10 class becomes ONE
    // 3-hour grid block instead of three separate blocks.
    // =========================================================

    const mergedSchedule =
        mergeScheduleBlocks(schedule);


    // =========================================================
    // RENDER
    // =========================================================

    return (

        <div className="schedule-page">


            {/* =================================================
                HEADER
            ================================================= */}

            <div className="page-header">

                <div>

                    <h1>
                        My Schedule
                    </h1>


                    <p>

                        {props.user?.profile?.program_code ||
                            "BSCS"}

                        {" • "}

                        {props.user?.profile?.year_level
                            ? `${props.user.profile.year_level}${
                                props.user.profile.year_level === 1
                                    ? "st"
                                    : props.user.profile.year_level === 2
                                        ? "nd"
                                        : props.user.profile.year_level === 3
                                            ? "rd"
                                            : "th"
                            } Year`
                            : "1st Year"}

                        {" • Section "}

                        {props.user?.profile?.section_name ||
                            "A"}

                    </p>

                </div>


                <div className="term-info">

                    <strong>
                        {props.academicTerm?.semester ||
                            "1st Semester"}
                    </strong>


                    <span>
                        {props.academicTerm?.academic_year ||
                            "Academic Year 2026–2027"}
                    </span>

                </div>

            </div>


            {/* =================================================
                SCHEDULE TABLE
            ================================================= */}

            <div className="schedule-table-wrapper">

                <div className="schedule-table">

                    {/* =====================================================
                        HEADER
                    ====================================================== */}

                    <div
                        className="s-schedule-header time-column"
                        style={{
                            gridColumn: 1,
                            gridRow: 1
                        }}
                    >
                        Time
                    </div>


                    {days.map((day, index) => (

                        <div
                            key={day}
                            className="s-schedule-header"
                            style={{
                                gridColumn: index + 2,
                                gridRow: 1
                            }}
                        >
                            {day}
                        </div>

                    ))}


                    {/* =====================================================
                        TIME ROWS + EMPTY CELLS
                    ====================================================== */}

                    {timeSlots.map((time, timeIndex) => {

                        /*
                            Header = row 1

                            7-8    = row 2
                            8-9    = row 3
                            9-10   = row 4
                            etc.
                        */

                        const gridRow = timeIndex + 2;


                        return (
                            <React.Fragment key={time}>

                                {/* TIME */}

                                <div
                                    className="schedule-time-cell"
                                    style={{
                                        gridColumn: 1,
                                        gridRow: gridRow
                                    }}
                                >
                                    {time}
                                </div>


                                {/* DAY CELLS */}

                                {days.map((day, dayIndex) => (

                                    <div
                                        key={`${day}-${time}`}
                                        className="schedule-cell"
                                        style={{
                                            gridColumn: dayIndex + 2,
                                            gridRow: gridRow
                                        }}
                                    />

                                ))}

                            </React.Fragment>
                        );

                    })}


                    {/* =====================================================
                        CLASS BLOCKS
                    ====================================================== */}

                    {mergedSchedule.map((classItem, index) => {

                        const day =
                            classItem.day?.toLowerCase();


                        const dayIndex =
                            days.indexOf(day);


                        if (dayIndex === -1) {
                            return null;
                        }


                        /*
                            Get starting row
                        */

                        const startRow =
                            getStartRow(
                                classItem.start_time
                            );


                        /*
                            Get duration
                        */

                        const rowSpan =
                            getRowSpan(
                                classItem.start_time,
                                classItem.end_time
                            );


                        if (startRow === null) {
                            return null;
                        }


                        /*
                            Time column = 1

                            Monday    = 2
                            Tuesday   = 3
                            Wednesday = 4
                            Thursday  = 5
                            Friday    = 6
                            Saturday  = 7
                            Sunday    = 8
                        */

                        const gridColumn =
                            dayIndex + 2;


                        return (

                            <div
                                key={
                                    classItem.id ||
                                    `${classItem.day}-${classItem.subject_code}-${classItem.start_time}-${classItem.end_time}-${index}`
                                }

                                className="class-block"

                                style={{
                                    gridColumn: gridColumn,

                                    gridRow:
                                        `${startRow} / span ${rowSpan}`
                                }}
                            >

                                {/* CLASS TYPE */}

                                <span
                                    className={
                                        classItem.room_type ===
                                        "laboratory"
                                            ? "class-lab"
                                            : "class-lec"
                                    }
                                >
                                    
                                    {
                                        classItem.room_type ===
                                        "laboratory"
                                            ? "Laboratory"
                                            : "Lecture"
                                    }
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


                                {/* TIME */}

                                <small>

                                    {classItem.start_time?.slice(0, 5)}

                                    {" - "}

                                    {classItem.end_time?.slice(0, 5)}

                                </small>

                            </div>

                        );

                    })}

                </div>

            </div>

        </div>
    );
};


export default Schedule;