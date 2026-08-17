import React from "react";
import "../../../styles/StudentPage.css";
import { FiClock, FiMapPin } from "react-icons/fi";

const Schedule = () => {
  const schedule = [
    {
      time: "8:00 AM - 10:00 AM",
      subject: "Web Development",
      instructor: "Prof. Anderson",
      room: "Room 204",
      type: "Lecture",
    },
    {
      time: "10:30 AM - 12:00 PM",
      subject: "Game Development",
      instructor: "Prof. Smith",
      room: "Computer Lab 1",
      type: "Laboratory",
    },
    {
      time: "1:00 PM - 3:00 PM",
      subject: "Database Management",
      instructor: "Prof. Johnson",
      room: "Room 301",
      type: "Lecture",
    },
  ];

  return (
    <div className="schedule-page">
      <div className="page-header">
        <div>
          <h1>My Schedule</h1>
          <p>View your classes and activities.</p>
        </div>

        <div className="schedule-date">
          <strong>Today</strong>
          <span>July 22, 2026</span>
        </div>
      </div>

      <div className="schedule-list">
        {schedule.map((item, index) => (
          <div className="schedule-card" key={index}>
            <div className="schedule-time">
              <FiClock />
              <span>{item.time}</span>
            </div>

            <div className="schedule-content">
              <h3>{item.subject}</h3>
              <p>{item.instructor}</p>

              <div className="schedule-location">
                <FiMapPin />
                {item.room}
              </div>
            </div>

            <span className="class-type">
              {item.type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Schedule;