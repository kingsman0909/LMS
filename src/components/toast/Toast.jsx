import React from 'react'
import './Toast.css';

const Toast = ({onClose, label, msg}) => {
  const success = label === "success";
  return (
    <div className='toast-wrapper'>
      <div className={success ? 'toast':'toast error'}>
        <h2 className='close' onClick={()=> onClose()}>X</h2>
        <h2 className={success ? 'success':'error'}>
          {
            success ? "Success!":"Error!"
          }
        </h2>
        <p>{msg}</p>
      </div>
    </div>
  )
}

export default Toast
