import React from 'react';
import { Link } from 'react-router-dom';
import './Testimonials.css';
const testimonials = [
    {
        text: "Boxx Finance understood our complex requirements immediately. They secured funding for our new warehouse expansion when our high street bank said no.",
        author: "James Miller",
        company: "Managing Director, Miller Logistics"
    },
    {
        text: "Fast, professional, and transparent. The invoice finance facility has completely transformed our cash flow, allowing us to take on bigger contracts.",
        author: "Sarah Jenkins",
        company: "FD, TechSolutions Ltd"
    },
    {
        text: "We needed asset finance for a fleet of new vehicles. The team at Boxx got us a better rate than the dealer and turned it around in 48 hours.",
        author: "David Chen",
        company: "Director, Chen Transport"
    }
];

const Testimonials = () => {
    return (
        <section className="section testimonials" id="testimonials">
            <div className="container">
                <div className="section-header">
                    <h2>Proven Results. <span className="text-highlight">Real Businesses.</span></h2>
                    <p>We’re judged by outcomes. Here’s what our clients say about working with <strong>Boxx Commercial Finance</strong>.</p>
                </div>

                <div className="testimonials-grid">
                    {testimonials.map((item, index) => (
                        <div className="testimonial-card" key={index}>
                            <div className="quote-icon">“</div>
                            <p className="testimonial-text">{item.text}</p>
                            <div className="testimonial-author">
                                <h4>{item.author}</h4>
                                <p>{item.company}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div style={{ textAlign: 'center', marginTop: '3rem' }}>
                    <Link to="/chat-about-funding" className="btn btn-primary">Start Your Application</Link>
                </div>
            </div>
        </section>
    );
};

export default Testimonials;
