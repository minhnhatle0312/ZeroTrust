// Controls only the periodic job. Manual sync and authentication checks retain
// their existing authorization and identity validation.
function directoryScheduleEnabled(value) {
  if (value === undefined || value === 'true') return true;
  if (value === 'false') return false;
  throw Error('DIRECTORY_SYNC_ENABLED must be true or false');
}

function startDirectorySchedule(directory, {enabled, intervalSeconds, schedule = setInterval}) {
  if (!enabled) return null;
  const timer = schedule(() => {
    if (directory.configured) {
      try { directory.queue(); } catch { /* Existing job/errors remain visible through the Directory API. */ }
    }
  }, intervalSeconds * 1000);
  timer.unref();
  return timer;
}

module.exports = {directoryScheduleEnabled, startDirectorySchedule};
