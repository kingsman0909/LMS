import React from 'react'
import {API_BASE_URL} from '../../../config.js';
import {useState, useEffect} from 'react';
import './styles/Announcements.css';

const Announcements = () => {

  const[announcements, setAnnouncements] = useState([]);
  const[showModal, setShowModal] = useState(true);
  const getAllAnnouncement = async () => {
    const token = localStorage.getItem("admin_token");

    const response = await fetch(`${API_BASE_URL}/api/auth/announcements`,
      {
        method: 'GET',
        headers: {
          Authorization: `bearer ${token}`
        }
      }
    )

    const data = await response.json();

    console.log("all announcement: ", data)
    setAnnouncements(data.announcements || []);
  }

  useEffect(()=>{
    getAllAnnouncement();
  }, [])
  return (
    <>
    {showModal &&
      <div className='a-announce-modal'>
        
      </div>
    }
    <div className='admin-announce'>
        <h2>Announcements</h2>
        <div className={announcements.length > 0 ? 'admin-announce-list':''}>
          {announcements.length > 0 ? (
          announcements.map((item) => (
            <div key={item.id} className='a-announce-box'>
              <p>{item.title}</p>
              <button>View</button>
            </div>
            
          ))
        ):<p className={announcements.length > 0 ? '':'no-announce'}>No Announcements</p>}
        </div>

      </div>
      </>
  )
}

export default Announcements
