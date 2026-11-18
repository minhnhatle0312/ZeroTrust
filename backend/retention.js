// Scheduled audit pruning only. Never prune source evidence cited by incident records/history.
function pruneAudit(store,cutoff){
  if(typeof cutoff!=='string'||!Number.isFinite(Date.parse(cutoff)))throw Error('Invalid retention cutoff');
  const counts={};
  store.tx(()=>{
    if(store.one('SELECT 1 AS invalid FROM alerts WHERE NOT json_valid(investigation_json) LIMIT 1')||store.one('SELECT 1 AS invalid FROM alert_history WHERE NOT json_valid(change_json) LIMIT 1'))throw Error('Unreadable incident retention references');
    counts.reads=store.run('DELETE FROM notification_reads WHERE notification_id IN (SELECT id FROM notifications WHERE created_at<?)',cutoff).changes;
    counts.notifications=store.run('DELETE FROM notifications WHERE created_at<?',cutoff).changes;
    for(const [table,prefix] of [['events','events'],['identity_events','identity_events']]){
      // Table and prefix come solely from the two constants above, never a request.
      counts[table]=store.run(`DELETE FROM ${table} AS e WHERE time<?
        AND NOT EXISTS(SELECT 1 FROM alert_evidence l WHERE l.source=? AND l.event_id=CAST(e.id AS TEXT))
        AND NOT EXISTS(SELECT 1 FROM alerts a,json_tree(a.investigation_json) j
          WHERE j.type='text' AND j.atom=?||CAST(e.id AS TEXT))
        AND NOT EXISTS(SELECT 1 FROM alert_history h,json_tree(h.change_json) j
          WHERE j.type='text' AND j.atom=?||CAST(e.id AS TEXT))`,cutoff,prefix,prefix+':',prefix+':').changes;
    }
  });
  return counts;
}
module.exports={pruneAudit};
