import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { issueDeletionClearance } from './verify.js';

const PROJECT_ID = 'mygymlog-604bc';
const OWNER_EMAIL = 'ctom40101@gmail.com';
const args = process.argv.slice(2);
const value = flag => args[args.indexOf(flag) + 1];
const uid = value('--uid');
const email = value('--email');
const commit = args.includes('--commit');

if (!uid || !email || args.some(arg => !['--uid', '--email', '--commit', uid, email].includes(arg))) {
  process.stderr.write('Usage: node tools/deletion-clearance/main.js --uid <target UID> --email <target email> [--commit]\n');
  process.exitCode = 2;
} else {
  try {
    // The token stays in this process. Use only after the Final Release Human Gate.
    const token = execFileSync(process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud',
      ['auth', 'print-access-token', OWNER_EMAIL], { encoding: 'utf8', shell: process.platform === 'win32' }).trim();
    const result = await issueDeletionClearance({ projectId: PROJECT_ID, uid, email, token, commit });
    process.stdout.write(`${result.issued ? 'Clearance issued' : 'Inventory empty; dry run only'}; request update time ${result.requestUpdateTime}\n`);
  } catch {
    process.stderr.write('Deletion inventory or clearance failed. Auth deletion remains blocked; inspect the target and credentials.\n');
    process.exitCode = 1;
  }
}
