import React from 'react'
import './Loading.css';
const Loading = (props) => {
  return (
    <div className='loading-wrapper'>
      <div className='loading'>
        <h1>Loading {props.text}</h1>
        <div className='loading-animate'></div>
      </div>

    </div>
  )
}

export default Loading
