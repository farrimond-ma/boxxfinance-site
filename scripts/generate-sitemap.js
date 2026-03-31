import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BASE_URL = 'https://boxxfinance.co.uk';
const OUTPUT_FILE = path.join(__dirname, '../public/sitemap.xml');

// Static Routes
const staticRoutes = [
    '/',
    '/insights',
    '/chat-about-funding',
    '/uk-sme-funding-index',
    '/privacy-policy',
    '/legal-disclaimer',
    '/terms-and-conditions',
];

// Helper to read file content
const readFile = (filePath) => {
    return fs.readFileSync(path.join(__dirname, filePath), 'utf8');
};

// Extract Service Slugs (Regex to avoid JSX parsing)
const getServiceSlugs = () => {
    const serviceContent = readFile('../src/data/services.jsx');
    const slugs = [];
    const lines = serviceContent.split('\n');
    let insideObject = false;

    for (const line of lines) {
        if (line.includes('export const serviceContent = {')) {
            insideObject = true;
            continue;
        }
        if (insideObject && line.trim() === '};') {
            insideObject = false;
            break;
        }

        if (insideObject) {
            const match = line.match(/^ {4}['"]?([a-zA-Z0-9-]+)['"]?:\s*\{/);
            if (match) {
                slugs.push(match[1]);
            }
        }
    }
    return slugs;
};

// Extract Blog Slugs
const getBlogSlugs = () => {
    try {
        const content = readFile('../src/data/blogPosts.json');
        const blogPosts = JSON.parse(content);
        const slugs = [];
        const now = new Date();

        for (const post of blogPosts) {
            if (post.status === 'published' || (post.publishDate && new Date(post.publishDate) <= now)) {
                if (post.slug) slugs.push(post.slug);
            }
        }
        return slugs;
    } catch (error) {
        console.error('Error reading blogPosts.json:', error);
        return [];
    }
};

// Extract SME Funding Archives
const getSmeFundingArchiveSlugs = () => {
    try {
        const content = readFile('../src/data/smeFundingData.json');
        const smeData = JSON.parse(content);
        return smeData.map(item => item.slug).filter(slug => slug !== 'latest');
    } catch (e) {
        console.warn('Could not read smeFundingData.json', e);
        return [];
    }
};

const generateSitemap = () => {
    console.log('Generating sitemap...');

    const services = getServiceSlugs();
    const blogs = getBlogSlugs();
    const smeArchives = getSmeFundingArchiveSlugs();

    console.log(`Found ${services.length} services`);
    console.log(`Found ${blogs.length} blog posts`);
    console.log(`Found ${smeArchives.length} SME Funding Archives`);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

    // Add Static Routes
    staticRoutes.forEach(route => {
        xml += `  <url>
    <loc>${BASE_URL}${route}</loc>
    <changefreq>weekly</changefreq>
    <priority>${route === '/' ? '1.0' : '0.8'}</priority>
  </url>
`;
    });

    // Add Services
    services.forEach(slug => {
        xml += `  <url>
    <loc>${BASE_URL}/funding-solutions/${slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
    });

    // Add Blog Posts
    blogs.forEach(slug => {
        xml += `  <url>
    <loc>${BASE_URL}/insights/${slug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
`;
    });

    // Add SME Funding Archives
    smeArchives.forEach(slug => {
        xml += `  <url>
    <loc>${BASE_URL}/uk-sme-funding-index/${slug}</loc>
    <changefreq>yearly</changefreq>
    <priority>0.5</priority>
  </url>
`;
    });

    xml += `</urlset>`;

    fs.writeFileSync(OUTPUT_FILE, xml);
    try {
        if (fs.existsSync(path.resolve(__dirname, '../dist'))) {
            fs.writeFileSync(path.resolve(__dirname, '../dist/sitemap.xml'), xml);
        }
    } catch (e) {
        // ignore
    }
    console.log(`Sitemap generated at: ${OUTPUT_FILE}`);
};

try {
    generateSitemap();
} catch (error) {
    console.error('Error generating sitemap:', error);
    process.exit(1);
}
