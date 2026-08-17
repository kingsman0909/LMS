
import React from 'react';
import '../../../styles/StudentPage.css';
import {useState, useEffect} from 'react';

const Homepage = ({announcement}) => {
    const [announcements, setAnnouncements] = useState([]);

    useEffect(() => {
        setAnnouncements(announcement);
    }, [announcement]);
    return (
        <div className="homepage">

            {/* LEFT CONTENT */}
            <div className="h-content">

                {/* WELCOME CARD */}
                <div className="h-updates">

                    <div className="welcome-text">
                        <span className="welcome-label">
                            Welcome back, Student 👋
                        </span>

                        <h1>
                            Welcome to <span>LMS</span>
                        </h1>

                        <p>
                            Your learning journey starts here.
                        </p>
                    </div>

                    <div className="version">
                        v1.0
                    </div>

                </div>


                {/* ANNOUNCEMENTS */}
                <div className="announcements">
                    <div className="section-header">
                        <div>
                            <span className="section-label">
                                Stay updated
                            </span>

                            <h2>
                                Announcements
                            </h2>
                        </div>

                        <span className="announcement-icon">
                            📢
                        </span>
                    </div>


                    <div className="a-content">
                    <h1>
                    {announcements != null ?
                        announcements[0]?.title:""
                    }
                    </h1>
                        <div className="empty-announcement">

                            <div className="empty-icon">
                                📭
                            </div>
                            
                            <h3>
                                {announcements !== null ? 
                                announcements[0]?.content
                                :"no announcement"}
                            </h3>

                            <p>
                                You're all caught up for now.
                            </p>

                        </div>

                    </div>

                </div>

            </div>


            {/* RIGHT CONTENT */}
            <div className="h-info">

                {/* DATE CARD */}
                <div className="date">

                    <div className="date-top">
                        <span className="date-label">
                            TODAY
                        </span>

                        <span className="calendar-icon">
                            📅
                        </span>
                    </div>

                    <div className="date-main">
                        <h1>
                            14
                        </h1>

                        <div>
                            <h3>
                                July
                            </h3>

                            <span>
                                2026
                            </span>
                        </div>
                    </div>

                    <div className="date-bottom">
                        Tuesday
                    </div>

                </div>


                {/* QUICK INFO */}
                <div className="quick-info">

                    <span className="section-label">
                        Quick overview
                    </span>

                    <h2>
                        Keep learning.
                    </h2>

                    <p>
                        Check your courses, tasks, and schedule to stay on track.
                    </p>

                </div>

            </div>

        </div>
    );
};

export default Homepage;

