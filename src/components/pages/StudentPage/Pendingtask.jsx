import React from 'react'
import '../../../styles/StudentPage.css';
import { FiClock, FiBookOpen, FiCheckCircle } from "react-icons/fi";

const Pendingtask = () => {
  const tasks = [
    {
      title: "Game Development Activity",
      subject: "Game Development",
      deadline: "July 25, 2026",
      status: "Pending",
    },
    {
      title: "Game Development Activity",
      subject: "Game Development",
      deadline: "July 25, 2026",
      status: "Pending",
    },
    {
      title: "Game Development Activity",
      subject: "Game Development",
      deadline: "July 25, 2026",
      status: "Pending",
    },
    {
      title: "Nursing Fundamentals Quiz",
      subject: "Nursing Fundamentals",
      deadline: "July 27, 2026",
      status: "Pending",
    },
    {
      title: "React LMS Project",
      subject: "Web Development",
      deadline: "July 30, 2026",
      status: "In Progress",
    },
  ];

  return (
    <div className="pending-task">
      <div className="page-header">
        <div>
          <h1>Pending Tasks</h1>
          <p>Keep track of your assignments and activities.</p>
        </div>

        <div className="task-summary">
          <span>{tasks.length}</span>
          <p>Tasks</p>
        </div>
      </div>

      <div className="task-list">
        {tasks.map((task, index) => (
          <div className="task-card" key={index}>
            <div className="task-icon">
              <FiBookOpen />
            </div>

            <div className="task-info">
              <h3>{task.title}</h3>
              <p>{task.subject}</p>

              <div className="task-deadline">
                <FiClock />
                <span>Due {task.deadline}</span>
              </div>
            </div>

            <div className={`task-status ${task.status.toLowerCase().replace(" ", "-")}`}>
              {task.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Pendingtask;