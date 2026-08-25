import React, { useState, useEffect } from 'react';
import { useLocation } from "react-router-dom";

import '../../styles/Admin.css';
import LineSidebar from './animatedComponents/Sidebar';
import Applicant from './AdminPage/Applicants';
import AllStudents from './AdminPage/AllStudents';
import AllSubjects from './AdminPage/AllSubjects';
import AllPrograms from './AdminPage/AllPrograms';
import AllProfessor from './AdminPage/AllProfessor';
import Announcements from './AdminPage/Announcements';
import Schedule from './AdminPage/Schedule';
import Dashboard from './AdminPage/Dashboard';
import Curriculum from './AdminPage/Curriculum';
import Enrollment from './AdminPage/Enrollment';

import {
    HiMenu,
    HiBell,
    HiUserCircle,
    HiOutlineUsers,
    HiOutlineAcademicCap,
    HiOutlineBookOpen,
    HiOutlineSpeakerphone
} from 'react-icons/hi';

import { API_BASE_URL } from "../../config";

import {
    useNavigate,
    Routes,
    Route
} from 'react-router-dom';



const Admin = ({role}) => {

    const [openMenu, setOpenMenu] = useState(false);
    const [openProfile, setOpenProfile] = useState(false);
    const [openNotif, setOpenNotif] = useState(false);
    const [academicTerm, setAcademicTerm] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [announcements, setAnnouncements] = useState([]);

    const navigate = useNavigate();

    const fetchTerm = async () => {
        try {
        const token = localStorage.getItem('admin_token');

        const response = await fetch(`${API_BASE_URL}/api/auth/getAcademicTerm`,
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
        console.log(data.term.id);
        setAcademicTerm(data.term);
    } catch (error) {
        alert(error.message);
    }
    };

    const fetchAnnouncements = async () => {
    try {
        const token = localStorage.getItem(`${props.role}_token`);

        const response = await fetch(`${API_BASE_URL}/api/auth/announcements`,
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
        setAnnouncements(data.announcements);
    } catch (error) {
        console.error("hello");
    }
};


    useEffect(() => {
        fetchTerm();
        fetchPrograms();
    }, []);
    
    const fetchPrograms = async () => {

    try {

        const token = localStorage.getItem("admin_token");

        const response = await fetch(`${API_BASE_URL}/api/auth/getPrograms`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Failed to fetch programs"
            );
        }

        setPrograms(data.programs);

    } catch (error) {

        console.error(
            "Failed to fetch programs:",
            error
        );

        alert(
            "Unable to load available programs."
        );
    }
};


    const handleLogout = () => {

        localStorage.removeItem(`${role}_token`);

        navigate('/');

    };

    const location = useLocation();


    const pathMap = {
    "/admin": 0,
    "/admin/applicants": 1,
    "/admin/programs": 2,
    "/admin/allStudents": 3,
    "/admin/professors": 4,
    "/admin/allSubjects": 5,
    "/admin/schedules": 6,
    "/admin/curriculum": 7,
    "/admin/announcements": 8,
    "/admin/enrollments": 9
  };

  
    const ind = pathMap[location.pathname] ?? 0;
       
      const handlePage = (index) =>{
    switch(index){
      case 0:
        navigate('/admin');
        break;
      case 1:
        navigate('/admin/applicants')
        break;
    case 2:
        navigate('/admin/programs');
        break;
    case 3:
        navigate('/admin/allStudents');
        break;
    case 4:
        navigate('/admin/professors');
        break;
    case 5:
        navigate('/admin/allSubjects');
        break;
    case 6:
        navigate('/admin/schedules');
        break;
    case 7:
        navigate('/admin/curriculum');
        break;
    case 8:
        navigate('/admin/announcements');
        break;
    case 9:
        navigate('/admin/enrollments');
        break;
      default:
        alert("Error in navigating page!");
        break;
    }
  }
  
    return (

        <div className="admin-dashboard">

            {/* ================= HEADER ================= */}

            <header className="admin-header">

                <div className="admin-header-left">

                    <div className="admin-logo">
                        LMS
                    </div>

                    <div className="admin-title">

                        <h3>
                            Administration Panel
                        </h3>

                        <span>
                            Learning Management System
                        </span>

                    </div>

                </div>


                <div className="admin-header-right">


                    {/* MENU */}

                    <button
                        className="admin-header-button"
                        onClick={() => setOpenMenu(!openMenu)}
                    >

                        <HiMenu />

                    </button>


                    {/* NOTIFICATION */}

                    <div className="admin-notification-wrapper">

                        <button
                            className="admin-header-button"
                            onClick={() => setOpenNotif(!openNotif)}
                        >

                            <HiBell />

                            {announcements.length > 0 && (

                                <span className="notification-badge">
                                    {announcements.length}
                                </span>

                            )}

                        </button>


                        {openNotif && (

                            <div className="admin-notification-box">

                                <div className="notification-header">

                                    <h3>
                                        Notifications
                                    </h3>

                                    <span>
                                        {announcements.length} new
                                    </span>

                                </div>


                                <div className="notification-list">

                                    {announcements.map((notification) => (

                                        <div
                                            className="notification-item"
                                            key={notification.id}
                                        >

                                            <HiBell />

                                            <div>

                                                <strong>
                                                    {notification.title}
                                                </strong>

                                                <p>
                                                    {notification.message}
                                                </p>

                                            </div>

                                        </div>

                                    ))}

                                </div>

                            </div>

                        )}

                    </div>


                    {/* PROFILE */}

                    <div className="admin-profile-wrapper">

                        <button
                            className="admin-profile-button"
                            onClick={() => setOpenProfile(!openProfile)}
                        >

                            <HiUserCircle />

                            <span>
                                Admin
                            </span>

                        </button>


                        {openProfile && (

                            <div className="admin-profile-menu">

                                <button onClick={handleLogout}>
                                    Logout
                                </button>

                            </div>

                        )}

                    </div>

                </div>
            </header>

        <div className='admin-content'>
            {/* ================= NAVBAR ================= */}
            <div className={`admin-nav-wrapper ${openMenu ? "":"close"}`}>
                <div className={`admin-nav ${openMenu ? "":"close"}`}>
                    <h2>A.Y {academicTerm.school_year}<br></br>{academicTerm.semester}</h2>
                <LineSidebar 
                    items={['Dashboard','Applicants', 'Programs', 'Students', 
                            'Professors', 'subjects', 'schedules', 'curriculum', 
                             'Announcements ', 'Enrollments']}
                    accentColor="rgb(50, 231, 50)"
                    textColor="#c4c4c4"
                    markerColor="#6c6c6c"
                    showIndex
                    showMarker
                    proximityRadius={100}
                    maxShift={30}
                    falloff="smooth"
                    markerLength={60}
                    markerGap={0}
                    tickScale={0.5}
                    scaleTick
                    itemGap={20}
                    fontSize={1.1}
                    smoothing={100}
                    defaultActive={ind}
                    onItemClick={(index, label) => handlePage(index)}
                        />
                </div>
            </div>

            <Routes>
                <Route path='/applicants' element={<Applicant />}></Route>
                <Route path='/allStudents' element={<AllStudents />} />
                <Route path='/allSubjects' element={<AllSubjects programs={programs}/>} />
                <Route path='/programs' element={<AllPrograms />} />
                <Route path='/schedules' element={<Schedule />} />
                <Route path='/professors' element={<AllProfessor />} />
                <Route path='/announcements' element={<Announcements />} />
                <Route path='/enrollments' element={<Enrollment term={academicTerm} />} />
                <Route path='/curriculum' element={<Curriculum />} />
                <Route path='/' element={<Dashboard term={academicTerm} handlePage={handlePage}/>} />
            </Routes>
        </div>

        </div>

    );
};
export default Admin;