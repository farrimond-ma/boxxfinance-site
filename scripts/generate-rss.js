import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Handling __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the posts from JSON
const loadPosts = async () => {
    const filePath = path.join(__dirname, '../src/data/blogPosts.json');
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
};

const generateRSS = async () => {
    try {
        const posts = await loadPosts();

        // Filter out drafts or unpublished posts, and sort by date descending
        const publishedPosts = posts
            .filter(post => post.status === 'published' || (post.publishDate && new Date(post.publishDate) <= new Date()))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const siteUrl = 'https://www.boxxfinance.co.uk';

        const rssItems = publishedPosts.map(post => {
            const url = `${siteUrl}/insights/${post.slug}`;
            const date = new Date(post.date).toUTCString();

            // Clean up excerpt for XML (escape special characters)
            const cleanExcerpt = post.excerpt
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');

            const cleanTitle = post.title
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');

            return `
        <item>
            <title>${cleanTitle}</title>
            <link>${url}</link>
            <guid>${url}</guid>
            <pubDate>${date}</pubDate>
            <description>${cleanExcerpt}</description>
            ${post.author ? `<author>${post.authorEmail || 'info@boxxfinance.co.uk'} (${post.author})</author>` : ''}
        </item>`;
        }).join('');

        const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
    <channel>
        <title>Boxx Commercial Finance Insights</title>
        <link>${siteUrl}</link>
        <description>Commercial finance insights and funding intelligence for UK business owners.</description>
        <language>en-gb</language>
        <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
        ${rssItems}
    </channel>
</rss>`;

        // Output to both public and dist directories
        const publicPath = path.resolve(__dirname, '../public/rss.xml');
        const distPath = path.resolve(__dirname, '../dist/rss.xml');
        fs.writeFileSync(publicPath, rss);

        try {
            if (fs.existsSync(path.resolve(__dirname, '../dist'))) {
                fs.writeFileSync(distPath, rss);
            }
        } catch (e) {
            console.warn('Could not write to dist folder. Continuing...');
        }

        console.log(`✅ RSS feed generated at: ${publicPath} & ${distPath}`);
    } catch (error) {
        console.error('❌ Error generating RSS feed:', error);
        process.exit(1);
    }
};

generateRSS();
