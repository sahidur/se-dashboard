#!/usr/bin/env node
// Explicit, dry-run-by-default ACL migration. Run with Node 24 --env-file.
const { createRequire } = require('node:module');
const path = require('node:path');
const requireBackend = createRequire(path.resolve(__dirname, '../backend/package.json'));
const {
  S3Client, ListObjectsV2Command, GetObjectAclCommand, PutObjectAclCommand,
} = requireBackend('@aws-sdk/client-s3');

async function main() {
  const { S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_FOLDER, S3_ACCESS_KEY, S3_SECRET_KEY } = process.env;
  const prefix = `${S3_FOLDER}/`;
  if (!S3_ACCESS_KEY || !S3_SECRET_KEY || !S3_BUCKET ||
      !/^[a-z0-9][a-z0-9.-]*$/.test(S3_BUCKET) ||
      !S3_REGION || !S3_ENDPOINT ||
      !/^https:\/\/[a-z0-9.-]+\.digitaloceanspaces\.com\/?$/.test(S3_ENDPOINT) ||
      !S3_FOLDER || !/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(S3_FOLDER)) {
    throw new Error('Set valid S3_ENDPOINT (HTTPS Spaces origin), S3_REGION, S3_BUCKET, S3_FOLDER and S3 credentials');
  }
  const args = process.argv.slice(2);
  const apply = args.length === 2 && args[0] === '--apply' && args[1] === `${S3_BUCKET}/${prefix}`;
  if (args.length && !apply) throw new Error(`To apply, pass --apply ${S3_BUCKET}/${prefix}`);
  const s3 = new S3Client({ endpoint: S3_ENDPOINT, region: S3_REGION,
    credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY } });
  let token;
  let inspected = 0;
  let changed = 0;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: S3_BUCKET, Prefix: prefix, ContinuationToken: token }));
    for (const { Key: key } of page.Contents || []) {
      if (!key || !key.startsWith(prefix) || key.endsWith('/')) continue;
      inspected++;
      const acl = await s3.send(new GetObjectAclCommand({ Bucket: S3_BUCKET, Key: key }));
      const isPublic = acl.Grants?.some(({ Grantee, Permission }) =>
        Permission !== 'NONE' && /\/((AllUsers)|(AuthenticatedUsers))$/.test(Grantee?.URI || ''));
      if (!isPublic) continue;
      changed++;
      console.log(`${apply ? 'privatizing' : 'would privatize'} ${key}`);
      if (apply) await s3.send(new PutObjectAclCommand({ Bucket: S3_BUCKET, Key: key, ACL: 'private' }));
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
    if (page.IsTruncated && !token) throw new Error('Truncated listing without continuation token');
  } while (token);
  console.log(`${apply ? 'Completed' : 'Dry run'}: inspected ${inspected}, public ACLs ${changed}`);
  console.log('Check bucket policy, CDN caches, and object URLs separately; ACL changes cannot override a public bucket policy.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
