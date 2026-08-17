import React from 'react'
import { useState } from 'react';
import '../../../styles/Profesor.css';
import {
FaBook,
FaUsers,
FaClipboardCheck,
FaTasks,
FaBullhorn,
FaCalendarAlt,
FaGraduationCap,
FaCheck
} from "react-icons/fa";

const ProfHome = (props) => {
  const stats = [
  {
  title:"Students",
  value:124,
  icon:<FaUsers/>
  },
  {
  title:"Subjects",
  value:6,
  icon:<FaBook/>
  },
  {
  title:"Pending Tasks",
  value:12,
  icon:<FaTasks/>
  },
  {
  title: "Completed Task",
  value: 10,
  icon: <FaCheck />
  },
  {
  title:"Attendance",
  value:"98%",
  icon:<FaClipboardCheck/>
  }
  ]
  
  const [loading, setLoading] = useState(false);
  const[openAnnounce, setOpenAnnounce] = useState(false);
  const[announcement, setAnnouncement] = useState({
    title: "",
    content: ""
  });

  
  
  
const createAnnouncement = async (e) => {
    e.preventDefault();
    if(announcement.title === "" || announcement.content === ""){
        alert("Announcement title or content cannot be null");
        return;
    }
    

    try {
        const token = localStorage.getItem('professor_token');
        setLoading(true);
        const response = await fetch(
            "http://localhost:3000/api/auth/createAnnouncement",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                title: announcement.title,
                content: announcement.content
            }),
            }
        );

        
        const data = await response.json();

        if (response.ok) {
            alert(data.message);

            // Optional: Clear the form
            setAnnouncement({
                title: "",
                content: ""
            });

            // Optional: Go back to login page
            // navigate("/");
            setLoading(false);
            setOpenAnnounce(false);
        } else {
            alert(data.message);
        }

    } catch (error) {
        console.error(error);
        alert("Unable to connect to the server.");
    }
};

  return (
  <> 
  <form className={`announce-box ${openAnnounce ? "open":""}`} onSubmit={createAnnouncement}>
    <h2 onClick={()=>{setOpenAnnounce(!openAnnounce)}}>X</h2>
    <h3>Announcement</h3>
    <input type='text' placeholder='Title'
    value={announcement.title}
    onChange={(e)=> {setAnnouncement({...announcement, title: e.target.value})}}
    required></input>
    <textarea 
    value={announcement.content}
    onChange={(e) => {setAnnouncement({...announcement, content: e.target.value})}}
    required></textarea>
    <button type='submit'>
        {loading ? "Anouncing...":"Announce"}
    </button>
  </form>

<div className="prof-dashboard" style={openAnnounce === true ? {filter: 'blur(5px)', pointerEvents: 'none'}:{}}>
  
<div className="welcome-card">

<h1>Welcome Professor!</h1>

<p>
Manage your classes, grades, attendance and announcements.
</p>

</div>

<div className="stats">

{
stats.map((item,index)=>

<div className="stat-card" key={index}>

<div className="p-icon">
{item.icon}
</div>

<h2>{item.value}</h2>

<p>{item.title}</p>

</div>

)
}

</div>

<div className="middle-section">

<div className="schedule">

<h2>Today's Schedule</h2>

<div className="class-card">

<h3>BSCS 2A</h3>

<p>Web Development</p>

<span>8:00 AM - 10:00 AM</span>

</div>

<div className="class-card">

<h3>BSIT 1B</h3>

<p>Programming 1</p>

<span>1:00 PM - 3:00 PM</span>

</div>

</div>

<div className="announcement">

<h2>Announcements</h2>

<p>No new announcements.</p>

<button onClick={()=>{setOpenAnnounce(!openAnnounce)}}>Make Announcement</button>

</div>

</div>

<h2 className="section-title">

My Subjects

</h2>

<div className="subjects">

<div className="subject">

<FaGraduationCap/>

<h3>BSCS 2A</h3>

<p>42 Students</p>

</div>

<div className="subject">

<FaGraduationCap/>

<h3>BSCS 2B</h3>

<p>39 Students</p>

</div>

<div className="subject">

<FaGraduationCap/>

<h3>BSIT 1A</h3>

<p>45 Students</p>

</div>

<div className="subject">

<FaGraduationCap/>

<h3>BSIT 2C</h3>

<p>36 Students</p>

</div>

</div>

<div className="activity">

<h2>Recent Activities</h2>

<ul>

<li>✔ John submitted Assignment 2</li>

<li>✔ Attendance recorded for BSCS 2A</li>

<li>✔ Midterm grades uploaded</li>

<li>✔ New announcement posted</li>

</ul>

</div>

</div>
</>
  )
}

export default ProfHome
