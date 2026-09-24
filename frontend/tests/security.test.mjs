import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearLegacyDrafts, escapeCsvCell, isApiRequestUrl, safeSpreadsheetCell } from '../src/lib/security.ts';
import { resolveAssetUrl } from '../src/lib/utils.ts';

test('credentialed API calls cannot override the API base or target another origin', () => {
  const base = 'https://app.example.org/api';
  for (const url of ['//evil.example/collect', 'https://evil.example/collect',
    '/\\evil.example/collect', 'javascript:alert(1)', '/api/../logout']) {
    assert.equal(isApiRequestUrl(url, base), false, url);
  }
  assert.equal(isApiRequestUrl('/users/me', base), true);
  assert.equal(isApiRequestUrl('/api/users/me', base), true);
  assert.equal(isApiRequestUrl('/api/users/me', base, 'https://evil.example/api'), false);
  assert.equal(isApiRequestUrl('/api/files/upload?folder=x', base, base), true);
});

test('stored asset URLs route Spaces objects through the authenticated API', () => {
  const previous = process.env.NEXT_PUBLIC_API_URL;
  process.env.NEXT_PUBLIC_API_URL = 'https://app.example.org/api';
  try {
    assert.equal(resolveAssetUrl('/api/uploads/photo.png?x-sig=abc'), 'https://app.example.org/api/uploads/photo.png?x-sig=abc');
    assert.equal(resolveAssetUrl('https://localhost:4000/uploads/photo.png'), 'https://app.example.org/api/uploads/photo.png');
    assert.equal(resolveAssetUrl('https://bucket.nyc3.digitaloceanspaces.com/bep-se/uploads/photo.png'), 'https://app.example.org/api/files/object?key=bep-se%2Fuploads%2Fphoto.png');
    assert.equal(resolveAssetUrl('/api/files/object?key=bep-se%2Fuploads%2Fphoto.png'), 'https://app.example.org/api/files/object?key=bep-se%2Fuploads%2Fphoto.png');
    for (const url of ['javascript:alert(1)', 'data:text/html,hello', '//evil.example/img',
      'https://digitaloceanspaces.com.evil.example/a', 'https://evil.example/a',
      '/api/other', '/api/uploads/../users/me', 'https://bucket.nyc3.digitaloceanspaces.com/other/photo.png']) {
      assert.equal(resolveAssetUrl(url), '', url);
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = previous;
  }
});

test('logout removes only the current user\'s legacy offline drafts', () => {
  const data = new Map([['dc-draft:alice:school:form', 'private'],
    ['dc-draft:bob:school:form', 'other'], ['se360-sidebar-collapsed', '1']]);
  const storage = {
    get length() { return data.size; },
    key(i) { return [...data.keys()][i] ?? null; },
    removeItem(key) { data.delete(key); },
  };
  clearLegacyDrafts(storage, 'alice');
  assert.deepEqual([...data.keys()], ['dc-draft:bob:school:form', 'se360-sidebar-collapsed']);
});

test('CSV cells that spreadsheet apps treat as formulas become inert', () => {
  for (const value of ['=WEBSERVICE("https://evil")', ' +1', '\t=1+1', '\r=1+1', '@SUM(A1)', '-2+3']) {
    assert.ok(escapeCsvCell(value).startsWith("\"'") || escapeCsvCell(value).startsWith("'"), value);
    assert.ok(safeSpreadsheetCell(value).startsWith("'"), value);
  }
  assert.equal(escapeCsvCell('-42.5'), '-42.5');
  assert.equal(escapeCsvCell('plain,text'), '"plain,text"');
});
