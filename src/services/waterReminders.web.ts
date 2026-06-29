// Web stub for water reminders.
//
// expo-notifications isn't supported in the browser (and pulls Node polyfills
// that don't resolve under Metro web), so on web we ship no-ops. Metro picks
// this file over waterReminders.ts for the web platform automatically. The
// toggle preference is still persisted by the caller; it just doesn't schedule
// anything until the app runs on a real device build.
export async function enableWaterReminders(_intervalHours?: number): Promise<boolean> {
    return false;
}

export async function disableWaterReminders(): Promise<void> {
    // no-op on web
}
