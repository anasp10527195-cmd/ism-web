// ========================================================
// SUPABASE CLIENT INITIALIZATION & DATA HELPERS
// Replacement for Google Apps Script SpreadsheetApp / Services
// ========================================================

// 1. Supabase Project Configuration
// Replace these with your project values from Supabase Dashboard -> Settings -> API
const DEFAULT_SUPABASE_URL = "https://your-project-ref.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "your-supabase-anon-key";

// Allow runtime override via localStorage or inline config
const SUPABASE_URL = localStorage.getItem('app_supabase_url') || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = localStorage.getItem('app_supabase_key') || DEFAULT_SUPABASE_ANON_KEY;

let dbClient = null;

/**
 * Initializes the Supabase client
 */
function initSupabase() {
    if (typeof window.supabase === 'undefined') {
        console.error("Supabase SDK is not loaded. Include @supabase/supabase-js CDN in HTML.");
        return null;
    }

    if (SUPABASE_URL === DEFAULT_SUPABASE_URL || SUPABASE_ANON_KEY === DEFAULT_SUPABASE_ANON_KEY) {
        console.warn("Using placeholder Supabase credentials. Update with your real project keys.");
    }

    try {
        dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("Supabase client successfully initialized.");
        return dbClient;
    } catch (err) {
        console.error("Error creating Supabase client:", err);
        return null;
    }
}

/**
 * Get Supabase Client Instance (Singleton)
 */
function getClient() {
    if (!dbClient) {
        initSupabase();
    }
    return dbClient;
}

// ========================================================
// REPLACEMENT FOR GOOGLE APPS SCRIPT SPREADSHEETAPP CRUD
// ========================================================

/**
 * Equivalent to SpreadsheetApp: sheet.getDataRange().getValues()
 * Fetches all rows from the specified table
 */
async function fetchAllRecords(tableName = 'records', orderBy = 'created_at', ascending = false) {
    const client = getClient();
    if (!client) throw new Error("Database client not ready");

    const { data, error } = await client
        .from(tableName)
        .select('*')
        .order(orderBy, { ascending });

    if (error) {
        console.error(`Failed to fetch from ${tableName}:`, error);
        throw error;
    }
    return data || [];
}

/**
 * Equivalent to SpreadsheetApp: sheet.appendRow([...])
 * Inserts a new row or multiple rows
 */
async function insertRecord(tableName = 'records', recordData = {}) {
    const client = getClient();
    if (!client) throw new Error("Database client not ready");

    const { data, error } = await client
        .from(tableName)
        .insert([recordData])
        .select();

    if (error) {
        console.error(`Failed to insert into ${tableName}:`, error);
        throw error;
    }
    return data ? data[0] : null;
}

/**
 * Equivalent to finding a row and updating cells
 */
async function updateRecord(tableName = 'records', id, updatedFields = {}) {
    const client = getClient();
    if (!client) throw new Error("Database client not ready");

    const { data, error } = await client
        .from(tableName)
        .update(updatedFields)
        .eq('id', id)
        .select();

    if (error) {
        console.error(`Failed to update record ${id} in ${tableName}:`, error);
        throw error;
    }
    return data ? data[0] : null;
}

/**
 * Equivalent to sheet.deleteRow(rowIndex)
 */
async function deleteRecord(tableName = 'records', id) {
    const client = getClient();
    if (!client) throw new Error("Database client not ready");

    const { error } = await client
        .from(tableName)
        .delete()
        .eq('id', id);

    if (error) {
        console.error(`Failed to delete record ${id} in ${tableName}:`, error);
        throw error;
    }
    return true;
}

/**
 * Real-time subscription helper (Replaces polling in Apps Script)
 */
function subscribeToTable(tableName = 'records', callback) {
    const client = getClient();
    if (!client) return null;

    return client
        .channel(`public:${tableName}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, payload => {
            if (typeof callback === 'function') {
                callback(payload);
            }
        })
        .subscribe();
}

// Automatically initialize when script loads
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        initSupabase();
    });
}
