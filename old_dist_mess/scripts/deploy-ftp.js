import FtpDeploy from 'ftp-deploy';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.ftp') });

const ftpDeploy = new FtpDeploy();

const config = {
    user: process.env.FTP_USER,
    password: process.env.FTP_PASSWORD,
    host: process.env.FTP_HOST,
    port: parseInt(process.env.FTP_PORT || '21'),
    localRoot: join(__dirname, '../'),
    remoteRoot: process.env.FTP_REMOTE_DIR || 'public_html/',
    include: ["*", "**/*"],
    exclude: [
        ".git/**",
        ".github/**",
        "node_modules/**",
        "scripts/**",
        ".env.ftp",
        "package.json",
        "package-lock.json",
        "vite.config.js",
        "eslint.config.js",
        ".gitignore",
        "*.bat",
        "*.ps1",
        "README.md",
        ".ftp-deploy-sync-state.json"
    ],
    deleteRemote: false,
    forcePasv: true
};

console.log('🚀 Starting deployment to:', config.host);
console.log('📂 Remote directory:', config.remoteRoot);

ftpDeploy
    .deploy(config)
    .then((res) => console.log('✅ Finished deployment! uploaded', res.length, 'files'))
    .catch((err) => {
        console.error('❌ Deployment error:', err.message);
        process.exit(1);
    });

ftpDeploy.on('uploading', function (data) {
    console.log('Uploading:', data.transferredFileCount, '/', data.totalFilesCount, '->', data.filename);
});
