// Card component to display individual plan details
import React from 'react';
import './Card.css';
function Card({ title, description, price }) {
    return (
        <div className='card'>
            <h3>{title}</h3>
            <p>{description}</p>
            <p className='price'>${price}</p>
            <button className='subscribe-button'>Subscribe</button>
        </div>
    );
}
export default Card;