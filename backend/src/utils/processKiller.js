export function killProcessSafely(childProc) {
  if (!childProc || childProc.killed) return;
  try {
    childProc.kill("SIGTERM");
    setTimeout(() => {
      if (!childProc.killed) {
        childProc.kill("SIGKILL");
      }
    }, 2000);
  } catch (err) {
    console.error("Failed to kill process:", err);
  }
}
