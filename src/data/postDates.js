// When a post actually went live, as opposed to when it was scheduled.
//
// `post.date` comes from the ContentEngine schedule row, so for the bridging
// pipeline it is the date the post was PLANNED for, not the date it appeared.
// The schedule has been running behind, so 55 of 93 published posts carry a
// date up to 12 days earlier than their real publication — which sorted
// today's long-form post below yesterday's news, and misreported
// datePublished to Google.
//
// `publishedAt` is written by the publishers at the moment of publication, so
// it is the truthful value where it exists. Older posts predate it and fall
// back to `date`.
//
// Deliberately derived at the point of use rather than by rewriting `date`:
// the content engine still uses that field for scheduling, so changing it
// would break the thing that sets it.
export const publishedAtOf = (post) => (post && (post.publishedAt || post.date)) || null;

// Newest first. Falls back gracefully when a post has neither field.
export const byNewestFirst = (a, b) => {
    const ta = new Date(publishedAtOf(a) || 0).getTime();
    const tb = new Date(publishedAtOf(b) || 0).getTime();
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
};
