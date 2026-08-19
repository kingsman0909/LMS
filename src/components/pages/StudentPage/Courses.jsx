import React, { useState, useEffect } from "react";
import "../../../styles/StudentPage.css";
import {
    FiBookOpen,
    FiUser,
    FiClock,
    FiArrowRight
} from "react-icons/fi";

const Courses = (props) => {

    const[courses, setCourses] = useState([]);

    const fetchSubjects = async () => {

        if (!props.academicTerm?.id) return;
        if (!props.user?.profile?.id) return;

        try {
            const token = localStorage.getItem(`${props.user.role}_token`);
    
            const response = await fetch(
                `http://localhost:3000/api/auth/getStudentSubjects?academicTermId=${props.academicTerm.id}&studentId=${props.user.profile.id}`,
                {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );
    
            const data = await response.json();
            console.log(data);
            if (!response.ok) {
                throw new Error(data.message);
            }
    
            setCourses(data.subjects);
        } catch (error) {
            alert("Error in getting courses!");
        }
    };
    
    useEffect(() => {
        fetchSubjects();

    }, []);

    

    return (
        <div className="courses-page">

            <div className="courses-header">
                <div>
                    <h1>My Courses</h1>
                    <p>
                        View your enrolled courses and academic progress.
                    </p>
                </div>

                <div className="course-count">
                    <FiBookOpen />
                    <span>{courses.length} Courses</span>
                </div>
            </div>


            <div className="courses-grid">

                {courses.map((course, index) => (

                    <div className="course-card" key={index}>

                        <div className="course-top">

                            <div className="course-icon">
                                <FiBookOpen />
                            </div>

                            <span className="course-code">
                                {course.subject_code}
                            </span>

                        </div>


                        <h2>{course.subject_name}</h2>


                        <div className="progress-section">

                            <div className="progress-label">
                                <span>Course Progress</span>
                                <strong>{course.progress}%</strong>
                            </div>

                            <div className="progress-bar">

                                <div
                                    className={course.progress>40 ? "progress-fill":"progress-fail"}
                                    style={{
                                        width: `${course.progress}%`
                                    }}
                                />

                            </div>

                        </div>


                        <button className="view-course-btn">

                            View Course

                            <FiArrowRight />

                        </button>

                    </div>

                ))}

            </div>

        </div>
    );
};

export default Courses;