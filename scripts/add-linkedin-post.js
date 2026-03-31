import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the linkedinPosts.js file
const POSTS_FILE_PATH = path.resolve(__dirname, '../src/data/linkedinPosts.json');

/**
 * Adds a new post to the linkedinPosts.json file.
 */
function addLinkedInPost(postData) {
  try {
    // 1. Prepare the new post object
    const date = postData.date || new Date().toISOString().split('T')[0];
    const id = postData.slug;

    const newPost = {
      id: id,
      status: postData.status || 'published',
      title: postData.title,
      slug: postData.slug,
      date: date,
      content: postData.content.trim()
    };

    // 2. Read the existing file
    let posts = [];
    if (fs.existsSync(POSTS_FILE_PATH)) {
      const fileContent = fs.readFileSync(POSTS_FILE_PATH, 'utf8');
      posts = JSON.parse(fileContent);
    }

    // 3. Add the new post
    posts.push(newPost);

    // 4. Write back to the file
    fs.writeFileSync(POSTS_FILE_PATH, JSON.stringify(posts, null, 2), 'utf8');

    console.log(`✅ Successfully added new post: "${postData.title}" to linkedinPosts.json`);
    console.log(`Don't forget to run 'npm run rss-linkedin' to update the XML feed!`);

  } catch (error) {
    console.error('❌ Error modifying the file:', error);
  }
}

// ==========================================
// EXAMPLE USAGE:
// To use this script, you can simply call the function with your new content.
// You could even wire this up to read from a Markdown file or an API!
// ==========================================

/* 
// UNCOMMENT THIS BLOCK TO TEST ADDING A POST
addLinkedInPost({
  title: "A Brand New LinkedIn Post Example",
  slug: "brand-new-linkedin-post-example",
  content: "<p>This is a test post added via the automation script.</p><p>It automatically handles the formatting and appends it to the array!</p>"
});
*/
