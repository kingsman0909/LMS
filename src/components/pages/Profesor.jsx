import "../../styles/Profesor.css";
import { useState, useEffect } from "react";
import {
    FaBars,
    FaBell,
    FaUserCircle
} from "react-icons/fa";
import Home from './ProfesorPage/ProfHome';
import StudentDemo from './ProfesorPage/ProfStudent-demo'
import { Routes, Route, useNavigate } from "react-router-dom";
import { Navigate, useLocation } from 'react-router-dom';
import LineSidebar from './animatedComponents/Sidebar';
import { API_BASE_URL } from "../../config";

export default function Profesor({role}) {
const[openMenu, setOpenMenu]= useState(false);
const[nav, setNav] = useState(false);

const navigate = useNavigate();
const[user, setUser] = useState(null);
const[loading, setLoading] = useState(false);
const[academicTerm, setAcademicTerm] = useState([]);
useEffect(() => {
            console.log("start");

      const getMe = async () => {
          const token = localStorage.getItem("professor_token");

          const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
              headers: {
                  Authorization: `Bearer ${token}`
              }
          });

          const data = await response.json();
          console.log(data);
          setUser(data.user);
          setLoading(false);
      };

      getMe();
      fetchTerm();
  }, []);

  const fetchTerm = async () => {
        try {
        const token = localStorage.getItem(`${role}_token`);

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

const logout = () => {
  localStorage.removeItem(`${role}_token`);
  navigate('/');
}

const location = useLocation();
const pathMap = {
    "/student": 0,
    "/student/PendingTask": 1,
    "/student/schedule": 2,
    "/student/calendar": 3,
    "/student/references": 4,
  };
const ind = pathMap[location.pathname] ?? 0;

const handlePage = (index, label) =>{
    switch(index){
      case 0:
        navigate('/profesor/');
        break;
      case 1:
        navigate('/profesor/students-demo')
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
      default:
        alert("Error in navigating page!");
        break;
    }
  }
if(loading){
  return <p>Loading ...</p>
}

return (

<div className="prof-container">

<header className="prof-header">

    <div className="logo">

        <h1>LMS</h1>

    </div>

    <div className="header-title">

        <h3>
            Prof. {user?.profile.firstname+" "+user?.profile.lastname} 
        </h3>

    </div>

    <div className="header-icons">

        <FaBars onClick={()=>{setNav(!nav)}}/>

        <FaBell />

        <FaUserCircle onClick={()=>{setOpenMenu(!openMenu)}}/>
        {openMenu && 
        <div className="p-logout">
          <button onClick={()=>{logout()}}>Logout</button>
        </div>
        }
    </div>

</header>

<div className="prof-wrapper">
    <div className={`prof-menu-wrapper ${nav ? "": "close"}`}>
        <div className={`prof-menu ${nav ? "":"close"}`}>
            <div className='menu-info'>
                <div style={{border: '1px solid rgb(50, 231, 50)'}}>
                  <h1>LMS</h1>
                  <p>Learning Management System</p>
                </div>
                <div>
                  <h4>First Semester</h4>
                  <h2>A.Y 2026-2027</h2>
                </div>
              </div>
            <LineSidebar 
                          items={['Homepage','My Students', 'Courses', 'Pending Task', 'Completed Task', 'Attendance ']}
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
                          itemGap={20}
                          fontSize={1.1}
                          smoothing={100}
                          defaultActive={ind}
                          onItemClick={(index, label) => handlePage(index, label)}
            />
        </div>
    </div>
    <div className="prof-content">
        <Routes>
            <Route path="/" element={<Home user={user}/>} />
            <Route path='/students-demo' element={<StudentDemo user={user} academicTerm={academicTerm}/>} />
        </Routes>
    </div>
</div>

</div>

)
}