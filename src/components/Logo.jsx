import React from 'react';

const Logo = ({ className = "" }) => {
    return (
        <div className={`flex items-center ${className}`} style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
            {/* The Vertical Lime Green Line */}
            <div
                style={{
                    height: '4.5rem', // Matches text height roughly
                    width: '0.8rem',
                    backgroundColor: '#ccff00', // Lime Green
                    marginRight: '0.2rem',
                    borderRadius: '4px'
                }}
            ></div>

            {/* The Text "boxx" */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span
                    style={{
                        fontSize: '6rem', // Large font size
                        // fontWeight removed for standard weight
                        color: '#ffffff',
                        lineHeight: 1,
                        paddingBottom: '0.5rem', // Adjust for font baseline
                        letterSpacing: '-2px',
                        position: 'relative',
                        zIndex: 2,
                    }}
                >
                    Boxx
                </span>
            </div>
        </div>
    );
};

export default Logo;
