import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useChatWidget } from './ChatWidgetContext';

// CRM's existing token-lookup endpoint (same one "Progress Your Application" links use to
// resolve ?t=... to a name) — reused here rather than adding a second lookup endpoint.
const CRM_LOOKUP_URL = 'https://crm.boxxfinance.co.uk/lookup.php';

// Watches every route for a re-engagement text link (?t=<token>&a=yes|no — see reengage.php in
// the CRM) and opens the AI chat pre-seeded with the visitor's name and answer. Rendered once
// inside ChatWidgetProvider (see Layout.jsx) so it works regardless of which page the link
// actually points at.
const ReengageOpener = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { openChatWithSeed } = useChatWidget();
    const handled = useRef(false);

    useEffect(() => {
        if (handled.current) return;
        const params = new URLSearchParams(location.search);
        const token = params.get('t');
        const answer = params.get('a');
        if (!token || (answer !== 'yes' && answer !== 'no')) return;
        handled.current = true;

        // Strip ?t=&a= from the visible URL immediately so a refresh/share doesn't re-trigger or
        // leak the token, whether or not the lookup below succeeds.
        params.delete('t');
        params.delete('a');
        const cleanSearch = params.toString();
        navigate({ pathname: location.pathname, search: cleanSearch ? `?${cleanSearch}` : '' }, { replace: true });

        fetch(`${CRM_LOOKUP_URL}?t=${encodeURIComponent(token)}`)
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((data) => {
                openChatWithSeed({ name: data.ok ? data.full_name || '' : '', answer });
            })
            .catch(() => openChatWithSeed({ name: '', answer }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search]);

    return null;
};

export default ReengageOpener;
