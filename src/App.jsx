import { useState, useEffect } from 'react'
import './App.css' 
import Landing from './components/auth/Landing';
import Student from './components/pages/Student'
import Profesor from './components/pages/Profesor';
import { Routes, Route } from "react-router-dom";
import Protect from './components/auth/ProtectedRoutes';
import Enrol from './components/register/Enrol';
import Admin from './components/pages/Admin';
import AdminLogin from './components/pages/AdminLogin';

function App() {

  const isProduction = import.meta.env.PRODUCTION === "true";
  return (
    <Routes>
            <Route path="/" element={<Landing isProduction={isProduction}/>} />
            <Route path='/student/*' element={<Protect allowedRole={"student"} isProduction={isProduction}><Student role="student"/></Protect>} />
            <Route path='/profesor/*' element={<Protect allowedRole={"professor"} isProduction={isProduction}><Profesor role="professor"/></Protect>} />
            <Route path='/admin/login' element={<AdminLogin isProduction={isProduction}/>} />
            <Route path='/admin/*' element={<Protect allowedRole={"admin"} isProduction={isProduction}><Admin role="admin"/></Protect>} />
            <Route path='/enrolment' element={<Enrol />}></Route>
    </Routes>
  )
}

export default App
