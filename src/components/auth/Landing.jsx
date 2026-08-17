import React from 'react'
import { useState } from 'react';
import '../../styles/Landing.css';
import { useNavigate } from "react-router-dom";
import Student from './StudLogin';
import Prof from './ProfLogin';

const Landing = (props) => {

    const[log, setLogin] = useState(false);
    const[user, setUser] = useState(null);
    const navigate = useNavigate();
    

    function login(name){
        setUser(name);
        setLogin(true);
    }
    

    function loginProf(e){
        e.preventDefault();
        //authentication
        navigate("/profesor")
    }
  return (
    <div className='landing'>
        {log && user === 'student' && <Student  setLogin={setLogin}/>}
        {log && user === 'profesor' && <Prof loginUser={loginProf} setLogin={setLogin} />}
        <button className='enrol-btn' onClick={()=>{navigate('/enrolment')}}>Apply Now</button>
       <div className='landing-container' style={log ? {filter: "blur(6px)"} : {}}>
        <div className='LMS-box'>
            <h1><span className='LMS'>L</span>earning 
            <span className='LMS'> M</span>anagement
            <span className='LMS'> S</span>ystem</h1>
        </div>
        <h4>Stay <span className='LMS'>organized</span>, stay <span className='LMS'>productive</span>. 
            Your friendly system that manages<br></br>
                everything in one place—so you can focus on getting things done.
        </h4>
        
        <div className='user-btn'>
            <button className='stud-btn' onClick={()=>{login('student')}}>Student</button>
            <button className='prof-btn' onClick={()=>{login('profesor')}}>Profesor</button>
        </div>
       </div>
    </div>
  )
}

export default Landing
