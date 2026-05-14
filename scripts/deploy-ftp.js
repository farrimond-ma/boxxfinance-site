import dotenv from 'dotenv';
import FtpDeploy from 'ftp-deploy';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '../.env.ftp') });

const ftpDeploy = new FtpDeploy();

const config = {
    user: process.env.FTP_USER,
    password: process.env.FTP_PASSWORD,
    host: process.env.FTP_HOST,
    port: parseInt(process.env.FTP_PORT || '21'),
    localRoot: path.join(__dirname, '../dist'),
    remoteRoot: process.env.FTP_REMOTE_DIR || '/',
    include: ['*', '**/*'],
    exclude: [],
    deleteRemote: false,
    forcePasv: true,
    sftp: false,
};

console.log(`\n🚀 Deploying to ${config.host}${config.remoteRoot} ...`);

ftpDeploy
    .deploy(config)
    .then(res => {
        console.log(`✅ Deploy complete — ${res.length} files uploaded.\n`);
    })
    .catch(err => {
        console.error('❌ FTP deploy failed:', err);
        process.exit(1);
    });

ftpDeploy.on('uploading', ({ filename, transferredFileCount, totalFilesCount }) => {
    process.stdout.write(`   [${transferredFileCount}/${totalFilesCount}] ${filename}\r`);
});
