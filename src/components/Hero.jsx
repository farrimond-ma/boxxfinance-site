import React from 'react';
import { Link } from 'react-router-dom';
import './Hero.css';

const Hero = () => {
    return (
        <section className="hero" id="home">
            <div className="hero-overlay"></div>
            <div className="container hero-content">
                <h1>Funding Done Properly. <br /><span className="text-gold">Structured for Growth.</span></h1>
                <p>We secure tailored commercial finance for UK businesses. From assets and working capital to complex structured transactions, we deliver with clarity, speed and certainty. Your business comes first, not ticking lender boxes.</p>
                <div className="hero-btns">
                    <Link to="/chat-about-funding" className="btn btn-primary">Secure The Right Funding</Link>
                    <a href="#funding-solutions" className="btn btn-outline">Understand Your Options</a>
                </div>
            </div>
        </section>
    );
};

export default Hero;
