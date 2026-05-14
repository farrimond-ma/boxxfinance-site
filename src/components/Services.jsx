import React from 'react';
import { Link } from 'react-router-dom';
import { serviceContent } from '../data/services';
import './Services.css';

const Services = () => {
    // Convert serviceContent object to array for mapping
    const servicesArray = Object.keys(serviceContent).map(slug => ({
        slug,
        ...serviceContent[slug]
    })).sort((a, b) => a.title.localeCompare(b.title));

    return (
        <section className="section services" id="funding-solutions">
            <div className="container">
                <div className="section-header">
                    <h2>Our <span className="text-highlight">Funding Solutions</span></h2>
                    <p>We don’t sell finance products. We design strategic funding solutions that solve real business challenges.<br />Every case is shaped around your cash flow, sector and growth plans.</p>
                    <p>Explore our core funding options below, or speak to us directly to discuss your requirements.</p>
                    <br />
                    <Link to="/chat-about-funding" className="btn btn-primary">Speak to a Funding Specialist</Link>
                </div>

                <div className="services-grid">
                    {servicesArray.map((service, index) => (
                        <div className="service-card" key={index}>
                            <div className="service-icon">
                                {service.icon}
                            </div>
                            <h3>{service.title}</h3>
                            <p>{service.description}</p>
                            <Link to={`/funding-solutions/${service.slug}`} className="service-link">Learn More &rarr;</Link>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Services;
