import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { serviceContent } from '../data/services'; // Access service list
import './Sidebar.css';

const Sidebar = () => {
    const { slug } = useParams(); // Get current service slug if on a service page

    const services = Object.entries(serviceContent)
        .filter(([_, s]) => !s.hidden)
        .map(([key, s]) => ({
            title: s.title,
            slug: key
        }))
        .sort((a, b) => a.title.localeCompare(b.title));

    // Determine the application link based on the current page
    const applicationLink = slug && serviceContent[slug]
        ? `/chat-about-funding/${slug}`
        : '/chat-about-funding';

    return (
        <div className="sidebar">
            <div className="sidebar-widget service-list-widget">
                <h3>Funding Solutions</h3>
                <ul>
                    {services.map(service => (
                        <li key={service.slug}>
                            <Link to={`/funding-solutions/${service.slug}`}>{service.title}</Link>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="sidebar-widget cta-widget">
                <h3>Looking For <span className="text-highlight">Funding?</span></h3>
                <p>Speak to our experts today to find the right solution for your business.</p>
                <Link to={applicationLink} className="btn btn-primary">Speak to a Funding Specialist</Link>
                <p className="sidebar-email-cta">If you have any questions about commercial funding please email <a href="mailto:hello@boxxfinance.co.uk" className="gold-link">hello@boxxfinance.co.uk</a></p>
            </div>
        </div>
    );
};

export default Sidebar;
