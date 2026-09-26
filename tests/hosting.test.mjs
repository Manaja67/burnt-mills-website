import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {hosting} from '../server/hosting.mjs';
const root=resolve('test-app'),outside=resolve('test-private');
test('permanent HTTPS requires exact origin and private persistent data',()=>{
 const env={BM_DEPLOYMENT:'production',BM_PUBLIC_ORIGIN:'https://app.example.com',BM_DATA_DIR:outside};
 assert.equal(hosting(env,root).production,true);
 assert.equal(hosting(env,root,Date.now()+90*86400000).production,true);
 for(const patch of [{BM_PUBLIC_ORIGIN:''},{BM_PUBLIC_ORIGIN:'http://app.example.com'},{BM_PUBLIC_ORIGIN:'https://app.example.com/'},{BM_DATA_DIR:root},{BM_DATA_DIR:resolve(root,'public','data')},{BM_DATA_DIR:'relative-data'},{BM_DEMO_UNTIL:new Date().toISOString()}])assert.throws(()=>hosting({...env,...patch},root));
});
test('temporary previews still expire and local startup is unchanged',()=>{
 assert.equal(hosting({},root).origin,null);
 const now=Date.now(),env={BM_PUBLIC_ORIGIN:'https://preview.example.com',BM_DATA_DIR:outside,BM_DEMO_UNTIL:new Date(now+3600000).toISOString()};
 assert.equal(hosting(env,root,now).production,false);
 assert.throws(()=>hosting(env,root,now+7200000));
 assert.throws(()=>hosting({...env,BM_DEMO_UNTIL:''},root));
});
