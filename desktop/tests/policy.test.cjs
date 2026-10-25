'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PRODUCTION_URL, commandUrl, isCommandUrl, isExternalUrl, shellAsset, canNotify, canSaveActivityLog, windowBounds } = require('../policy.cjs');
test('installed apps cannot be redirected to an arbitrary service by command-line flags', () => {
  assert.equal(commandUrl(['--dev-url','https://evil.example'],true),PRODUCTION_URL);
  assert.equal(commandUrl(['--dev-url','http://127.0.0.1:4173'],false),'http://127.0.0.1:4173/');
  for(const url of ['https://evil.example','http://127.0.0.1.evil.example/','file:///C:/secret','http://user:pass@localhost']) assert.throws(()=>commandUrl(['--dev-url',url],false));
});
test('in-app navigation stays on the official command-center route', () => {
  assert.equal(isCommandUrl(PRODUCTION_URL),true);
  assert.equal(isCommandUrl(PRODUCTION_URL+'#live'),true);
  for(const url of ['https://ews-kappa.vercel.app.evil.example/','https://ews-kappa.vercel.app@evil.example/','https://user@ews-kappa.vercel.app/','http://ews-kappa.vercel.app/','https://ews-kappa.vercel.app/api/state',PRODUCTION_URL+'#/public', 'javascript:alert(1)']) assert.equal(isCommandUrl(url),false,url);
});
test('external links never execute local files or operating-system protocols', () => {
  assert.equal(isExternalUrl(PRODUCTION_URL+'#/public'),true);
  for(const url of ['file:///C:/test.exe','ms-settings:','data:text/html,hi','javascript:alert(1)','https://u:p@example.com/','http://example.com']) assert.equal(isExternalUrl(url),false,url);
});
test('local protocol exposes only four exact public assets', () => {
  assert.equal(shellAsset('tanoviq://desktop/'),'shell/index.html');
  assert.equal(shellAsset('tanoviq://desktop/logo.png'),'assets/tanoviq-dark.png');
  for(const url of ['tanoviq://desktop/../main.cjs','tanoviq://desktop/%2e%2e/main.cjs','tanoviq://desktop/package.json','tanoviq://evil/','tanoviq://desktop/logo.png?file=secret','tanoviq://u@desktop/']) assert.equal(shellAsset(url),null,url);
});
test('permissions are confined to notifications for the trusted service', () => {
  assert.equal(canNotify('notifications','https://ews-kappa.vercel.app'),true);
  for(const permission of ['media','geolocation','clipboard-read','display-capture','midiSysex']) assert.equal(canNotify(permission,'https://ews-kappa.vercel.app'),false);
  assert.equal(canNotify('notifications','https://evil.example'),false);
});
test('disconnected-monitor bounds are restored to an accessible display', () => {
  const areas=[{x:0,y:0,width:1920,height:1080}];
  assert.deepEqual(windowBounds({x:3000,y:-900,width:1440,height:900},areas),{x:240,y:90,width:1440,height:900});
  assert.equal(windowBounds({width:10000,height:10000},areas).width,1920);
});

test('desktop exports accept only bounded CSV log blobs from the command-center origin', () => {
  const good={url:'blob:https://ews-kappa.vercel.app/0ac17d89-194a-4c01-b393-cf69d9277ffb',filename:'TANOVIQ-activity-logs-2026-10-25.csv',mimeType:'text/csv;charset=utf-8',bytes:2048,pageUrl:PRODUCTION_URL};
  assert.equal(canSaveActivityLog(good),true);
  assert.equal(canSaveActivityLog({...good,filename:'TANOVIQ-demo-logs-2026-10-25.csv'}),true);
  for(const change of [{url:'https://ews-kappa.vercel.app/report.csv'},{url:'blob:https://evil.example/id'},{url:'file:///C:/secret.csv'},{filename:'report.exe'},{filename:'../TANOVIQ-activity-logs-2026-10-25.csv'},{mimeType:'application/octet-stream'},{bytes:3000000},{bytes:-1},{pageUrl:PRODUCTION_URL+'#/public'}])assert.equal(canSaveActivityLog({...good,...change}),false,JSON.stringify(change));
});
