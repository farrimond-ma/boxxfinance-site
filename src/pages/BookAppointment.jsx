import React, { useEffect, useMemo, useState } from 'react';
import SEO from '../components/SEO';
import './MultiStepForm.css';

// Same CRM shared secret every other public form on the site uses.
const CRM_SLOTS_URL = 'https://crm.boxxfinance.co.uk/appointment_slots.php';
const CRM_BOOK_URL = 'https://crm.boxxfinance.co.uk/book_appointment.php';
const CRM_INTAKE_KEY = '83cb574fb096ff8c62df4e117ac969a5f601c1ec43d5e91f';

const DAY_LABEL = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

// Public self-service booking — "Book an appointment with an advisor". No login, no lookup of an
// existing enquiry; picking a slot and confirming always creates a fresh case (source "Booked
// appointment") assigned to whichever advisor is actually free, and adds it to their Diary.
const BookAppointment = () => {
    const [slotsStatus, setSlotsStatus] = useState('loading'); // loading | ready | error
    const [slots, setSlots] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [form, setForm] = useState({ name: '', email: '', phone: '' });
    const [status, setStatus] = useState('picking'); // picking | sending | done | error
    const [errorMsg, setErrorMsg] = useState('');
    const [confirmed, setConfirmed] = useState(null);

    useEffect(() => {
        fetch(`${CRM_SLOTS_URL}?intake_key=${encodeURIComponent(CRM_INTAKE_KEY)}`)
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((data) => {
                if (!data.ok) throw new Error();
                setSlots(data.slots || []);
                setSlotsStatus('ready');
            })
            .catch(() => setSlotsStatus('error'));
    }, []);

    const days = useMemo(() => {
        const byDate = new Map();
        slots.forEach((s) => {
            if (!byDate.has(s.date)) byDate.set(s.date, []);
            byDate.get(s.date).push(s);
        });
        return Array.from(byDate.entries()).map(([date, daySlots]) => ({ date, slots: daySlots }));
    }, [slots]);

    useEffect(() => {
        if (!selectedDate && days.length) setSelectedDate(days[0].date);
    }, [days, selectedDate]);

    const activeDaySlots = days.find((d) => d.date === selectedDate)?.slots || [];

    const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const onConfirm = async (e) => {
        e.preventDefault();
        if (!selectedSlot) return;
        setStatus('sending');
        try {
            const params = new URLSearchParams();
            params.append('intake_key', CRM_INTAKE_KEY);
            params.append('name', form.name);
            params.append('email', form.email);
            params.append('phone', form.phone);
            params.append('slot', selectedSlot.start);
            const res = await fetch(CRM_BOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString(),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Booking failed');
            setConfirmed(data);
            setStatus('done');
        } catch (err) {
            setErrorMsg(err.message || '');
            setStatus('error');
        }
    };

    return (
        <div className="multi-step-page">
            <SEO
                title="Book an Appointment"
                description="Book a call with a Boxx Finance advisor at a time that suits you."
                noIndex={true}
            />

            <div className="service-hero">
                <h1>Book an <span className="text-highlight">Appointment</span></h1>
                <p className="progress-hero-subtitle">Pick a time that suits you — one of our advisors will call you then.</p>
            </div>

            <div className="service-layout single-column">
                <div className="multi-step-container">
                    {status === 'done' ? (
                        <div>
                            <h2>You're booked in.</h2>
                            <p>
                                {confirmed?.advisor_name ? `${confirmed.advisor_name} will call you` : "We'll call you"}
                                {selectedSlot ? ` on ${new Date(selectedSlot.start).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}` : ''}.
                            </p>
                            <p>Reference: {confirmed?.reference}</p>
                        </div>
                    ) : slotsStatus === 'loading' ? (
                        <p>Loading available times…</p>
                    ) : slotsStatus === 'error' ? (
                        <p style={{ color: '#a3271f' }}>Couldn't load available times — please call <a href="tel:01236702070">01236 702070</a> instead.</p>
                    ) : !days.length ? (
                        <p>No appointment times are available right now — please call <a href="tel:01236702070">01236 702070</a> instead.</p>
                    ) : !selectedSlot ? (
                        <>
                            <h3 style={{ marginTop: 0 }}>Choose a day</h3>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                                {days.map((d) => (
                                    <button
                                        key={d.date}
                                        type="button"
                                        className={`btn ${d.date === selectedDate ? 'btn-primary' : 'btn-outline'}`}
                                        onClick={() => setSelectedDate(d.date)}
                                    >
                                        {DAY_LABEL.format(new Date(d.date + 'T00:00:00'))}
                                    </button>
                                ))}
                            </div>
                            <h3>Choose a time</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '0.5rem' }}>
                                {activeDaySlots.map((s) => (
                                    <button key={s.start} type="button" className="btn btn-outline" onClick={() => setSelectedSlot(s)}>
                                        {s.time}
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : (
                        <form onSubmit={onConfirm}>
                            <p>
                                <strong>{DAY_LABEL.format(new Date(selectedSlot.date + 'T00:00:00'))} at {selectedSlot.time}</strong>{' '}
                                <button type="button" onClick={() => setSelectedSlot(null)} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', color: 'inherit', font: 'inherit', padding: 0 }}>Change</button>
                            </p>
                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Full name</label>
                                <input type="text" name="name" className="quiz-input" required value={form.name} onChange={onChange} />
                            </div>
                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Email</label>
                                <input type="email" name="email" className="quiz-input" required value={form.email} onChange={onChange} />
                            </div>
                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Phone</label>
                                <input type="tel" name="phone" className="quiz-input" required value={form.phone} onChange={onChange} />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={status === 'sending'} style={{ width: '100%', marginTop: '1rem' }}>
                                {status === 'sending' ? 'Booking…' : 'Confirm booking'}
                            </button>
                            {status === 'error' && (
                                <p style={{ color: '#a3271f', marginTop: '0.75rem' }}>
                                    {errorMsg || 'Something went wrong.'} — try another time, or call <a href="tel:01236702070">01236 702070</a>.
                                </p>
                            )}
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BookAppointment;
