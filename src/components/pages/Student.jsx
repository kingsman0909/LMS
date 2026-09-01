import React from 'react'
import '../../styles/Student.css';
import { HiMenu } from "react-icons/hi";
import { HiBell } from "react-icons/hi";
import { HiUserCircle } from "react-icons/hi";
import { useState, useEffect, useRef } from 'react';
import LineSidebar from './animatedComponents/Sidebar';
import Homepage from './StudentPage/Homepage';
import Schedule from './StudentPage/Schedule';
import Pendingtask from './StudentPage/Pendingtask';
import Courses from './StudentPage/Courses';
import Enrollment from './StudentPage/Enrollment';
import Billing from './StudentPage/Billing';
import { Routes, Route, useNavigate } from "react-router-dom";
import { Navigate } from 'react-router-dom';
import { useLocation } from "react-router-dom";
import Protect from '../auth/ProtectedRoutes';
import { API_BASE_URL } from "../../config";


const Student = (props) => {

  const[user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const[openMenu, setOpenMenu] = useState(false);
  const[open, setOpen] = useState(false);
  const[openNotif, setOpenNotif]= useState(false);
  const[announcement, setAnnouncement] = useState(null);
  const [academicTerm, setAcademicTerm] = useState([]);
  

  const location = useLocation();
  const navigate = useNavigate();
  const pathMap = {
    "/student": 0,
    "/student/PendingTask": 1,
    "/student/schedule": 2,
    "/student/billing": 3,
    "/student/courses": 4,
    "/student/enrollment": 5
  };

  const fetchTerm = async () => {
        try {
        const token = localStorage.getItem(`${props.role}_token`);

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
        setAnnouncement(data.announcements);
    } catch (error) {
        console.error("hello");
    }
};

useEffect(() => {
    fetchAnnouncements();
    fetchTerm();
}, []);

  const notificationRef = useRef(null);
  const logoutRef = useRef(null);


  useEffect(() => {
    function handleClickOutside(event) {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
          setOpenNotif(false);
      }

      if (
        logoutRef.current &&
        !logoutRef.current.contains(event.target)
      ) {
        
          setOpenMenu(false);
        
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
      const getMe = async () => {
          const token = localStorage.getItem(`${props.role}_token`);

          const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
              headers: {
                  Authorization: `Bearer ${token}`
              }
          });

          const data = await response.json();
          setUser(data.user);
          console.log(data.user);
          setLoading(false);

      };

      getMe();
  }, []);

  if(!user){
    return <p>Loading...</p>
  }

  
  const ind = pathMap[location.pathname] ?? 0;

  const handlePage = (index, label) =>{
    switch(index){
      case 0:
        navigate('/student');
        break;
      case 1:
        navigate('/student/PendingTask')
        break;
      case 2:
        navigate('/student/schedule');
        break;
      case 3:
        navigate('/student/billing');
        break;
      case 4:
        navigate('/student/courses');
        break;
      case 5: 
        navigate('/student/enrollment');
        break;
      default:
        alert("Error in navigating page!");
        break;
    }
  }

  return (
    <div className='student'>
      <div className='s-header'>
        <div className='h-left'>
          <h1 className='logo'>LMS</h1>
          <h4 className='s-name'>{user?.profile.firstname + " "+ user?.profile.lastname} | {user?.profile.course}</h4>
        </div>
        <div className='right-icons'>
          <div className='menu' style={{cursor: 'pointer'}} onClick={()=>{setOpen(!open)}}><HiMenu className='icon'/></div>
          <div className='notif' ref={notificationRef}><HiBell onClick={()=>{setOpenNotif(!openNotif)}} className='icon' />
            {openNotif && 
              <div className='notif-box'  onClick={(e) => e.stopPropagation()}>
                <h2>Notifications</h2>
                {announcement.map((announce) =>(
                  <p key={announce.id}>
                    Profesor {announce.firstname} {announce.lastname} posted a new announcement:
                    <span style={{color: 'white'}}> {announce.content}</span> 
                  </p>
                )
                )}
            </div>
            }
          </div>
          <div className='profile' ref={logoutRef}>
            <HiUserCircle onClick={()=>{setOpenMenu(!openMenu)}} className='icon'/>
            {openMenu && 
              <div className='logout' >
                <button onClick={()=>{navigate('/'), localStorage.removeItem(`${props.role}_token`)}}>Logout</button>
              </div>
            }
          </div>
        </div>
      </div>

      <div className='s-body'>
          <div className={`b-wrapper ${open ? "" : "close"}`}>
            <div className={`b-menu ${open ? "" : "close"}`}>
              <div className='menu-info'>
                <div style={{border: '1px solid rgb(50, 231, 50)'}}>
                  <h1>LMS</h1>
                  <p>Learning Management System</p>
                </div>
                <div>
                  <h4>{academicTerm.semester}</h4>
                  <h2>A.Y {academicTerm.school_year}</h2>
                </div>
              </div>
            <LineSidebar
              key={location.pathname}
              className={`b-menu ${open ? "" : "closeBar"}`}
              items={[
                  'Homepage',
                  'Pending Task',
                  'Schedule',
                  'Billing',
                  'Courses',
                  'Enrollment'
              ]}
              accentColor="rgb(50, 231, 50)"
              textColor="#c4c4c4"
              markerColor="#6c6c6c"
              showIndex
              showMarker
              proximityRadius={100}
              maxShift={30}
              falloff="smooth"
              markerLength={0}
              markerGap={20}
              tickScale={0.5}
              scaleTick
              itemGap={13}
              fontSize={1.1}
              smoothing={100}
              defaultActive={ind}
              onItemClick={(index, label) => handlePage(index, label)}
          />
          </div>
        </div>
        

        <div className='b-content'>
          <Routes>
                <Route path="/" element={<Homepage announcement={announcement}/>} />
                <Route path='/PendingTask' element={<Pendingtask user={user} academicTerm={academicTerm} role={props?.role} section_id = {user?.profile?.section_id}/>} />
                <Route path='/Schedule' element={<Schedule user={user} academicTerm={academicTerm}/>} />
                <Route path="/billing" element={<Billing />} />
                <Route path='/courses' element={<Courses user={user} academicTerm={academicTerm}/>} />
                <Route path='/enrollment' element={<Enrollment user={user}/>} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

export default Student