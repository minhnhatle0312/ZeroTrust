const {createHash,randomUUID}=require('node:crypto');
const TYPES=new Set(['LOGIN','LOGIN_ERROR','LOGOUT','LOGOUT_ERROR','UPDATE_PASSWORD','UPDATE_TOTP','REMOVE_TOTP','RESET_PASSWORD','RESET_PASSWORD_ERROR','EXECUTE_ACTIONS','EXECUTE_ACTIONS_ERROR','REFRESH_TOKEN','REFRESH_TOKEN_ERROR']);

// Bound each query in time; commit the cursor with its page. An overlap on
// completed windows deduplicates late records without skipping a failed page.
function createIdentityCollector({store,identity,now=Date.now,batchSize=200,maxPages=10,sourceRetentionDays=7,overlapMs=60000}) {
  let running=null;
  store.run("INSERT OR IGNORE INTO collector_state(name) VALUES('keycloak')");
  const state={lastSuccess:null,lastError:null,imported:0,checkpoint:null,backlog:false,retryAt:null,gaps:0};
  function refresh() {
    const row=store.one("SELECT * FROM collector_state WHERE name='keycloak'");
    Object.assign(state,{lastSuccess:row.last_success,lastError:row.last_error,imported:row.imported,
      checkpoint:row.checkpoint_ms?new Date(row.checkpoint_ms).toISOString():null,
      backlog:row.window_to_ms!==null,retryAt:row.retry_after_ms?new Date(row.retry_after_ms).toISOString():null,
      failures:row.failures,gaps:store.one("SELECT COUNT(*) AS n FROM collector_gaps WHERE state='unverified'").n});
    return row;
  }
  refresh();
  function persistEvent(e) {
    if(!TYPES.has(e.type)||!Number.isFinite(Number(e.time)))return false;
    const stamp=new Date(Number(e.time));if(Number.isNaN(stamp.getTime()))return false;
    const safe={time:stamp.toISOString(),type:e.type,userId:e.userId || null,username:String(e.username || '').slice(0,100),clientId:e.clientId || null,ipAddress:e.ipAddress || null,error:e.error || null};
    const id=e.id || createHash('sha256').update(JSON.stringify(safe)).digest('hex');
    if(store.one('SELECT id FROM identity_events WHERE id=?',id))return false;
    const member=safe.userId?store.one('SELECT username FROM staff WHERE id=?',safe.userId):null;
    const username=member?.username || safe.username || 'Chưa xác định';
    store.run('INSERT INTO identity_events(id,time,type,user_id,username,client_id,ip_address,error) VALUES(?,?,?,?,?,?,?,?)',id,safe.time,safe.type,safe.userId,username,safe.clientId,safe.ipAddress,safe.error);
    if(e.type==='LOGIN_ERROR')store.alert({actorId:safe.userId,username,kind:'Đăng nhập Keycloak thất bại',severity:['user_temporarily_disabled','user_disabled'].includes(e.error)?'high':'medium',time:safe.time});
    return true;
  }
  async function collect({force=false}={}) {
    let cursor=refresh();const started=now(),stamp=new Date(started).toISOString();
    if(!force&&cursor.retry_after_ms>started)return {skipped:true,...state};
    const retention=Number.isFinite(sourceRetentionDays)&&sourceRetentionDays>0?sourceRetentionDays:7;
    const lowerBound=Math.max(0,started-retention*86400000);
    store.tx(()=>{
      store.run("UPDATE collector_state SET last_attempt=? WHERE name='keycloak'",stamp);
      const oldest=cursor.window_from_ms ?? cursor.checkpoint_ms;
      if(oldest&&oldest<lowerBound){
        store.run('INSERT INTO collector_gaps(id,detected_at,from_ms,to_ms,reason) VALUES(?,?,?,?,?)',randomUUID(),stamp,oldest,lowerBound,'Khoảng trống có thể vượt thời gian lưu tại Keycloak; cần đối chiếu backup nguồn.');
        store.run("UPDATE collector_state SET checkpoint_ms=?,window_from_ms=NULL,window_to_ms=NULL,page_offset=0 WHERE name='keycloak'",lowerBound);
      }
    });
    let imported=0,pages=0;
    for(;pages<maxPages;pages++) {
      cursor=refresh();
      if(cursor.window_to_ms===null){
        const from=Math.max(lowerBound,(cursor.checkpoint_ms || lowerBound)-overlapMs);
        const to=Math.min(started-2000,(cursor.checkpoint_ms || lowerBound)+6*3600000);
        if(to<from)break;
        store.run("UPDATE collector_state SET window_from_ms=?,window_to_ms=?,page_offset=0 WHERE name='keycloak'",from,to);
        cursor=refresh();
      }
      const page=await identity.events({max:batchSize,first:cursor.page_offset,dateFrom:cursor.window_from_ms,dateTo:cursor.window_to_ms,direction:'asc'});
      if(!Array.isArray(page))throw Error('Invalid identity page');
      store.tx(()=>{
        for(const event of page)if(persistEvent(event))imported++;
        if(page.length<batchSize)store.run("UPDATE collector_state SET checkpoint_ms=?,window_from_ms=NULL,window_to_ms=NULL,page_offset=0 WHERE name='keycloak'",cursor.window_to_ms);
        else store.run("UPDATE collector_state SET page_offset=? WHERE name='keycloak'",cursor.page_offset+page.length);
        store.run("UPDATE collector_state SET last_success=?,last_error=NULL,failures=0,retry_after_ms=0,imported=? WHERE name='keycloak'",new Date(now()).toISOString(),imported);
      });
      if(page.length<batchSize&&cursor.window_to_ms>=started-2000)break;
    }
    refresh();state.imported=imported;
    const latest=store.one("SELECT checkpoint_ms,window_to_ms FROM collector_state WHERE name='keycloak'");
    state.backlog=latest.window_to_ms!==null||latest.checkpoint_ms<started-2000;
    return {...state,imported,pages:Math.min(pages+1,maxPages)};
  }
  return {state,collect(options){
    if(running)return running;
    running=collect(options).catch(e=>{
      try {
        const failures=(store.one("SELECT failures FROM collector_state WHERE name='keycloak'")?.failures || 0)+1;
        store.run("UPDATE collector_state SET last_error=?,failures=?,retry_after_ms=? WHERE name='keycloak'",'Chưa đồng bộ được sự kiện Keycloak; sẽ thử lại từ checkpoint.',failures,now()+Math.min(300000,1000*2**Math.min(failures,9)));
        refresh();
      }catch{/* Storage failure is still propagated to the caller. */}
      throw e;
    }).finally(()=>{running=null;});
    return running;
  }};
}
module.exports={createIdentityCollector,TYPES};
