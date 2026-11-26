import React from 'react';
import { Link } from 'react-router-dom';
import { serviceContent } from '../data/services';
import { FOCUS_SERVICES } from '../data/serviceFocus';
import './Services.css';

const Services = () => {
    // The promoted six only, in selling order rather than alphabetical — the
    // de-listed services are still live but are not shown on the homepage.
    const servicesArray = FOCUS_SERVICES
        .filter(slug => serviceContent[slug])
        .map(slug => ({ slug, ...serviceContent[slug] }));

    return (
        <section className="section services" id="funding-solutions">
            <div className="container">
                <div className="section-header">
                    <h2>What We <span className="text-highlight">Arrange</span></h2>
                    <p>Two things, done properly: bridging loans and development finance.<br />Every case is shaped around the property, the timescale and how the loan gets repaid.</p>
                    <p>Whether you are buying at auction, breaking a chain, refurbishing, building out a site or stopping a repossession, the questions are the same: what is the property worth, how fast do you need it, and what repays the loan.</p>
                    <br />
                    <Link to="/bridging-enquiry" className="btn btn-primary">Talk to a bridging specialist</Link>
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
