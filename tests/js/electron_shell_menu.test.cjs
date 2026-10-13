const test = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const {attachShellMenu, menuSnapshot} = require('../../electron/shell-menu');

function fixture() {
  const handlers = {}, popups = [], clicks = [], logs = [], closed = [], messages = [];
  let pointer = {x: 0, y: 0};
  const menu = {items:[
    {label:'File',enabled:true,visible:true,submenu:{
      popup: options => popups.push(options), closePopup: () => closed.push(0)}},
    {label:'< Back',enabled:true,click:(item, win)=>clicks.push({item, win})},
    {label:'Forward >',enabled:false},
    {label:'Hidden',visible:false},
    {label:'Edit',enabled:true,submenu:{
      popup: options => popups.push(options), closePopup: () => closed.push(4)}},
  ]};
  const frame = {url:'http://127.0.0.1:5000/preferences'};
  const win = new EventEmitter();
  win.webContents = Object.assign(new EventEmitter(), {
    mainFrame:frame,ipc:Object.assign(new EventEmitter(), {
      handle:(name, handler)=>{handlers[name]=handler;},
    }),
    getZoomFactor:()=>1.25,send:(...value)=>messages.push(value),
    isDestroyed:()=>false,
  });
  win.isDestroyed = () => false;
  win.focus = () => { win.focused = true; };
  win.getContentBounds = () => ({x:100, y:200});
  attachShellMenu(win,5000,()=>menu,message=>logs.push(message),()=>pointer);
  return {handlers,popups,clicks,logs,win,menu,frame,closed,messages,
    move: point => {pointer = point;},
    call:(channel,value,senderFrame=frame)=>handlers[channel]({senderFrame},value)};
}

test('menu snapshot preserves native order, top-level actions and disabled state', () => {
  const h=fixture();
  assert.deepEqual(h.call('shell:menu-list'),{items:menuSnapshot(h.menu)});
  assert.equal(h.call('shell:menu-list').items[2].enabled,false);
  assert.equal(h.call('shell:menu-list').items[0].submenu,true);
  assert.equal(h.call('shell:menu-list').items[3].visible,false);
});

test('first-paint menu snapshot is synchronous and uses the same sender guards', () => {
  const h = fixture();
  const event = {senderFrame:h.frame};
  h.win.webContents.ipc.emit('shell:menu-initial',event);
  assert.deepEqual(event.returnValue,{items:menuSnapshot(h.menu)});
  const untrusted = {senderFrame:{url:h.frame.url}};
  h.win.webContents.ipc.emit('shell:menu-initial',untrusted);
  assert.ok(untrusted.returnValue.error);
});

test('strip opens the existing native popup with zoom-correct coordinates and owning window', () => {
  const h=fixture();
  assert.deepEqual(h.call('shell:menu-open',{index:0,x:12,y:60}),{success:true});
  assert.equal(h.popups[0].window,h.win);
  assert.equal(h.popups[0].x,15);
  assert.equal(h.popups[0].y,75);
  assert.equal(typeof h.popups[0].callback,'function');
  assert.equal(h.win.focused,true);
  assert.equal(h.clicks.length,0);
});

const rects = [
  {index:0,left:0,right:40,top:32,bottom:60},
  {index:4,left:40,right:80,top:32,bottom:60},
];

test('clicking a top-level heading closes an expanded menu without reopening it', t => {
  t.mock.timers.enable({apis:['setInterval']});
  for (const index of [0,4]) {
    const h = fixture();
    h.call('shell:menu-open',{index:0,x:0,y:60,rects,toggle:true});
    assert.deepEqual(h.call('shell:menu-open',{index,x:0,y:60,rects,toggle:true}),
      {success:true});
    assert.equal(h.popups.length,1);
    assert.deepEqual(h.closed,[0]);
    assert.deepEqual(h.messages.at(-1),['shell:menu-active',null]);
    h.popups[0].callback();
    h.move({x:160,y:250});
    t.mock.timers.tick(100);
    assert.equal(h.popups.length,1);
  }
});

test('keyboard opening is not converted into click-to-collapse behavior', () => {
  const h = fixture();
  h.call('shell:menu-open',{index:0,x:0,y:60,toggle:true});
  h.call('shell:menu-open',{index:4,x:40,y:60,toggle:false});
  assert.equal(h.popups.length,2);
  assert.deepEqual(h.messages.at(-1),['shell:menu-active',4]);
  h.popups[1].callback();
});

test('native dismissal consumes the replayed press and release but not the next click', t => {
  t.mock.timers.enable({apis:['setInterval']});
  const h = fixture();
  h.call('shell:menu-open',{index:0,x:0,y:60,rects});
  h.move({x:110,y:250});
  h.popups[0].callback();
  const prevented = [];
  for (const type of ['mouseDown','mouseUp','mouseDown']) {
    let stopped = false;
    h.win.webContents.emit('before-mouse-event',{preventDefault:()=>{stopped=true;}},
      {type,button:'left',x:10,y:50});
    prevented.push(stopped);
  }
  assert.deepEqual(prevented,[true,true,false]);
});

test('Escape dismissal does not suppress the next legitimate heading click', t => {
  t.mock.timers.enable({apis:['setInterval']});
  const h = fixture();
  h.call('shell:menu-open',{index:0,x:0,y:60,rects});
  h.move({x:110,y:250});
  h.popups[0].callback();
  h.win.webContents.emit('before-input-event',{}, {type:'keyUp',key:'Escape'});
  let stopped = false;
  h.win.webContents.emit('before-mouse-event',{preventDefault:()=>{stopped=true;}},
    {type:'mouseDown',button:'left',x:10,y:50});
  assert.equal(stopped,false);
});

test('a dismissal replay guard does not consume clicks elsewhere in the page', t => {
  t.mock.timers.enable({apis:['setInterval']});
  const h = fixture();
  h.call('shell:menu-open',{index:0,x:0,y:60,rects});
  h.move({x:110,y:250});
  h.popups[0].callback();
  let stopped = false;
  h.win.webContents.emit('before-mouse-event',{preventDefault:()=>{stopped=true;}},
    {type:'mouseDown',button:'left',x:100,y:200});
  assert.equal(stopped,false);
});

test('hovering another heading switches on the next tick without a hover dwell', t => {
  t.mock.timers.enable({apis:['setInterval']});
  const h = fixture();
  h.call('shell:menu-open',{index:0,x:0,y:60,rects});
  h.move({x:160,y:250});
  assert.equal(h.popups.length,1);
  t.mock.timers.tick(1);
  assert.equal(h.popups.length,2);
  assert.deepEqual(h.closed,[0]);
  assert.equal(h.popups[1].x,50);
  assert.equal(h.popups[1].y,75);
  assert.deepEqual(h.messages.at(-1),['shell:menu-active',4]);
  h.popups[0].callback();
  h.move({x:110,y:250});
  t.mock.timers.tick(1);
  assert.equal(h.popups.length,3);
  assert.deepEqual(h.closed,[0,4]);
  assert.deepEqual(h.messages.map(([,index])=>index),[0,4,0]);
  h.popups[2].callback();
  h.move({x:160,y:250});
  t.mock.timers.tick(100);
  assert.equal(h.popups.length,3);
  assert.deepEqual(h.messages.at(-1),['shell:menu-active',null]);
});

test('hovering outside the strip, the current heading, or disabled menus does not switch', t => {
  t.mock.timers.enable({apis:['setInterval']});
  const h = fixture();
  h.call('shell:menu-open',{index:0,x:0,y:60,rects});
  for (const point of [{x:110,y:250},{x:160,y:290},{x:500,y:250}]) {
    h.move(point);
    t.mock.timers.tick(50);
  }
  h.menu.items[4].enabled = false;
  h.move({x:160,y:250});
  t.mock.timers.tick(50);
  assert.equal(h.popups.length,1);
  h.win.emit('closed');
  t.mock.timers.tick(100);
  assert.deepEqual(h.closed,[0]);
  assert.equal(h.popups.length,1);
});

test('main-frame navigation ends hover tracking without closing on subframe navigation', t => {
  t.mock.timers.enable({apis:['setInterval']});
  const h = fixture();
  h.call('shell:menu-open',{index:0,x:0,y:60,rects});
  h.win.webContents.emit('did-start-navigation',{},'about:blank',false,false);
  assert.equal(h.closed.length,0);
  h.win.webContents.emit('did-start-navigation',{},h.frame.url,false,true);
  assert.deepEqual(h.closed,[0]);
  h.move({x:160,y:250});
  t.mock.timers.tick(100);
  assert.equal(h.popups.length,1);
});

test('hover popup failures report an error and end tracking', t => {
  t.mock.timers.enable({apis:['setInterval']});
  const h = fixture();
  h.call('shell:menu-open',{index:0,x:0,y:60,rects});
  h.menu.items[4].submenu.popup = () => { throw new Error('native switch failed'); };
  h.move({x:160,y:250});
  t.mock.timers.tick(50);
  assert.match(h.logs.at(-1),/native switch failed/);
  assert.equal(h.messages.at(-1)[0],'shell:menu-error');
  t.mock.timers.tick(100);
  assert.equal(h.popups.length,1);
});

test('destroying the owning window stops hover tracking without touching native chrome', t => {
  t.mock.timers.enable({apis:['setInterval']});
  const h = fixture();
  h.call('shell:menu-open',{index:0,x:0,y:60,rects});
  h.win.isDestroyed = () => true;
  h.win.emit('closed');
  h.move({x:160,y:250});
  t.mock.timers.tick(100);
  assert.equal(h.popups.length,1);
  assert.equal(h.closed.length,0);
});

test('popup callback during web-content teardown cannot send to a destroyed renderer', t => {
  t.mock.timers.enable({apis:['setInterval']});
  const h = fixture();
  h.call('shell:menu-open',{index:0,x:0,y:60,rects});
  h.win.webContents.isDestroyed = () => true;
  h.win.webContents.send = () => { throw new Error('Object has been destroyed'); };
  assert.doesNotThrow(() => h.popups[0].callback());
  h.move({x:160,y:250});
  t.mock.timers.tick(100);
  assert.equal(h.popups.length,1);
});

test('web-content destruction ends hover tracking before the window is destroyed', t => {
  t.mock.timers.enable({apis:['setInterval']});
  const h = fixture();
  h.call('shell:menu-open',{index:0,x:0,y:60,rects});
  h.win.webContents.isDestroyed = () => true;
  h.win.webContents.send = () => { throw new Error('Object has been destroyed'); };
  assert.doesNotThrow(() => h.win.webContents.emit('destroyed'));
  assert.doesNotThrow(() => h.popups[0].callback());
  t.mock.timers.tick(100);
  assert.equal(h.closed.length,0);
});

test('malformed heading geometry is rejected before opening a native menu', () => {
  const h = fixture();
  for (const bad of [null,{},[{...rects[0],index:1}],
    [{...rects[0],right:0}],[{...rects[0],top:NaN}],
    [{...rects[0],left:-1}],[{...rects[0],bottom:10001}]]) {
    assert.ok(h.call('shell:menu-open',{index:0,x:0,y:60,rects:bad}).error);
  }
  assert.equal(h.popups.length,0);
});

test('Back executes its existing callback rather than duplicating navigation', () => {
  const h=fixture();
  h.call('shell:menu-open',{index:1,x:200,y:60});
  assert.deepEqual(h.clicks,[{item:h.menu.items[1],win:h.win}]);
  assert.equal(h.popups.length,0);
});

test('disabled, hidden, malformed and out-of-range actions are rejected', () => {
  const h=fixture();
  for(const value of [null,{}, {index:2,x:0,y:0},{index:3,x:0,y:0},
    {index:99,x:0,y:0},{index:0,x:-1,y:0},{index:0,x:NaN,y:0},
    {index:0,x:0,y:10001},{index:'0',x:0,y:0},{index:0,x:0,y:0,toggle:'yes'}]) {
    assert.ok(h.call('shell:menu-open',value).error);
  }
  assert.equal(h.popups.length,0);
  assert.equal(h.clicks.length,0);
});

test('external documents and subframes cannot inspect or invoke privileged menu actions', () => {
  const h=fixture();
  for(const frame of [{url:h.frame.url},{url:'https://evil.example/'}]) {
    assert.ok(h.call('shell:menu-list',null,frame).error);
    assert.ok(h.call('shell:menu-open',{index:0,x:0,y:0},frame).error);
  }
  h.frame.url='http://localhost:5151/';
  assert.ok(h.call('shell:menu-open',{index:0,x:0,y:0}).error);
  assert.equal(h.popups.length,0);
  assert.equal(h.logs.length,5);
});

test('native popup failures are logged and returned for visible error reporting', () => {
  const h=fixture();
  h.menu.items[0].submenu.popup=()=>{throw new Error('native failure');};
  assert.match(h.call('shell:menu-open',{index:0,x:0,y:0}).error,/Please try again/);
  assert.match(h.logs[0],/native failure/);
});
