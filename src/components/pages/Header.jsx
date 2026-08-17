import React from 'react'
import { HiMenu } from "react-icons/hi";
import { HiBell } from "react-icons/hi";
import { HiUserCircle } from "react-icons/hi";
import '../../styles/Student.css';
import { useState, useEffect } from 'react';


const Header = (props) => {

    const[open, setOpen] = useState(false);
    const[openNotif, setOpenNotif]= useState(false);
    const[openMenu, setOpenMenu] = useState(false);
    const[announcement, setAnnouncement] = useState(props.announce);
    
  return (
    <div className='s-header'>
            <div className='h-left'>
              <h1 className='logo' style={{margin: '0'}}>LMS</h1>
              <h4 className='s-name'>Name</h4>
            </div>
            <div className='right-icons'>
              <div className='menu' style={{cursor: 'pointer'}} onClick={()=>{props.setOpenMenu(props.openMenu)}}><HiMenu className='icon'/></div>
              <div className='notif' onClick={()=>{setOpenNotif(!openNotif)}}><HiBell className='icon' />
                {openNotif && 
                  <div className='notif-box' onClick={(e) => e.stopPropagation()}>
                    {announcement.map((announce) =>(
                      <h2>Notification</h2>,
                      <p key={announce.id}>
                        Profesor {announce.firstname} {announce.lastname} posted a new announcement:
                        <span style={{color: 'white'}}> {announce.content}</span> 
                      </p>
                    )
                    )}
                </div>
                }
              </div>
              <div className='profile' onClick={()=>{setOpenMenu(!openMenu)}}>
                <HiUserCircle className='icon'/>
                {openMenu && 
                  <div className='logout'>
                    <button onClick={()=>{navigate('/'), localStorage.removeItem("token");}}>Logout</button>
                  </div>
                }
              </div>
            </div>
          </div>
  )
}

export default Header
